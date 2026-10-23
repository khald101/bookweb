import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query || !query.trim()) {
      return NextResponse.json({ success: true, results: [], totalMatches: 0 });
    }

    const results = db.bookTexts.searchInBook(id, query.trim());
    const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);

    return NextResponse.json({
      success: true,
      query: query.trim(),
      totalMatches,
      pageCountWithMatches: results.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
