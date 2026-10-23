import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { pageNumber, textContent } = await req.json();

    if (!pageNumber || typeof textContent !== 'string') {
      return NextResponse.json({ success: false, error: 'بيانات غير صالحة' }, { status: 400 });
    }

    db.bookTexts.saveSinglePage(id, Number(pageNumber), textContent);

    return NextResponse.json({
      success: true,
      message: 'تم حفظ نص الصفحة المستخرج وفهرسته بنجاح',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
