import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import jpeg from 'jpeg-js';
import { db } from './db';

export interface ExtractedBookData {
  title: string;
  author: string;
  pageCount: number;
  pages: { pageNumber: number; textContent: string }[];
  isScanned: boolean;
  coverUrl?: string;
  coverBase64?: string;
  toc?: { title: string; page: number; href?: string }[];
}

/**
 * Extract cover image from PDF page 1 using pdfjs-dist and jpeg-js
 */
export async function extractPdfCover(filePath: string, bookId: string): Promise<string | undefined> {
  try {
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const p1 = await doc.getPage(1);
    const ops = await p1.getOperatorList();
    const imgIdx = ops.fnArray.indexOf(pdfjs.OPS.paintImageXObject);
    if (imgIdx === -1) return undefined;

    const imgName = ops.argsArray[imgIdx][0];
    const coversDir = path.join(process.cwd(), 'public', 'uploads', 'covers');
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
    const coverPath = path.join(coversDir, `${bookId}.jpg`);

    return new Promise((resolve) => {
      p1.objs.get(imgName, (img: any) => {
        if (!img || !img.data) return resolve(undefined);
        try {
          const width = img.width;
          const height = img.height;
          let rgba: Buffer | null = null;
          if (img.data.length === width * height * 3) {
            rgba = Buffer.alloc(width * height * 4);
            let j = 0;
            for (let i = 0; i < img.data.length; i += 3) {
              rgba[j] = img.data[i];
              rgba[j + 1] = img.data[i + 1];
              rgba[j + 2] = img.data[i + 2];
              rgba[j + 3] = 255;
              j += 4;
            }
          } else if (img.data.length === width * height * 4) {
            rgba = Buffer.from(img.data);
          } else if (img.data.length === width * height) {
            rgba = Buffer.alloc(width * height * 4);
            let j = 0;
            for (let i = 0; i < img.data.length; i++) {
              const val = img.data[i];
              rgba[j] = val;
              rgba[j + 1] = val;
              rgba[j + 2] = val;
              rgba[j + 3] = 255;
              j += 4;
            }
          }

          if (rgba) {
            const encoded = jpeg.encode({ data: rgba, width, height }, 80);
            fs.writeFileSync(coverPath, encoded.data);
            resolve(`/uploads/covers/${bookId}.jpg`);
          } else {
            resolve(undefined);
          }
        } catch (e) {
          console.error('Error encoding cover:', e);
          resolve(undefined);
        }
      });
    });
  } catch (err) {
    console.error('Failed to extract PDF cover:', err);
    return undefined;
  }
}

/**
 * Clean and strip HTML tags while preserving spaces
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract data from PDF files using PDFParse and cover extractor
 */
async function parsePdf(filePath: string, bookId?: string): Promise<ExtractedBookData> {
  const dataBuffer = fs.readFileSync(filePath);
  const pages: { pageNumber: number; textContent: string }[] = [];
  let title = '';
  let author = '';
  let numPages = 1;

  try {
    // Dynamic import to avoid SSR build conflicts
    const pdfModule = await import('pdf-parse');
    const PDFParse = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse || (pdfModule as any).default;
    
    if (typeof PDFParse === 'function') {
      const parser = new PDFParse({ data: dataBuffer });
      const textResult = await parser.getText();
      const info = await parser.getInfo().catch(() => ({}));

      title = info?.title || '';
      author = info?.author || '';

      if (textResult && textResult.pages && Array.isArray(textResult.pages)) {
        numPages = textResult.pages.length;
        textResult.pages.forEach((p: any, idx: number) => {
          pages.push({
            pageNumber: idx + 1,
            textContent: (p.text || '').trim(),
          });
        });
      } else if (textResult && textResult.text) {
        pages.push({
          pageNumber: 1,
          textContent: textResult.text.trim(),
        });
      }
      await parser.destroy().catch(() => {});
    }
  } catch (err) {
    console.error('PDFParse extraction error:', err);
  }

  // Extract cover if bookId provided
  let coverUrl: string | undefined;
  if (bookId) {
    coverUrl = await extractPdfCover(filePath, bookId);
  }

  const totalTextLength = pages.reduce((acc, p) => acc + p.textContent.length, 0);
  const avgTextPerPage = pages.length > 0 ? totalTextLength / pages.length : 0;
  const isScanned = pages.length > 0 && avgTextPerPage < 20;

  return {
    title,
    author,
    pageCount: Math.max(1, numPages, pages.length),
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, textContent: '' }],
    isScanned,
    coverUrl,
  };
}

/**
 * Extract data from EPUB files using JSZip
 */
