import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { config } from './config.js';
import { filterRacesForPosting } from './time-filter.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOdds(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 99;
  if (/^\d+\/\d+$/.test(raw)) {
    const [a, b] = raw.split('/').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }
  if (/even/i.test(raw)) return 1;
  return toNumber(raw, 99);
}

function todayMmDdYy(timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('month')}${get('day')}${get('year')}`;
}

function todayIso(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToLines(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/td>/gi, ' | ')
      .replace(/<\/th>/gi, ' | ')
      .replace(/<\/p>|<\/div>|<\/tr>|<\/li>|<\/h\d>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractTrackName(html, fallbackCode) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) {
    const clean = decodeHtml(title).replace(/Entries.*$/i, '').replace(/\|.*$/, '').trim();
    if (clean) return clean;
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return decodeHtml(h1).replace(/Entries.*$/i, '').trim() || fallbackCode;
  return fallbackCode;
}

function estimateRatings(horse, race, index) {
  const odds = horse.oddsDecimal;
  const oddsScore = Math.max(45, 92 - odds * 3.2);
  const postBoost = Math.max(0, 6 - Math.abs((index + 1) - Math.min(5, race.horses.length / 2)));
  return {
    speedFigure: Math.round(oddsScore + postBoost),
    recentForm: Math.round(oddsScore - 2),
    jockeyWinPct: 10,
    trainerWinPct: 10,
    classRating: Math.round(oddsScore - 1),
    paceRating: Math.round(oddsScore + postBoost / 2)
  };
}

function parseEquibaseHtml(html, trackCode, sourceUrl = '') {
  const lines = htmlToLines(html);
  const track = extractTrackName(html, trackCode);
  const date = todayIso(config.timezone);
  const races = [];
  let current = null;

  for (const line of lines) {
    const raceMatch = line.match(/^Race\s+(\d+)\b/i) || line.match(/\bRace:\s*(\d+)\b/i) || line.match(/^\|?\s*(\d{1,2})\s*\|\s*\$/);
    if (raceMatch) {
      if (current?.horses?.length >= 2) races.push(current);
      current = {
        date,
        track,
        trackCode,
        race: Number(raceMatch[1]),
        postTime: line.match(/Post(?:\s+Time)?:?\s*([^|]+?)(?:\s{2,}|\||$)/i)?.[1]?.trim() || line.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?\s*(?:ET|CT|MT|PT)?)/i)?.[1] || '',
        surface: line.match(/\b(Dirt|Turf|Synthetic|All Weather)\b/i)?.[1] || '',
        distance: line.match(/(\d+\s*(?:furlongs?|miles?)|[\d.]+\s*(?:f|m))/i)?.[1] || '',
        sourceUrl,
        horses: []
      };
      continue;
    }

    if (!current) continue;

    // Common Equibase text has lines like:
    // 1 Horse Name ... Jockey: A Rider Trainer: B Trainer Morning Line: 5/2
    // or table text with pipes after stripping HTML.
    const horseMatch = line.match(/^\s*(\d{1,2}[A-Z]?)\s+(.+?)(?:\s+\([A-Z]{2,3}\)|\s+Jockey:|\s+Trainer:|\s+Morning Line:|\s+\|\s+|$)/i);
    if (!horseMatch) continue;

    const programNumber = horseMatch[1];
    const name = horseMatch[2]
      .replace(/^(PPs|All Products|Free Tools|Entries Plus|Smart Pick|Pocket PPs)\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name || name.length < 2 || /^(Race|Go to Race|Index|Home|Purse|Distance)$/i.test(name)) continue;
    if (current.horses.some((h) => h.programNumber === programNumber)) continue;

    const morningLine = line.match(/Morning\s+Line:?\s*([0-9]+\/[0-9]+|Even|[0-9.]+)/i)?.[1]
      || line.match(/\|\s*([0-9]+\/[0-9]+|Even)\s*(?:\||$)/i)?.[1]
      || '';
    const jockey = line.match(/Jockey:?\s*(.+?)(?:\s+Trainer:|\s+Owner:|\s+Breeder:|\s+Morning Line:|$)/i)?.[1]?.trim() || '';
    const trainer = line.match(/Trainer:?\s*(.+?)(?:\s+Owner:|\s+Breeder:|\s+Morning Line:|$)/i)?.[1]?.trim() || '';

    current.horses.push({
      programNumber,
      name,
      jockey,
      trainer,
      morningLine,
      oddsDecimal: parseOdds(morningLine),
      speedFigure: 70,
      recentForm: 70,
      jockeyWinPct: 10,
      trainerWinPct: 10,
      classRating: 70,
      paceRating: 70
    });
  }

  if (current?.horses?.length >= 2) races.push(current);

  for (const race of races) {
    race.horses = race.horses.map((horse, index) => ({
      ...horse,
      ...estimateRatings(horse, race, index)
    }));
  }

  return races;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

export async function loadRacesFromCsv(csvPath = config.data.raceCsvPath) {
  const file = await fs.readFile(csvPath, 'utf8');
  const rows = parse(file, { columns: true, skip_empty_lines: true, trim: true });
  const grouped = new Map();

  for (const row of rows) {
    const key = `${row.date || 'today'}|${row.track}|${row.race}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        date: row.date || 'today',
        track: row.track,
        trackCode: row.track_code || '',
        race: Number(row.race),
        postTime: row.post_time || '',
        surface: row.surface || '',
        distance: row.distance || '',
        horses: []
      });
    }

    grouped.get(key).horses.push({
      programNumber: String(row.program_number || row.number || '').trim(),
      name: row.horse || row.name || 'Unknown Horse',
      jockey: row.jockey || '',
      trainer: row.trainer || '',
      morningLine: row.morning_line || row.odds || '',
      oddsDecimal: parseOdds(row.morning_line || row.odds),
      speedFigure: toNumber(row.speed_figure, 70),
      recentForm: toNumber(row.recent_form, 70),
      jockeyWinPct: toNumber(row.jockey_win_pct, 10),
      trainerWinPct: toNumber(row.trainer_win_pct, 10),
      classRating: toNumber(row.class_rating, 70),
      paceRating: toNumber(row.pace_rating, 70)
    });
  }

  return [...grouped.values()].filter((race) => race.horses.length >= 2);
}

