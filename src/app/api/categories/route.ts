import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = db.categories.getAll();
    const highlights = db.highlights.getAll();

    // Attach usage count to each category
    const countMap = new Map<string, number>();
    highlights.forEach((h) => {
      countMap.set(h.categoryId, (countMap.get(h.categoryId) || 0) + 1);
    });

    const enriched = categories.map((c) => ({
      ...c,
      usageCount: countMap.get(c.id) || 0,
    }));

    return NextResponse.json({ success: true, categories: enriched });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'اسم التصنيف مطلوب' }, { status: 400 });
    }
    if (!body.colorHex || !body.colorHex.trim()) {
      return NextResponse.json({ success: false, error: 'رمز اللون مطلوب' }, { status: 400 });
    }

    const newCategory = db.categories.create({
      name: body.name.trim(),
      colorHex: body.colorHex.trim(),
      description: body.description?.trim(),
    });

    return NextResponse.json({ success: true, category: newCategory });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
