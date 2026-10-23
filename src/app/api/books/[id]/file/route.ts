import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const book = db.books.getById(id);

    if (!book || !fs.existsSync(book.filePath)) {
      return new NextResponse('الملف غير موجود', { status: 404 });
    }

    const stat = fs.statSync(book.filePath);
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
      const fileStream = fs.createReadStream(book.filePath, { start, end });

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

    const fileStream = fs.createReadStream(book.filePath);
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
        'Content-Disposition': `inline; filename="${encodeURIComponent(book.fileName)}"`,
      },
    });
  } catch (error: any) {
    console.error('File stream error:', error);
    return new NextResponse('خطأ في قراءة الملف', { status: 500 });
  }
}