export async function loadRacesFromPublicCsvUrl(url = config.data.publicCsvUrl) {
  if (!url) return [];
  const csv = await fetchText(url);
  const tmpPath = '/tmp/horse-racing-public.csv';
  await fs.writeFile(tmpPath, csv);
  return loadRacesFromCsv(tmpPath);
}

async function discoverEquibaseTodayUrls(dateCode) {
  if (!config.data.autoDiscoverTracks) return [];
  try {
    const indexUrl = 'https://www.equibase.com/static/entry/index.html';
    const html = await fetchText(indexUrl);
    const urls = new Set();
    const re = new RegExp(`RaceCardIndex([A-Z0-9]+)${dateCode}USA-EQB\\.html`, 'g');
    let match;
    while ((match = re.exec(html))) {
      urls.add(`https://www.equibase.com/static/entry/RaceCardIndex${match[1]}${dateCode}USA-EQB.html`);
    }
    console.log(`Discovered ${urls.size} Equibase race-card URLs for today.`);
    return [...urls];
  } catch (error) {
    console.warn(`Could not auto-discover Equibase tracks: ${error.message}`);
    return [];
  }
}

function configuredEquibaseUrls(dateCode) {
  return config.data.trackCodes.flatMap((trackCode) => [
    `https://www.equibase.com/static/entry/RaceCardIndex${trackCode}${dateCode}USA-EQB.html`,
    `https://www.equibase.com/static/entry/${trackCode}${dateCode}USA-EQB.html`
  ]);
}

export async function loadRacesFromEquibase() {
  const dateCode = todayMmDdYy(config.timezone);
  const allRaces = [];
  const urls = [...new Set([...(await discoverEquibaseTodayUrls(dateCode)), ...configuredEquibaseUrls(dateCode)])];

  for (const url of urls) {
    const trackCode = url.match(/RaceCardIndex([A-Z0-9]+)\d{6}USA-EQB\.html/i)?.[1]
      || url.match(/\/([A-Z0-9]+)\d{6}USA-EQB\.html/i)?.[1]
      || 'UNK';
    try {
      console.log(`Fetching ${url}`);
      const html = await fetchText(url);
      const races = parseEquibaseHtml(html, trackCode, url);
      if (!races.length) console.warn(`Fetched ${trackCode}, but parsed 0 races from that page.`);
      allRaces.push(...races);
    } catch (error) {
      console.warn(`Could not fetch ${trackCode}: ${error.message}`);
    }
  }

  const deduped = new Map();
  for (const race of allRaces) {
    deduped.set(`${race.trackCode || race.track}|${race.race}`, race);
  }
  return [...deduped.values()];
}

export async function loadRawRaces() {
  let races = [];

  if (config.data.source === 'csv') {
    races = await loadRacesFromCsv();
  } else if (config.data.source === 'public_csv_url') {
    races = await loadRacesFromPublicCsvUrl();
  } else {
    races = await loadRacesFromEquibase();
    if (!races.length && config.data.fallbackToCsv) {
      console.warn('No public-source races found. Falling back to CSV.');
      races = await loadRacesFromCsv();
    }
  }

  console.log(`Loaded ${races.length} raw races from ${config.data.source}.`);
  return races;
}

export async function getTodayRaces() {
  const races = await loadRawRaces();
  const filtered = filterRacesForPosting(races);
  console.log(`After today/upcoming filters: ${filtered.length} races.`);
  if (!filtered.length && races.length) {
    console.log('Loaded races were filtered out. Check date, post_time, TIMEZONE, TRACK_CODES, and POST_TIME_GRACE_MINUTES.');
  }
  return filtered;
}
