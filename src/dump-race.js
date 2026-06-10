import fs from 'node:fs/promises';
import { config } from './config.js';

function todayYyyyMmDd(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}${get('month')}${get('day')}`;
}

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<\/th>/gi, ' | ')
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 220)
    .join('\n');
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

const track = (process.argv[2] || config.data.trackCodes[0] || 'CT').toUpperCase();
const raceNum = String(process.argv[3] || '1').padStart(2, '0');
const date = process.argv[4] || todayYyyyMmDd(config.timezone);
const url = `https://mobile.equibase.com/html/entries${track}${date}${raceNum}.html`;
console.log(`Fetching ${url}`);
const html = await fetchText(url);
await fs.writeFile('/tmp/equibase-race.html', html);
console.log('Saved raw HTML to /tmp/equibase-race.html');
console.log('\n=== FIRST VISIBLE LINES ===');
console.log(htmlToText(html));
