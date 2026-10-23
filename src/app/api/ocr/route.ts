import { NextRequest, NextResponse } from 'next/server';
import { runOcrOnBook } from '@/lib/parser';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId, language } = body;

    if (!bookId) {
      return NextResponse.json({ success: false, error: 'معرف الكتاب مطلوب' }, { status: 400 });
    }

    // Trigger OCR process
    runOcrOnBook(bookId, language || 'ara+eng').catch((err) => {
      console.error('Background OCR error:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'بدأت عملية التعرف الضوئي على النص (OCR) في الخلفية بنجاح',
      status: 'processing',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
