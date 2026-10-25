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

    const { bookResults, highlightsResults, notesResults } = db.bookTexts.searchGlobal(query.trim(), collectionId);
    const totalBookMatches = bookResults.reduce((acc, b) => acc + b.totalMatches, 0);
    const totalMatches = totalBookMatches + highlightsResults.length + notesResults.length;

    return NextResponse.json({
      success: true,
      query: query.trim(),
      totalMatches,
      totalBookMatches,
      totalBooksWithMatches: bookResults.length,
      results: bookResults,
      highlightsResults,
      notesResults,
      totalHighlightMatches: highlightsResults.length,
      totalNoteMatches: notesResults.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
