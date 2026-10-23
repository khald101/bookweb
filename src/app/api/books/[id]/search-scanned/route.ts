import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { searchOrIndexScannedBatch } from '@/lib/ocr-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const fromPage = parseInt(searchParams.get('from') || '1', 10);
    const batchSize = Math.min(24, Math.max(1, parseInt(searchParams.get('batchSize') || '12', 10)));

    const book = db.books.getById(id);
    if (!book) {
      return NextResponse.json({ success: false, error: 'الكتاب غير موجود' }, { status: 404 });
    }

    if (book.format !== 'pdf' || !book.filePath) {
      return NextResponse.json({ success: false, error: 'البحث الممسوح متاح لملفات PDF المصورة' }, { status: 400 });
    }

    const result = await searchOrIndexScannedBatch(
      id,
      book.filePath,
      query,
      fromPage,
      batchSize
    );

    return NextResponse.json({
      success: true,
      query,
      ...result,
    });
  } catch (error: any) {
    console.error('Error in search-scanned API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
