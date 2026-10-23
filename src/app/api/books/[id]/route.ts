import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const book = db.books.getById(id);

    if (!book) {
      return NextResponse.json({ success: false, error: 'الكتاب غير موجود' }, { status: 404 });
    }

    const pages = db.bookTexts.getAllPages(id);
    const highlights = db.highlights.getByBook(id);
    const bookmarks = db.bookmarks.getByBook(id);
    const notes = db.notes.getByBook(id);
    const progress = db.progress.get(id);

    return NextResponse.json({
      success: true,
      book,
      pages,
      highlights,
      bookmarks,
      notes,
      progress,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = db.books.update(id, {
      title: body.title,
      author: body.author,
      description: body.description,
      collectionId: body.collectionId,
      coverUrl: body.coverUrl,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'الكتاب غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, book: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = db.books.delete(id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'تعذر حذف الكتاب أو أنه غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'تم حذف الكتاب وجميع بياناته المرتبطة بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
