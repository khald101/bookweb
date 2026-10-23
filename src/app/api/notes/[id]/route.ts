import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = db.notes.update(id, {
      text: body.text,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'الملاحظة غير موجودة' }, { status: 404 });
    }

    const enriched = db.notes.getAll().find((n) => n.id === id);
    return NextResponse.json({ success: true, note: enriched || updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = db.notes.delete(id);

    if (!success) {
      return NextResponse.json({ success: false, error: 'الملاحظة غير موجودة' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'تم حذف الملاحظة بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
