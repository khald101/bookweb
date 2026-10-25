import fs from 'fs';
import path from 'path';
import { db } from './db';
import { extractPageImage, getScheduler } from './ocr-server';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

interface IndexingJob {
  bookId: string;
  startedAt: number;
}

class AutoIndexer {
  private queue: string[] = [];
  private isProcessing = false;
  private currentJob: {
    bookId: string;
    bookTitle: string;
    currentPage: number;
    totalPages: number;
    startTime: number;
  } | null = null;

  constructor() {
    // Background indexing runs when books are added or explicitly triggered by user
  }

  public getStatus() {
    const books = db.books.getAll();
    const allPages = db.bookTexts.getAllPages ? db.bookTexts.getAllPages('') : [];
    
    const booksStatus = books.map((b) => {
      const indexed = db.bookTexts.getAllPages(b.id).filter((p) => p.textContent && p.textContent.trim().length > 5).length;
      return {
        id: b.id,
        title: b.title,
        pageCount: b.pageCount,
        indexedPages: indexed,
        isCompleted: indexed >= b.pageCount && b.pageCount > 0,
        ocrStatus: b.ocrStatus,
      };
    });

    return {
      isProcessing: this.isProcessing,
      currentJob: this.currentJob,
      queueLength: this.queue.length,
      queue: this.queue,
      books: booksStatus,
    };
  }

  /**
   * Enqueue a book for immediate background indexing
   */
  public enqueue(bookId: string) {
    if (!this.queue.includes(bookId) && this.currentJob?.bookId !== bookId) {
      this.queue.push(bookId);
      console.log(`[AutoIndexer] Book ${bookId} enqueued. Queue length: ${this.queue.length}`);
    }
    this.processQueue();
  }

  /**
   * Enqueue all books that have unindexed pages
   */
  public enqueueAllUnindexed(): number {
    const books = db.books.getAll();
    let count = 0;
    
    // Sort books so smaller books complete first, providing fast satisfaction
    const unindexedBooks = books
      .map((b) => {
        const indexed = db.bookTexts.getAllPages(b.id).filter((p) => p.textContent && p.textContent.trim().length > 5).length;
        return {
          book: b,
          indexed,
          remaining: Math.max(0, b.pageCount - indexed),
        };
      })
      .filter((item) => item.remaining > 0 && fs.existsSync(item.book.filePath))
      .sort((a, b) => a.remaining - b.remaining);

    for (const item of unindexedBooks) {
      if (!this.queue.includes(item.book.id) && this.currentJob?.bookId !== item.book.id) {
        this.queue.push(item.book.id);
        count++;
      }
    }

    console.log(`[AutoIndexer] Enqueued ${count} unindexed books.`);
    this.processQueue();
    return count;
  }

  private async checkAndResumeUnindexed() {
    const books = db.books.getAll();
    const hasPending = books.some((b) => b.ocrStatus === 'processing' || b.ocrStatus === 'pending');
    if (hasPending) {
      this.enqueueAllUnindexed();
    }
  }