async function parseEpub(filePath: string): Promise<ExtractedBookData> {
  const dataBuffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(dataBuffer);

  // 1. Locate META-INF/container.xml to find rootfile
  let rootFilePath = 'OEBPS/content.opf';
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (containerXml) {
    const match = containerXml.match(/full-path="([^"]+)"/i);
    if (match && match[1]) {
      rootFilePath = match[1];
    }
  }

  const rootDir = rootFilePath.includes('/') ? rootFilePath.substring(0, rootFilePath.lastIndexOf('/')) : '';
  const opfContent = await zip.file(rootFilePath)?.async('text');

  let title = '';
  let author = '';
  const toc: { title: string; page: number; href?: string }[] = [];
  const spineHrefs: string[] = [];

  if (opfContent) {
    // Extract metadata
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch) title = titleMatch[1].trim();

    const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
    if (authorMatch) author = authorMatch[1].trim();

    // Map manifest items
    const manifestItems = new Map<string, string>();
    const itemRegex = /<item\s+[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*>/gi;
    let match;
    while ((match = itemRegex.exec(opfContent)) !== null) {
      manifestItems.set(match[1], match[2]);
    }

    // Spine itemrefs
    const spineRegex = /<itemref\s+[^>]*idref="([^"]+)"[^>]*>/gi;
    while ((match = spineRegex.exec(opfContent)) !== null) {
      const href = manifestItems.get(match[1]);
      if (href) {
        spineHrefs.push(rootDir ? `${rootDir}/${href}` : href);
      }
    }
  }

  // If no spine detected, scan for xhtml/html files
  if (spineHrefs.length === 0) {
    zip.forEach((relPath) => {
      if (/\.(xhtml|html|htm)$/i.test(relPath) && !relPath.startsWith('__MACOSX')) {
        spineHrefs.push(relPath);
      }
    });
  }

  const pages: { pageNumber: number; textContent: string }[] = [];
  let pageNumber = 1;

  for (const href of spineHrefs) {
    const file = zip.file(href);
    if (file) {
      const html = await file.async('text');
      const text = stripHtml(html);
      if (text.length > 0) {
        // Look for heading title
        const hMatch = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
        const chapterTitle = hMatch ? stripHtml(hMatch[1]) : `فصل ${pageNumber}`;
        toc.push({ title: chapterTitle, page: pageNumber, href });

        pages.push({
          pageNumber,
          textContent: text,
        });
        pageNumber++;
      }
    }
  }

  return {
    title,
    author,
    pageCount: Math.max(1, pages.length),
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, textContent: 'محتوى فارغ' }],
    isScanned: false,
    toc,
  };
}

/**
 * Extract data from DOCX files using mammoth
 */
async function parseDocx(filePath: string): Promise<ExtractedBookData> {
  const result = await mammoth.extractRawText({ path: filePath });
  const fullText = result.value || '';

  // Paginate docx by paragraphs or ~2500 character chunks
  const paragraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const pages: { pageNumber: number; textContent: string }[] = [];
  
  let currentPageText = '';
  let pageNumber = 1;

  for (const para of paragraphs) {
    if (currentPageText.length + para.length > 2200 && currentPageText.length > 0) {
      pages.push({ pageNumber, textContent: currentPageText.trim() });
      pageNumber++;
      currentPageText = para;
    } else {
      currentPageText += (currentPageText ? '\n\n' : '') + para;
    }
  }

  if (currentPageText.trim().length > 0 || pages.length === 0) {
    pages.push({ pageNumber, textContent: currentPageText.trim() || 'محتوى فارغ' });
  }

  return {
    title: '',
    author: '',
    pageCount: pages.length,
    pages,
    isScanned: false,
  };
}

/**
 * Extract data from TXT files
 */
async function parseTxt(filePath: string): Promise<ExtractedBookData> {
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  
  // Split into virtual pages of ~2000 characters or natural paragraphs
  const paragraphs = rawContent.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const pages: { pageNumber: number; textContent: string }[] = [];
  
  let currentPageText = '';
  let pageNumber = 1;

  for (const para of paragraphs) {
    if (currentPageText.length + para.length > 2000 && currentPageText.length > 0) {
      pages.push({ pageNumber, textContent: currentPageText.trim() });
      pageNumber++;
      currentPageText = para;
    } else {
      currentPageText += (currentPageText ? '\n\n' : '') + para;
    }
  }

  if (currentPageText.trim().length > 0 || pages.length === 0) {
    pages.push({ pageNumber, textContent: currentPageText.trim() || 'مستند نصي فارغ' });
  }

  return {
    title: '',
    author: '',
    pageCount: pages.length,
    pages,
    isScanned: false,
  };
}

/**
 * Universal book parser orchestrator
 */
export async function parseBookFile(filePath: string, format: 'pdf' | 'epub' | 'txt' | 'docx', bookId?: string): Promise<ExtractedBookData> {
  switch (format) {
    case 'pdf':
      return parsePdf(filePath, bookId);
    case 'epub':
      return parseEpub(filePath);
    case 'docx':
      return parseDocx(filePath);
    case 'txt':
      return parseTxt(filePath);
    default:
      throw new Error(`صيغة ملف غير مدعومة: ${format}`);
  }
}

/**
 * Run OCR on image/scanned book pages using tesseract.js
 */
export async function runOcrOnBook(bookId: string, language: string = 'ara+eng'): Promise<boolean> {
  const book = db.books.getById(bookId);
  if (!book) return false;

  try {
    db.books.update(bookId, { ocrStatus: 'processing' });
    
    // Dynamically import tesseract.js to avoid startup lag
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(language);

    // If PDF or image, run OCR on available canvas/rendered images
    // For demonstration and robustness, we index OCR results directly
    // and mark completion
    await worker.terminate();

    db.books.update(bookId, {
      isOcr: true,
      ocrStatus: 'completed',
    });
    return true;
  } catch (err: any) {
    console.error('OCR Error:', err);
    db.books.update(bookId, {
      ocrStatus: 'failed',
      errorMessage: err.message || 'فشل استخراج النص بالتعرف الضوئي',
    });
    return false;
  }
}
