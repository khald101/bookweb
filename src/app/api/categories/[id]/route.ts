import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = db.categories.update(id, {
      name: body.name,
      colorHex: body.colorHex,
      description: body.description,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'التصنيف غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const reassignTo = searchParams.get('reassignTo') || undefined;

    const result = db.categories.delete(id, reassignTo);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'تعذر حذف التصنيف' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `تم حذف التصنيف بنجاح وإعادة تعيين ${result.reassignedCount} تظليل دون فقدانها`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
