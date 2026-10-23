import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const collections = db.collections.getAll();
    return NextResponse.json({ success: true, collections });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'اسم المجموعة مطلوب' }, { status: 400 });
    }

    const col = db.collections.create({
      name: body.name.trim(),
      description: body.description?.trim(),
      color: body.color || '#6366f1',
      icon: body.icon || 'folder',
    });

    return NextResponse.json({ success: true, collection: col });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
