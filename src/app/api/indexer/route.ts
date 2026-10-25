import { NextRequest, NextResponse } from 'next/server';
import { autoIndexer } from '@/lib/indexer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = autoIndexer.getStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const count = autoIndexer.enqueueAllUnindexed();
    const status = autoIndexer.getStatus();
    return NextResponse.json({
      success: true,
      message: `تم بدء الفهرسة التلقائية لـ ${count} كتاب في الخلفية بسرعة فائقة`,
      enqueuedCount: count,
      ...status,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
