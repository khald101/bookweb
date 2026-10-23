import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { searchOrIndexScannedBatch } from '@/lib/ocr-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const fromPage = parseInt(body.from || '1', 10);
    const batchSize = Math.min(24, Math.max(1, parseInt(body.batchSize || '16', 10)));

    const book = db.books.getById(id);
    if (!book) {
      return NextResponse.json({ success: false, error: 'الكتاب غير موجود' }, { status: 404 });
    }

    if (book.format !== 'pdf' || !book.filePath) {
      return NextResponse.json({ success: false, error: 'الفهرسة متاحة لملفات PDF' }, { status: 400 });
    }

    const result = await searchOrIndexScannedBatch(
      id,
      book.filePath,
      '', // No search query, just index
      fromPage,
      batchSize
    );

    // Get current total indexed count
    const allPages = db.bookTexts.getAllPages(id);
    const indexedCount = allPages.filter((p) => p.textContent && p.textContent.trim().length > 10).length;

    return NextResponse.json({
      success: true,
      ...result,
      indexedCount,
      percentIndexed: Math.round((indexedCount / result.totalPages) * 100),
    });
  } catch (error: any) {
    console.error('Error in index-scanned API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
