import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = db.highlights.update(id, {
      ...(body.categoryId && { categoryId: body.categoryId }),
      ...(body.text && { text: body.text.trim() }),
      ...(body.note !== undefined && { note: body.note }),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'التظليل غير موجود' }, { status: 404 });
    }

    const enriched = db.highlights.getAll().find((h) => h.id === id);
    return NextResponse.json({ success: true, highlight: enriched || updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = db.highlights.delete(id);

    if (!success) {
      return NextResponse.json({ success: false, error: 'التظليل غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'تم إزالة التظليل بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
