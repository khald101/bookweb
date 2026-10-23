import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId');
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');

    let highlights = db.highlights.getAll();

    if (bookId) {
      highlights = highlights.filter((h) => h.bookId === bookId);
    }

    if (categoryId) {
      highlights = highlights.filter((h) => h.categoryId === categoryId);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      highlights = highlights.filter(
        (h) =>
          h.text.toLowerCase().includes(q) ||
          (h.note && h.note.toLowerCase().includes(q)) ||
          (h.category && h.category.name.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({ success: true, highlights });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.bookId || !body.text || !body.categoryId) {
      return NextResponse.json(
        { success: false, error: 'البيانات غير مكتملة (الكتاب، النص، وتصنيف اللون مطلوبان)' },
        { status: 400 }
      );
    }

    const newHighlight = db.highlights.create({
      bookId: body.bookId,
      categoryId: body.categoryId,
      pageNumber: body.pageNumber || 1,
      text: body.text.trim(),
      positionData: body.positionData || {},
      note: body.note?.trim() || null,
    });

    // If an initial note was supplied, also create a note record linked to this highlight
    if (body.note && body.note.trim()) {
      db.notes.create({
        bookId: body.bookId,
        pageNumber: body.pageNumber || 1,
        text: body.note.trim(),
        snippet: body.text.trim(),
        highlightId: newHighlight.id,
      });
    }

    const enriched = db.highlights.getAll().find((h) => h.id === newHighlight.id);

    return NextResponse.json({ success: true, highlight: enriched || newHighlight });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
