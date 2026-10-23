import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = db.bookmarks.delete(id);

    if (!success) {
      return NextResponse.json({ success: false, error: 'العلامة المرجعية غير موجودة' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'تم حذف العلامة المرجعية بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
