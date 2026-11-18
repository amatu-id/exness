// amatu-pasar — small public market-data proxy for Amatu Trade (amatu-id.github.io/exness).
// The weekly economic calendar JSON has no CORS header, so the page cannot read it directly.
//
//   GET …/amatu-pasar/kalender   → { t, events: [{ title, country, date, impact, forecast, previous, actual }] }
//
// Read-only, no secrets, cached 15 minutes per instance.
// Deploy: cd deploy-exness/cloud && supabase functions deploy amatu-pasar --project-ref ieyqxmzztoxgpvwexbkj --no-verify-jwt --use-api

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const out = (o: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });

type Ev = { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string; actual?: string };
let cache: { t: number; events: Ev[] } | null = null;

async function kalender() {
  if (cache && Date.now() - cache.t < 15 * 60_000) return cache;
  const r = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; AmatuTrade/1.0)' } });
  if (!r.ok) { if (cache) return cache; throw new Error('upstream ' + r.status); }
  const raw = await r.json() as Ev[];
  const events = raw.filter((e) => e && e.title && e.date).map((e) => ({
    title: String(e.title).slice(0, 120), country: String(e.country || '').slice(0, 4), date: e.date,
    impact: ['High', 'Medium', 'Low', 'Holiday'].includes(e.impact) ? e.impact : 'Low',
    forecast: String(e.forecast || '').slice(0, 20), previous: String(e.previous || '').slice(0, 20), actual: String(e.actual || '').slice(0, 20),
  })).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  cache = { t: Date.now(), events };
  return cache;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const path = new URL(req.url).pathname.replace(/^.*\/amatu-pasar/, '') || '/';
  try {
    if (path === '/kalender') return out(await kalender(), 200, { 'Cache-Control': 'public, max-age=300' });
    if (path === '/' || path === '/status') return out({ ok: true, routes: ['/kalender'] });
    return out({ error: 'not found' }, 404);
  } catch (e) {
    return out({ error: String((e as Error).message || e) }, 502);
  }
});
