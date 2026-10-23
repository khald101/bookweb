import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { parseBookFile } from '@/lib/parser';

import { seedInitialDataIfNeeded } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await seedInitialDataIfNeeded();
    const { searchParams } = new URL(req.url);
    const collectionId = searchParams.get('collectionId');
    const search = searchParams.get('search');
    const format = searchParams.get('format');

    let books = db.books.getAll();

    if (collectionId) {
      books = books.filter((b) => b.collectionId === collectionId);
    }

    if (format) {
      books = books.filter((b) => b.format === format);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      books = books.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ success: true, books });
  } catch (error: any) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const collectionId = formData.get('collectionId') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: 'لم يتم اختيار أي ملف' }, { status: 400 });
    }

    const uploadedBooks = [];
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'books');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const fileName = file.name;
      const extension = path.extname(fileName).toLowerCase().replace('.', '');
      
      const validFormats = ['pdf', 'epub', 'txt', 'docx'];
      if (!validFormats.includes(extension)) {
        continue; // Skip unsupported files with safety
      }

      const format = extension as 'pdf' | 'epub' | 'txt' | 'docx';
      const fileId = `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const savedFileName = `${fileId}.${format}`;
      const filePath = path.join(uploadDir, savedFileName);

      // Write file buffer to disk
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      fs.writeFileSync(filePath, buffer);

      // Default title from filename (removing extension)
      const baseTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      // Create initial book record
      const book = db.books.create({
        id: fileId,
        title: baseTitle,
        author: 'غير محدد',
        description: '',
        format,
        fileSize: file.size,
        fileName,
        filePath,
        collectionId: collectionId || null,
        pageCount: 1,
        status: 'processing',
        isOcr: false,
        ocrStatus: 'none',
      });

      // Process and extract text in background/immediate
      try {
        const extracted = await parseBookFile(filePath, format, book.id);
        
        // Save extracted page texts for instant search
        db.bookTexts.savePages(book.id, extracted.pages);

        // Update book with extracted metadata and cover
        db.books.update(book.id, {
          title: extracted.title && extracted.title.trim().length > 1 ? extracted.title : baseTitle,
          author: extracted.author && extracted.author.trim().length > 1 ? extracted.author : 'غير محدد',
          pageCount: extracted.pageCount,
          coverUrl: extracted.coverUrl,
          status: 'ready',
          isOcr: extracted.isScanned,
          ocrStatus: extracted.isScanned ? 'pending' : 'none',
        });
      } catch (parseError: any) {
        console.error(`Error parsing book ${fileName}:`, parseError);
        db.books.update(book.id, {
          status: 'ready', // Mark ready so user can still attempt viewing
          errorMessage: 'تم رفع الملف ولكن تعذر استخراج النص الكامل',
        });
      }

      const updated = db.books.getById(book.id);
      if (updated) uploadedBooks.push(updated);
    }

    return NextResponse.json({
      success: true,
      message: `تم رفع ومعالجة ${uploadedBooks.length} كتاب بنجاح`,
      books: uploadedBooks,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
