import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const progress = db.progress.get(id);
    return NextResponse.json({ success: true, progress: progress || null });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const progress = db.progress.save(id, {
      currentPage: body.currentPage || 1,
      totalPages: body.totalPages || 1,
      lastPosition: body.lastPosition,
    });

    return NextResponse.json({ success: true, progress });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
