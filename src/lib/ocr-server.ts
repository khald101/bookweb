import fs from 'fs';
import path from 'path';
import jpeg from 'jpeg-js';
import { createRequire } from 'module';
import { normalizeArabicText } from './arabic';
import { db } from './db';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.js');
}

// Multi-Worker Pool for high-speed concurrent OCR
const POOL_SIZE = 4;
let workerPool: any[] = [];
let poolInitPromise: Promise<any[]> | null = null;

async function getWorkerPool(): Promise<any[]> {
  if (workerPool.length === POOL_SIZE) {
    return workerPool;
  }
  if (poolInitPromise) {
    return poolInitPromise;
  }

  poolInitPromise = (async () => {
    const { createWorker } = await import('tesseract.js');
    const workers = await Promise.all(
      Array.from({ length: POOL_SIZE }, async () => {
        const w = await createWorker('ara');
        await w.setParameters({
          tessedit_pageseg_mode: '6' as any, // Assume a single uniform block of text - 2x-3x faster
        });
        return w;
      })
    );
    workerPool = workers;
    return workers;
  })();

  return poolInitPromise;
}

/**
 * Fast grayscale downsampling and JPEG encoding for rapid Arabic OCR (under 400ms)
 */
async function extractPageImage(pdfDoc: any, pageNumber: number): Promise<Buffer | null> {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const ops = await page.getOperatorList();
    const imgIdx = ops.fnArray.indexOf(pdfjs.OPS.paintImageXObject);
    if (imgIdx === -1) return null;

    const imgName = ops.argsArray[imgIdx][0];
    const imgData: { data: Uint8Array; width: number; height: number } | null = await new Promise((resolve) => {
      page.objs.get(imgName, (img: any) => {
        if (!img || !img.data) return resolve(null);
        resolve({ data: img.data, width: img.width, height: img.height });
      });
    });

    if (!imgData) return null;

    // Scale to max width 850px for high-speed OCR (sharp enough for Arabic diacritics & characters)
    const scale = imgData.width > 850 ? imgData.width / 850 : 1;
    const targetW = Math.floor(imgData.width / scale);
    const targetH = Math.floor(imgData.height / scale);

    const rgba = Buffer.alloc(targetW * targetH * 4);
    let dst = 0;
    const isRgb = imgData.data.length === imgData.width * imgData.height * 3;
    const isRgba = imgData.data.length === imgData.width * imgData.height * 4;

    for (let y = 0; y < targetH; y++) {
      const srcY = Math.floor(y * scale);
      for (let x = 0; x < targetW; x++) {
        const srcX = Math.floor(x * scale);
        let gray = 255;
        if (isRgb) {
          const s3 = (srcY * imgData.width + srcX) * 3;
          const r = imgData.data[s3] || 0;
          const g = imgData.data[s3 + 1] || 0;
          const b = imgData.data[s3 + 2] || 0;
          gray = (r * 77 + g * 150 + b * 29) >> 8;
        } else if (isRgba) {
          const s4 = (srcY * imgData.width + srcX) * 4;
          const r = imgData.data[s4] || 0;
          const g = imgData.data[s4 + 1] || 0;
          const b = imgData.data[s4 + 2] || 0;
          gray = (r * 77 + g * 150 + b * 29) >> 8;
        } else {
          const s1 = srcY * imgData.width + srcX;
          gray = imgData.data[s1] || 0;
        }
        rgba[dst] = gray;
        rgba[dst + 1] = gray;
        rgba[dst + 2] = gray;
        rgba[dst + 3] = 255;
        dst += 4;
      }
    }

    const encoded = jpeg.encode({ data: rgba, width: targetW, height: targetH }, 70);
    return encoded.data;
  } catch (err) {
    console.error(`Failed to extract image on page ${pageNumber}:`, err);
    return null;
  }
}

/**
 * OCR a single page of a PDF and save it directly to database
 */
export async function ocrPdfPage(bookId: string, filePath: string, pageNumber: number): Promise<string> {
  const existing = db.bookTexts.getPage(bookId, pageNumber);
  if (existing && existing.textContent && existing.textContent.trim().length > 10) {
    return existing.textContent;
  }

  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdfDoc = await pdfjs.getDocument({ data }).promise;
  const imgBuffer = await extractPageImage(pdfDoc, pageNumber);

  if (!imgBuffer) return '';

  const workers = await getWorkerPool();
  const worker = workers[0];
  const ret = await worker.recognize(imgBuffer);
  const text = (ret.data.text || '').trim();

  if (text) {
    db.bookTexts.saveSinglePage(bookId, pageNumber, text);
  }

  return text;
}

/**
 * Process a batch of pages in parallel across the worker pool for ultra-fast indexing
 */
