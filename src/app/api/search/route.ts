import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const collectionId = searchParams.get('collectionId') || undefined;

    if (!query || !query.trim()) {
      return NextResponse.json({ success: true, results: [], totalMatches: 0 });
    }

    const bookResults = db.bookTexts.searchGlobal(query.trim(), collectionId);
    const totalMatches = bookResults.reduce((acc, b) => acc + b.totalMatches, 0);

    return NextResponse.json({
      success: true,
      query: query.trim(),
      totalMatches,
      totalBooksWithMatches: bookResults.length,
      results: bookResults,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
