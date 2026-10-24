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
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(resolvedPath, { start, end });

      // Convert Node readable stream to Web ReadableStream
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