  private async processQueue() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) {
      this.currentJob = null;
      return;
    }

    this.isProcessing = true;
    const bookId = this.queue.shift()!;

    try {
      await this.indexBook(bookId);
    } catch (err) {
      console.error(`[AutoIndexer] Error indexing book ${bookId}:`, err);
    } finally {
      this.isProcessing = false;
      this.currentJob = null;
      // Continue next book in queue
      setTimeout(() => this.processQueue(), 500);
    }
  }

  /**
   * Index all pages of a specific book
   */
  private async indexBook(bookId: string) {
    const book = db.books.getById(bookId);
    if (!book || !book.filePath || !fs.existsSync(book.filePath)) {
      console.warn(`[AutoIndexer] Book or file not found for ${bookId}`);
      return;
    }

    console.log(`[AutoIndexer] Starting auto-indexing for: "${book.title}" (${book.format})`);
    db.books.update(bookId, { ocrStatus: 'processing' });

    if (book.format !== 'pdf') {
      // Non-PDF formats are already parsed into text during upload
      db.books.update(bookId, {
        ocrStatus: 'none',
        isOcr: false,
        status: 'ready',
      });
      return;
    }

    const data = new Uint8Array(fs.readFileSync(book.filePath));
    const pdfDoc = await pdfjs.getDocument({ data }).promise;
    const totalPages = pdfDoc.numPages;

    if (book.pageCount !== totalPages) {
      db.books.update(bookId, { pageCount: totalPages });
    }

    this.currentJob = {
      bookId,
      bookTitle: book.title,
      currentPage: 0,
      totalPages,
      startTime: Date.now(),
    };

    // 1. First, check if pages have digital text layer (super fast)
    let digitalTextFound = 0;
    const pagesToOcr: number[] = [];

    for (let p = 1; p <= totalPages; p++) {
      const existing = db.bookTexts.getPage(bookId, p);
      if (existing && existing.textContent && existing.textContent.trim().length > 10) {
        continue; // Already indexed
      }

      try {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const str = textContent.items.map((it: any) => it.str).join(' ').trim();

        if (str.length > 20) {
          db.bookTexts.saveSinglePage(bookId, p, str);
          digitalTextFound++;
        } else {
          pagesToOcr.push(p);
        }
      } catch (err) {
        pagesToOcr.push(p);
      }
    }

    console.log(`[AutoIndexer] "${book.title}": ${digitalTextFound} digital pages indexed. ${pagesToOcr.length} scanned pages require OCR.`);

    if (pagesToOcr.length === 0) {
      db.books.update(bookId, {
        ocrStatus: 'completed',
        isOcr: false,
        status: 'ready',
      });
      console.log(`[AutoIndexer] Finished indexing "${book.title}" (100% digital text).`);
      return;
    }

    // Mark as scanned book since it contains pages needing OCR
    db.books.update(bookId, { isOcr: true, ocrStatus: 'processing' });

    // 2. High-speed parallel OCR across all CPU cores with scheduler pool
    const scheduler = await getScheduler();
    const BATCH_SIZE = 24;
    let completedCount = 0;

    for (let i = 0; i < pagesToOcr.length; i += BATCH_SIZE) {
      const batchNumbers = pagesToOcr.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();

      // Parallel BMP image extraction (< 1ms per page)
      const extracted = await Promise.all(
        batchNumbers.map(async (pageNum) => {
          const img = await extractPageImage(pdfDoc, pageNum);
          return { pageNum, img };
        })
      );

      // Parallel OCR across all workers in the scheduler pool
      const batchResults: { pageNumber: number; textContent: string }[] = [];
      await Promise.all(
        extracted.map(async (item) => {
          if (!item.img) return;
          try {
            const ret = await scheduler.addJob(
              'recognize',
              item.img.buffer,
              {},
              { text: true, blocks: false, layoutBlocks: false, hocr: false, tsv: false, box: false }
            );
            const text = (ret.data.text || '').trim();
            if (text) {
              batchResults.push({ pageNumber: item.pageNum, textContent: text });
            }
          } catch (pageErr: any) {
            console.error(`[AutoIndexer] Page ${item.pageNum} error:`, pageErr.message);
          }
        })
      );

      // Batch save into DB with single grouped write
      if (batchResults.length > 0) {
        db.bookTexts.upsertPagesBatch(bookId, batchResults);
      }

      completedCount += batchNumbers.length;
      const batchTime = Date.now() - batchStart;
      const speed = (batchNumbers.length / (batchTime / 1000)).toFixed(1);

      if (this.currentJob) {
        this.currentJob.currentPage = completedCount;
      }

      console.log(`[AutoIndexer] "${book.title}": ${completedCount}/${pagesToOcr.length} scanned pages indexed (${speed} pages/sec)`);
    }

    db.books.update(bookId, {
      ocrStatus: 'completed',
      isOcr: true,
      status: 'ready',
    });

    console.log(`[AutoIndexer] Completed 100% indexing for "${book.title}"!`);
  }
}

// Global singleton instance so it persists across Next.js API reloads
const globalForIndexer = globalThis as unknown as { __auto_indexer?: AutoIndexer };
export const autoIndexer = globalForIndexer.__auto_indexer || new AutoIndexer();
if (process.env.NODE_ENV !== 'production') {
  globalForIndexer.__auto_indexer = autoIndexer;
}
