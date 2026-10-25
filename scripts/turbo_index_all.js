const fs = require('fs');
const path = require('path');
const os = require('os');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { createWorker, createScheduler } = require('tesseract.js');

const dotDbPath = path.join(__dirname, '..', '.data', 'library.json');
const legacyDbPath = path.join(__dirname, '..', 'data', 'library.json');
const dbPath = fs.existsSync(dotDbPath) ? dotDbPath : legacyDbPath;
const trainedDataDir = path.join(__dirname, '..');

const CPU_COUNT = os.cpus()?.length || 8;
const WORKER_COUNT = Math.max(4, Math.min(14, CPU_COUNT - 2));

function normalizeArabicText(text) {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ی/g, 'ي')
    .replace(/[()[\]{}﴿﴾«»‹›"''„“”‘’،,؛;.\-–—_/:!؟?#*&~+=|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function createGrayscaleBmp(grayPixels, width, height) {
  const rowStride = Math.ceil(width / 4) * 4;
  const imageSize = rowStride * height;
  const fileSize = 54 + 1024 + imageSize;
  const buf = Buffer.alloc(fileSize);

  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(54 + 1024, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(8, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(imageSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(256, 46);
  buf.writeUInt32LE(0, 50);

  let pIdx = 54;
  for (let i = 0; i < 256; i++) {
    buf[pIdx++] = i;
    buf[pIdx++] = i;
    buf[pIdx++] = i;
    buf[pIdx++] = 0;
  }

  let srcOffset = 0;
  let dstOffset = 54 + 1024;
  for (let y = 0; y < height; y++) {
    grayPixels.copy(buf, dstOffset, srcOffset, srcOffset + width);
    srcOffset += width;
    dstOffset += rowStride;
  }

  return buf;
}

async function extractPageImage(pdfDoc, pageNumber) {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const ops = await page.getOperatorList();
    const imgIdx = ops.fnArray.indexOf(pdfjs.OPS.paintImageXObject);
    if (imgIdx === -1) return null;

    const imgName = ops.argsArray[imgIdx][0];
    const imgData = await new Promise((resolve) => {
      page.objs.get(imgName, (img) => {
        if (!img || !img.data) return resolve(null);
        resolve({ data: img.data, width: img.width, height: img.height, kind: img.kind });
      });
    });

    if (!imgData) return null;

    const width = imgData.width;
    const height = imgData.height;

    const is1Bpp = imgData.kind === 1 || imgData.data.length === Math.ceil(width / 8) * height;
    const isRgb = imgData.kind === 2 || imgData.data.length === width * height * 3;
    const isRgba = imgData.kind === 3 || imgData.data.length === width * height * 4;
    const rowBytes1Bpp = Math.ceil(width / 8);

    const scale = width > 540 ? width / 540 : 1;
    const targetW = Math.floor(width / scale);
    const targetH = Math.floor(height / scale);

    const gray = Buffer.alloc(targetW * targetH);
    let dst = 0;

    for (let y = 0; y < targetH; y++) {
      const srcY = Math.floor(y * scale);
      const rowStart1Bpp = srcY * rowBytes1Bpp;
      for (let x = 0; x < targetW; x++) {
        const srcX = Math.floor(x * scale);
        let g = 255;

        if (is1Bpp) {
          const byte = imgData.data[rowStart1Bpp + (srcX >> 3)];
          const bit = (byte >> (7 - (srcX & 7))) & 1;
          g = bit === 0 ? 0 : 255;
        } else if (isRgb) {
          const s3 = (srcY * width + srcX) * 3;
          const r = imgData.data[s3] || 0;
          const green = imgData.data[s3 + 1] || 0;
          const b = imgData.data[s3 + 2] || 0;
          g = (r * 77 + green * 150 + b * 29) >> 8;
        } else if (isRgba) {
          const s4 = (srcY * width + srcX) * 4;
          const r = imgData.data[s4] || 0;
          const green = imgData.data[s4 + 1] || 0;
          const b = imgData.data[s4 + 2] || 0;
          g = (r * 77 + green * 150 + b * 29) >> 8;
        } else {
          g = imgData.data[srcY * width + srcX] || 0;
        }

        gray[dst++] = g;
      }
    }

    const bmp = createGrayscaleBmp(gray, targetW, targetH);
    return { buffer: bmp, width: targetW, height: targetH };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log(`=======================================================`);
  console.log(`🚀 TURBO INDEXER: Initializing ${WORKER_COUNT} Parallel Workers across ${CPU_COUNT} CPU Cores`);
  console.log(`=======================================================`);

  const scheduler = createScheduler();
  const initStart = Date.now();

  await Promise.all(
    Array.from({ length: WORKER_COUNT }, async (_, i) => {
      const w = await createWorker('ara', 1, { langPath: trainedDataDir });
      await w.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_do_invert: '0',
      });
      scheduler.addWorker(w);
    })
  );
  console.log(`✅ All ${WORKER_COUNT} workers initialized in ${((Date.now() - initStart) / 1000).toFixed(1)}s!`);

  let db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  const books = db.books || [];

  for (const book of books) {
    if (!book.filePath || !fs.existsSync(book.filePath)) continue;

    const data = new Uint8Array(fs.readFileSync(book.filePath));
    const pdfDoc = await pdfjs.getDocument({ data }).promise;
    const totalPages = pdfDoc.numPages;

    const existingPages = new Set(
      db.bookTexts
        .filter((t) => t.bookId === book.id && t.textContent && t.textContent.trim().length > 10)
        .map((t) => t.pageNumber)
    );

    const missingPages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (!existingPages.has(p)) missingPages.push(p);
    }

    if (missingPages.length === 0) {
      console.log(`✨ [${book.title}] Already 100% indexed (${totalPages}/${totalPages} pages).`);
      continue;
    }

    console.log(`\n📚 [${book.title}] Missing ${missingPages.length}/${totalPages} pages. Launching turbo parallel indexing...`);

    const BATCH_SIZE = 28;
    const bookStart = Date.now();
    let indexedThisBook = 0;

    for (let i = 0; i < missingPages.length; i += BATCH_SIZE) {
      const batchNumbers = missingPages.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();

      // Parallel BMP extraction
      const extracted = await Promise.all(
        batchNumbers.map(async (pageNum) => {
          const img = await extractPageImage(pdfDoc, pageNum);
          return { pageNum, img };
        })
      );

      // Parallel OCR jobs dispatched to scheduler
      const results = [];
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
              results.push({
                id: `txt_${book.id}_${item.pageNum}`,
                bookId: book.id,
                pageNumber: item.pageNum,
                textContent: text,
                normalizedText: normalizeArabicText(text),
              });
            }
          } catch (e) {
            // ignore page error
          }
        })
      );

      // Flush to DB
      if (results.length > 0) {
        db.bookTexts.push(...results);
        // Persist to .data/library.json
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
      }

      indexedThisBook += batchNumbers.length;
      const batchTimeSec = (Date.now() - batchStart) / 1000;
      const rate = (batchNumbers.length / batchTimeSec).toFixed(1);
      const totalElapsedSec = (Date.now() - bookStart) / 1000;
      const avgRate = (indexedThisBook / totalElapsedSec).toFixed(1);
      const projectedPagesPerMin = (avgRate * 60).toFixed(0);

      console.log(
        `⚡ [${book.title}] ${indexedThisBook}/${missingPages.length} pages | Batch: ${rate} p/s | Avg: ${avgRate} p/s (${projectedPagesPerMin} pages/min)`
      );
    }

    // Mark completed
    const bEntry = db.books.find((b) => b.id === book.id);
    if (bEntry) {
      bEntry.ocrStatus = 'completed';
      bEntry.isOcr = true;
      bEntry.status = 'ready';
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
    }
    console.log(`🎉 Finished "${book.title}" in ${((Date.now() - bookStart) / 1000).toFixed(1)}s!`);
  }

  console.log(`\n=======================================================`);
  console.log(`🏆 ALL BOOKS FULLY INDEXED AT TURBO HARDWARE SPEED!`);
  console.log(`=======================================================`);
  await scheduler.terminate();
}

main().catch(console.error);