export async function searchOrIndexScannedBatch(
  bookId: string,
  filePath: string,
  query: string,
  startPage: number,
  batchSize: number = 12
) {
  if (!fs.existsSync(filePath)) {
    throw new Error('ملف الكتاب غير موجود على الخادم');
  }

  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdfDoc = await pdfjs.getDocument({ data }).promise;
  const totalPages = pdfDoc.numPages;

  const endPage = Math.min(totalPages, startPage + batchSize - 1);
  const normalizedQuery = normalizeArabicText(query.trim());
  const workers = await getWorkerPool();

  // Create page tasks array
  const pageNumbers: number[] = [];
  for (let p = startPage; p <= endPage; p++) {
    pageNumbers.push(p);
  }

  // Execute all pages in this batch concurrently across the worker pool
  const results = await Promise.all(
    pageNumbers.map(async (pageNum, idx) => {
      // 1. Check if already has text in DB
      let pageText = '';
      const existing = db.bookTexts.getPage(bookId, pageNum);

      if (existing && existing.textContent && existing.textContent.trim().length > 10) {
        pageText = existing.textContent;
      } else {
        // 2. Extract image & OCR using one of the parallel workers
        const imgBuffer = await extractPageImage(pdfDoc, pageNum);
        if (imgBuffer) {
          const worker = workers[idx % workers.length];
          const ret = await worker.recognize(imgBuffer);
          pageText = (ret.data.text || '').trim();
          if (pageText) {
            db.bookTexts.saveSinglePage(bookId, pageNum, pageText);
          }
        }
      }

      // 3. Search check
      let pageMatch: { pageNumber: number; snippet: string; exactMatch: string } | null = null;
      if (pageText && normalizedQuery) {
        const normPageText = normalizeArabicText(pageText);
        const matchIdx = normPageText.indexOf(normalizedQuery);

        if (matchIdx !== -1) {
          const start = Math.max(0, matchIdx - 40);
          const end = Math.min(pageText.length, matchIdx + normalizedQuery.length + 50);
          let snippet = pageText.substring(start, end).replace(/\s+/g, ' ').trim();
          if (start > 0) snippet = '...' + snippet;
          if (end < pageText.length) snippet = snippet + '...';

          const exactMatch = pageText.substring(matchIdx, matchIdx + normalizedQuery.length) || query;

          pageMatch = {
            pageNumber: pageNum,
            snippet,
            exactMatch,
          };
        }
      }

      return pageMatch;
    })
  );

  const matches = results.filter((m): m is { pageNumber: number; snippet: string; exactMatch: string } => m !== null);

  return {
    startPage,
    endPage,
    totalPages,
    hasMore: endPage < totalPages,
    nextPage: endPage < totalPages ? endPage + 1 : null,
    matches,
    processedCount: endPage - startPage + 1,
  };
}

/**
 * OCR an image buffer directly using the warm worker pool
 */
export async function ocrImageBuffer(buffer: Buffer): Promise<string> {
  const workers = await getWorkerPool();
  const worker = workers[0];
  const ret = await worker.recognize(buffer);
  return (ret.data.text || '').replace(/\s+/g, ' ').trim();
}

/**
 * OCR a specific cropped box of a PDF page
 */
export async function ocrPdfBox(
  filePath: string,
  pageNumber: number,
  box: { x: number; y: number; width: number; height: number }
): Promise<string> {
  if (!fs.existsSync(filePath)) return '';
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdfDoc = await pdfjs.getDocument({ data }).promise;
  const page = await pdfDoc.getPage(pageNumber);
  const ops = await page.getOperatorList();
  const imgIdx = ops.fnArray.indexOf(pdfjs.OPS.paintImageXObject);
  if (imgIdx === -1) return '';

  const imgName = ops.argsArray[imgIdx][0];
  const imgData: { data: Uint8Array; width: number; height: number } | null = await new Promise((resolve) => {
    page.objs.get(imgName, (img: any) => {
      if (!img || !img.data) return resolve(null);
      resolve({ data: img.data, width: img.width, height: img.height });
    });
  });

  if (!imgData) return '';

  const cropX = Math.max(0, Math.floor((box.x / 100) * imgData.width));
  const cropY = Math.max(0, Math.floor((box.y / 100) * imgData.height));
  const cropW = Math.max(10, Math.min(imgData.width - cropX, Math.floor((box.width / 100) * imgData.width)));
  const cropH = Math.max(10, Math.min(imgData.height - cropY, Math.floor((box.height / 100) * imgData.height)));

  const rgba = Buffer.alloc(cropW * cropH * 4);
  let dst = 0;
  const isRgb = imgData.data.length === imgData.width * imgData.height * 3;
  const isRgba = imgData.data.length === imgData.width * imgData.height * 4;

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      let gray = 255;
      if (isRgb) {
        const s3 = ((cropY + y) * imgData.width + (cropX + x)) * 3;
        const r = imgData.data[s3] || 0;
        const g = imgData.data[s3 + 1] || 0;
        const b = imgData.data[s3 + 2] || 0;
        gray = (r * 77 + g * 150 + b * 29) >> 8;
      } else if (isRgba) {
        const s4 = ((cropY + y) * imgData.width + (cropX + x)) * 4;
        const r = imgData.data[s4] || 0;
        const g = imgData.data[s4 + 1] || 0;
        const b = imgData.data[s4 + 2] || 0;
        gray = (r * 77 + g * 150 + b * 29) >> 8;
      } else {
        const s1 = (cropY + y) * imgData.width + (cropX + x);
        gray = imgData.data[s1] || 0;
      }
      rgba[dst] = gray;
      rgba[dst + 1] = gray;
      rgba[dst + 2] = gray;
      rgba[dst + 3] = 255;
      dst += 4;
    }
  }

  const encoded = jpeg.encode({ data: rgba, width: cropW, height: cropH }, 90);
  const workers = await getWorkerPool();
  const worker = workers[0];
  const ret = await worker.recognize(encoded.data);
  return (ret.data.text || '').replace(/\s+/g, ' ').trim();
}
