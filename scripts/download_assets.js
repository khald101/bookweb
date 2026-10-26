const fs = require('fs');
const path = require('path');
const https = require('https');

const booksDir = path.join(__dirname, '..', 'public', 'uploads', 'books');
if (!fs.existsSync(booksDir)) {
  fs.mkdirSync(booksDir, { recursive: true });
}

const targetFile = path.join(booksDir, 'book_1792770013725_5q82v.pdf');
const downloadUrl = 'https://github.com/khald101/bookweb/releases/download/v1.0.0/book_1792770013725_5q82v.pdf';

if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 100000000) {
  console.log('[Assets] Book 8 already exists on disk, skipping download.');
  process.exit(0);
}

console.log('[Assets] Downloading Book 8 (104MB) from GitHub Releases...');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Follow redirect safely
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log('[Assets] Book 8 downloaded successfully!');
          resolve();
        });
      });
      file.on('error', (err) => {
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(err);
      });
    }).on('error', (err) => {
      try { fs.unlinkSync(dest); } catch (e) {}
      reject(err);
    });
  });
}

download(downloadUrl, targetFile)
  .then(() => process.exit(0))
  .catch((err) => {
    console.warn('[Assets] Download warning (fallback CDN available):', err.message);
    process.exit(0);
  });
