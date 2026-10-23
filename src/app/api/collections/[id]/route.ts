import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = db.collections.update(id, {
      name: body.name,
      description: body.description,
      color: body.color,
      icon: body.icon,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'المجموعة غير موجودة' }, { status: 404 });
    }

    return NextResponse.json({ success: true, collection: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = db.collections.delete(id);

    if (!success) {
      return NextResponse.json({ success: false, error: 'المجموعة غير موجودة' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'تم حذف المجموعة بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
