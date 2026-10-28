export function cleanText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

export function researchQuery(objective) {
  return objective.replace(/^(please\s+)?(research|find out about|look up|tell me about|investigate|summarize)\s+/i,'').replace(/[?.!]+$/,'').trim().slice(0,180);
}

export async function research(query, options={}) {
  if (options.fixture) {
    if (options.fixtureDelayMs) await new Promise(resolve=>setTimeout(resolve,options.fixtureDelayMs));
    return { summary:'Fixture research result for local verification.', sources:[{title:'Local test fixture',url:'https://example.org/fixture',excerpt:'Local test fixture'}] };
  }
  const endpoint = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'BuildBotResearchPilot/0.1 (local development)'}});
  if (!response.ok) throw new Error(`Research source returned HTTP ${response.status}`);
  const json = await response.json();
  const sources = (json.query?.search || []).map(row=>({
    title:cleanText(row.title),
    url:`https://en.wikipedia.org/wiki/${encodeURIComponent(row.title.replaceAll(' ','_'))}`,
    excerpt:cleanText(row.snippet)
  })).filter(row=>row.title && row.excerpt);
  if (!sources.length) return {summary:'No source matches were found. Try a more specific topic.',sources:[]};
  return {summary:sources.slice(0,3).map((s,i)=>`${i+1}. ${s.title}: ${s.excerpt}`).join('\n'),sources};
}
