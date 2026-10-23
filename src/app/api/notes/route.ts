import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId');
    const search = searchParams.get('search');

    let notes = db.notes.getAll();
    if (bookId) {
      notes = notes.filter((n) => n.bookId === bookId);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      notes = notes.filter(
        (n) =>
          n.text.toLowerCase().includes(q) ||
          (n.snippet && n.snippet.toLowerCase().includes(q)) ||
          (n.bookTitle && n.bookTitle.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({ success: true, notes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.bookId || !body.text || !body.text.trim()) {
      return NextResponse.json({ success: false, error: 'معرف الكتاب ونص الملاحظة مطلوبان' }, { status: 400 });
    }

    const note = db.notes.create({
      bookId: body.bookId,
      pageNumber: body.pageNumber || 1,
      text: body.text.trim(),
      snippet: body.snippet?.trim() || '',
      highlightId: body.highlightId || null,
    });

    const enriched = db.notes.getAll().find((n) => n.id === note.id);
    return NextResponse.json({ success: true, note: enriched || note });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
