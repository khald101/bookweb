import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ocrImageBuffer, ocrPdfBox } from '@/lib/ocr-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, bookId, pageNumber, box, highlightId } = body;

    let recognizedText = '';

    // 1. If direct imageBase64 is passed (from reader client canvas crop)
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      recognizedText = await ocrImageBuffer(buffer);
    }
    // 2. Or if bookId, pageNumber and box are passed (from server PDF extraction)
    else if (bookId && pageNumber && box) {
      const book = db.books.getById(bookId);
      if (book && book.filePath) {
        recognizedText = await ocrPdfBox(book.filePath, Number(pageNumber), box);
      }
    }

    recognizedText = recognizedText.replace(/\s+/g, ' ').trim();

    // 3. If highlightId was provided, update the highlight in DB directly
    if (highlightId && recognizedText) {
      db.highlights.update(highlightId, { text: recognizedText });
    }

    return NextResponse.json({
      success: true,
      text: recognizedText,
    });
  } catch (error: any) {
    console.error('OCR Box API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
