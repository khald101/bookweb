import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId');

    let bookmarks = db.bookmarks.getAll();
    if (bookId) {
      bookmarks = bookmarks.filter((b) => b.bookId === bookId);
    }

    return NextResponse.json({ success: true, bookmarks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.bookId || !body.pageNumber) {
      return NextResponse.json({ success: false, error: 'معرف الكتاب ورقم الصفحة مطلوبان' }, { status: 400 });
    }

    const bookmark = db.bookmarks.create({
      bookId: body.bookId,
      pageNumber: body.pageNumber,
      positionData: body.positionData || {},
      title: body.title?.trim() || `علامة - صفحة ${body.pageNumber}`,
      textSnippet: body.textSnippet?.trim() || '',
    });

    const enriched = db.bookmarks.getAll().find((b) => b.id === bookmark.id);
    return NextResponse.json({ success: true, bookmark: enriched || bookmark });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
