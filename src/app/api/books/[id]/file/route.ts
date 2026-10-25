import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const book = db.books.getById(id);

    if (!book) {
      return new NextResponse('الكتاب غير موجود', { status: 404 });
    }

    // Resolve actual file path across local and cloud environments
    const baseName = path.basename(book.filePath || '');
    const candidates = [
      book.filePath ? path.resolve(process.cwd(), book.filePath) : null,
      path.join(process.cwd(), 'public', 'uploads', 'books', `${book.id}.${book.format}`),
      baseName ? path.join(process.cwd(), 'public', 'uploads', 'books', baseName) : null,
      book.filePath,
      path.join(process.cwd(), 'uploads', 'books', `${book.id}.${book.format}`),
    ].filter(Boolean) as string[];

    // If file exists in public/uploads/books, redirect immediately for native 206 range streaming (40ms)
    const publicStaticPath = path.join(process.cwd(), 'public', 'uploads', 'books', `${book.id}.${book.format}`);
    if (fs.existsSync(publicStaticPath)) {
      return NextResponse.redirect(new URL(`/uploads/books/${book.id}.${book.format}`, req.url), { status: 307 });
    }

    let resolvedPath = candidates.find((p) => fs.existsSync(p));

    // Fallback: If 104MB Book 8 is not yet on local disk, redirect to GitHub Release CDN
    if (!resolvedPath) {
      if (book.id === 'book_1792770013725_5q82v' || baseName.includes('5q82v')) {
        const releaseUrl = 'https://github.com/khald101/bookweb/releases/download/v1.0.0/book_1792770013725_5q82v.pdf';
        return NextResponse.redirect(releaseUrl, { status: 307 });
      }
      console.error('[File Route] File not found for candidates:', candidates);
      return new NextResponse('الملف غير موجود على السيرفر', { status: 404 });
    }

    const stat = fs.statSync(resolvedPath);
    const fileSize = stat.size;
    const range = req.headers.get('range');

    let contentType = 'application/octet-stream';
    if (book.format === 'pdf') contentType = 'application/pdf';
    else if (book.format === 'epub') contentType = 'application/epub+zip';
    else if (book.format === 'txt') contentType = 'text/plain; charset=utf-8';
    else if (book.format === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    if (range) {
      // RFC 7233 range parsing: bytes=start-end, bytes=start-, or bytes=-suffix
      const rangeMatch = range.match(/bytes=(\d*)-(\d*)/);
      if (rangeMatch) {
        let start: number;
        let end: number;

        if (rangeMatch[1] === '' && rangeMatch[2] !== '') {
          // Suffix byte range (e.g. bytes=-65536) used heavily by PDF.js to read xref
          const suffix = parseInt(rangeMatch[2], 10);
          start = Math.max(0, fileSize - suffix);
          end = fileSize - 1;
        } else if (rangeMatch[1] !== '' && rangeMatch[2] === '') {
          // Open-ended range (e.g. bytes=1024-)
          start = parseInt(rangeMatch[1], 10);
          end = fileSize - 1;
        } else if (rangeMatch[1] !== '' && rangeMatch[2] !== '') {
          // Standard range (e.g. bytes=0-1024)
          start = parseInt(rangeMatch[1], 10);
          end = Math.min(fileSize - 1, parseInt(rangeMatch[2], 10));
        } else {
          start = 0;
          end = fileSize - 1;
        }

        if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
          return new NextResponse(null, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`,
              'Accept-Ranges': 'bytes',
            },
          });
        }

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(resolvedPath, { start, end });

        const stream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => controller.enqueue(chunk));
            fileStream.on('end', () => controller.close());
            fileStream.on('error', (err) => controller.error(err));
          },
        });

        return new NextResponse(stream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': contentType,
          },
        });
      }
    }

    const fileStream = fs.createReadStream(resolvedPath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(book.fileName || baseName)}"`,
      },
    });
  } catch (error: any) {
    console.error('File stream error:', error);
    return new NextResponse('خطأ في قراءة الملف', { status: 500 });
  }
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const book = db.books.getById(id);
    if (!book) return new NextResponse(null, { status: 404 });

    const baseName = path.basename(book.filePath || '');
    const candidates = [
      book.filePath ? path.resolve(process.cwd(), book.filePath) : null,
      path.join(process.cwd(), 'public', 'uploads', 'books', `${book.id}.${book.format}`),
      baseName ? path.join(process.cwd(), 'public', 'uploads', 'books', baseName) : null,
      book.filePath,
      path.join(process.cwd(), 'uploads', 'books', `${book.id}.${book.format}`),
    ].filter(Boolean) as string[];

    const resolvedPath = candidates.find((p) => fs.existsSync(p));
    if (!resolvedPath) return new NextResponse(null, { status: 404 });

    const stat = fs.statSync(resolvedPath);
    let contentType = 'application/octet-stream';
    if (book.format === 'pdf') contentType = 'application/pdf';
    else if (book.format === 'epub') contentType = 'application/epub+zip';
    else if (book.format === 'txt') contentType = 'text/plain; charset=utf-8';

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Length': stat.size.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
