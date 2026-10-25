import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { locateSearchBoxOnPage } from '@/lib/ocr-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!query || !query.trim()) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 });
    }

    const book = db.books.getById(id);
    if (!book) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }

    const box = await locateSearchBoxOnPage(id, book.filePath, page, query.trim());

    if (!box) {
      return NextResponse.json({ success: false, message: 'No match found on this page' });
    }

    return NextResponse.json({
      success: true,
      query: query.trim(),
      page,
      box,
    });
  } catch (error: any) {
    console.error('Error locating search box:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
