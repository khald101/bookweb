async function run() {
  const query = 'يافع';
  const res = await fetch('http://localhost:3000/api/search?q=' + encodeURIComponent(query));
  const data = await res.json();
  console.log(`Query: "${query}"`);
  console.log(`Total Matches: ${data.totalMatches}`);
  console.log(`Books with Matches: ${data.totalBooksWithMatches}`);
  for (const b of data.results || []) {
    console.log(`  - ${b.book.title.substring(0, 35)}: ${b.totalMatches} matches`);
  }

  const query2 = 'الخالدي';
  const res2 = await fetch('http://localhost:3000/api/search?q=' + encodeURIComponent(query2));
  const data2 = await res2.json();
  console.log(`\nQuery: "${query2}"`);
  console.log(`Total Matches: ${data2.totalMatches}`);
  console.log(`Books with Matches: ${data2.totalBooksWithMatches}`);
}

run();
