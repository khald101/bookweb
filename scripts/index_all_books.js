const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { createWorker } = require('tesseract.js');

const dotDbPath = path.join(__dirname, '..', '.data', 'library.json');
const legacyDbPath = path.join(__dirname, '..', 'data', 'library.json');
const dbPath = fs.existsSync(dotDbPath) ? dotDbPath : legacyDbPath;
const trainedDataDir = path.join(__dirname, '..');

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

    const scale = width > 800 ? width / 800 : 1;
    const targetW = Math.floor(width / scale);
    const targetH = Math.floor(height / scale);

    const rgba = Buffer.alloc(targetW * targetH * 4);
    let dst = 0;

    for (let y = 0; y < targetH; y++) {
      const srcY = Math.floor(y * scale);
      const rowStart1Bpp = srcY * rowBytes1Bpp;
      for (let x = 0; x < targetW; x++) {
        const srcX = Math.floor(x * scale);
        let gray = 255;

        if (is1Bpp) {
          const byte = imgData.data[rowStart1Bpp + (srcX >> 3)];
          const bit = (byte >> (7 - (srcX & 7))) & 1;
          gray = bit === 0 ? 0 : 255;
        } else if (isRgb) {
          const s3 = (srcY * width + srcX) * 3;
          const r = imgData.data[s3] || 0;
          const g = imgData.data[s3 + 1] || 0;
          const b = imgData.data[s3 + 2] || 0;
          gray = (r * 77 + g * 150 + b * 29) >> 8;
        } else if (isRgba) {
          const s4 = (srcY * width + srcX) * 4;
          const r = imgData.data[s4] || 0;
          const g = imgData.data[s4 + 1] || 0;
          const b = imgData.data[s4 + 2] || 0;
          gray = (r * 77 + g * 150 + b * 29) >> 8;
        } else {
          const s1 = srcY * width + srcX;
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
    return null;
  }
}

async function main() {
  console.log('=== Universal Library Auto-Indexer Starting ===');

  if (!fs.existsSync(dbPath)) {
    console.error('library.json not found!');
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // Initialize pool of 4 workers
  const NUM_WORKERS = 4;
  console.log(`Initializing ${NUM_WORKERS} OCR workers with local traineddata...`);
  const workers = await Promise.all(
    Array.from({ length: NUM_WORKERS }, async () => {
      const w = await createWorker('ara', 1, { langPath: trainedDataDir });
      await w.setParameters({ tessedit_pageseg_mode: '6' });
      return w;
    })
  );
  console.log('All OCR workers ready!');

  // Filter books needing indexing
  const booksToProcess = db.books
    .map((b) => {
      const indexedCount = db.bookTexts.filter((t) => t.bookId === b.id && t.textContent && t.textContent.trim().length > 10).length;
      return {
        book: b,
        indexedCount,
        remaining: Math.max(0, b.pageCount - indexedCount),
      };
    })
    .filter((item) => item.remaining > 0 && fs.existsSync(item.book.filePath))
    .sort((a, b) => a.remaining - b.remaining); // Smallest books first!

  console.log(`Found ${booksToProcess.length} books to index:`);
  booksToProcess.forEach((item, idx) => {
    console.log(`  ${idx + 1}. [${item.book.title}] - ${item.indexedCount}/${item.book.pageCount} indexed (${item.remaining} pages left)`);
  });

  const saveDb = () => {
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, dbPath);
  };

  for (const { book } of booksToProcess) {
    console.log(`\n>>> Processing: "${book.title}" (${book.pageCount} pages) <<<`);
    const data = new Uint8Array(fs.readFileSync(book.filePath));
    const pdfDoc = await pdfjs.getDocument({ data }).promise;
    const totalPages = pdfDoc.numPages;

    const existingPages = new Set(
      db.bookTexts
        .filter((t) => t.bookId === book.id && t.textContent && t.textContent.trim().length > 10)
        .map((t) => t.pageNumber)
    );

    const pagesToOcr = [];
    for (let p = 1; p <= totalPages; p++) {
      if (!existingPages.has(p)) {
        pagesToOcr.push(p);
      }
    }

    console.log(`Pages already indexed: ${existingPages.size}, remaining to OCR: ${pagesToOcr.length}`);
    const BATCH_SIZE = 8;
    let processed = 0;

    for (let i = 0; i < pagesToOcr.length; i += BATCH_SIZE) {
      const batch = pagesToOcr.slice(i, i + BATCH_SIZE);
      const t0 = Date.now();

      await Promise.all(
        batch.map(async (pageNum, idx) => {
          try {
            // Check digital text first
            const page = await pdfDoc.getPage(pageNum);
            const content = await page.getTextContent();
            let text = content.items.map((it) => it.str).join(' ').trim();

            if (text.length <= 15) {
              // Run OCR on scanned image
              const imgBuffer = await extractPageImage(pdfDoc, pageNum);
              if (imgBuffer) {
                const worker = workers[idx % workers.length];
                const ret = await worker.recognize(imgBuffer);
                text = (ret.data.text || '').trim();
              }
            }

            if (text) {
              // Upsert into db.bookTexts
              const existingIdx = db.bookTexts.findIndex((t) => t.bookId === book.id && t.pageNumber === pageNum);
              const textRecord = {
                id: `txt_${book.id}_${pageNum}`,
                bookId: book.id,
                pageNumber: pageNum,
                textContent: text,
                normalizedText: normalizeArabicText(text),
              };
              if (existingIdx !== -1) {
                db.bookTexts[existingIdx] = textRecord;
              } else {
                db.bookTexts.push(textRecord);
              }
            }
          } catch (pageErr) {
            console.error(`Page ${pageNum} error:`, pageErr.message);
          }
        })
      );

      processed += batch.length;
      const elapsed = Date.now() - t0;
      const speed = (batch.length / (elapsed / 1000)).toFixed(1);
      console.log(`  [${book.title}]: ${processed}/${pagesToOcr.length} pages processed (${speed} pages/sec)`);

      // Periodic save every batch
      saveDb();
    }

    // Mark book as completed & OCR
    book.isOcr = true;
    book.ocrStatus = 'completed';
    book.status = 'ready';
    book.pageCount = totalPages;
    saveDb();
    console.log(`✓ Completed 100% indexing for: "${book.title}"`);
  }

  for (const w of workers) {
    await w.terminate();
  }

  console.log('\n=== ALL BOOKS SUCCESSFULLY INDEXED 100% ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
