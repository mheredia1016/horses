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
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: '2-digit', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('month')}${get('day')}${get('year')}`;
}

function todayYyyyMmDd(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}${get('month')}${get('day')}`;
}

function todayIso(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function decodeHtml(value) {
  // Preserve newlines here. Collapsing all whitespace before split() was turning
  // the entire mobile Equibase page into one long line, which made horse rows
  // impossible to parse even when race pages were fetched correctly.
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/\r/g, '')
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

function cleanHorseName(value) {
  return decodeHtml(value)
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/^\d+[A-Z]?\s+/, '')
    .trim();
}

function parseProgramOddsLine(line) {
  return line.match(/Program:\s*([0-9A-Z]+).*?Post:\s*([0-9A-Z]+).*?Odds:\s*([^|]+)/i)
    || line.match(/^([0-9A-Z]+)\s+.*?Odds:\s*([^|]+)/i);
}

function parseMobileRacePage(html, trackCode, sourceUrl) {
  const lines = htmlToLines(html);
  const joined = lines.join('\n');
  const track = lines.find((line) => !/EQUIBASE|source|-----|Image:|entries/i.test(line) && line.length > 2) || trackCode;

  const dateLine = lines.find((line) => /\d{1,2}\/\d{1,2}\/\d{4}.*Race\s+\d+/i.test(line))
    || joined.match(/\d{1,2}\/\d{1,2}\/\d{4}[\s\S]{0,40}?Race\s+\d+/i)?.[0]
    || '';
  const raceNum = Number(dateLine.match(/Race\s+(\d+)/i)?.[1] || sourceUrl.match(/(\d{2})\.html$/)?.[1] || 0);
  const dateMatch = dateLine.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const date = dateMatch ? `${dateMatch[3]}-${String(dateMatch[1]).padStart(2, '0')}-${String(dateMatch[2]).padStart(2, '0')}` : todayIso(config.timezone);

  const postTime = (joined.match(/Post Time:\s*([^\n|<]+)/i)?.[1] || '').trim();
  const raceType = (joined.match(/Race Type:\s*([^\n|<]+)/i)?.[1] || lines[lines.findIndex((line) => /^Post Time:/i.test(line)) + 1] || '').trim();

  if (!raceNum) return null;

  const race = {
    date,
    track,
    trackCode,
    race: raceNum,
    postTime,
    surface: '',
    distance: raceType,
    sourceUrl,
    horses: []
  };

  // Primary parser for current mobile Equibase text output. It looks for a
  // Program/Post/Odds row and then scans the next few visible lines for the
  // horse name, jockey, and trainer.
  for (let i = 0; i < lines.length; i += 1) {
    const m = parseProgramOddsLine(lines[i]);
    if (!m) continue;
    const programNumber = m[1];
    const morningLine = (m[3] || m[2] || '').trim();

    let name = '';
    let jockey = '';
    let trainer = '';

    for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
      const line = lines[j];
      if (parseProgramOddsLine(line)) break;
      if (/^Jockey:/i.test(line)) jockey = line.replace(/^Jockey:\s*/i, '').trim();
      else if (/^Trainer:/i.test(line)) trainer = line.replace(/^Trainer:\s*/i, '').trim();
      else if (!name && !/^(Jockey|Trainer|Owner|Breeder|Weight|Med|Equipment|Claiming|$)/i.test(line)) {
        name = cleanHorseName(line);
      }
    }

    if (!name || /^(Program|Post|Odds)$/i.test(name)) name = `Horse ${programNumber}`;
    race.horses.push({
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

  // Fallback parser: scrape horse profile links. Mobile/desktop Equibase often
  // embeds horse names in profile anchors even when the table text format shifts.
  if (race.horses.length < 2) {
    const anchorRe = /<a[^>]+(?:type=Horse|horse)[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let idx = 1;
    const seen = new Set();
    while ((match = anchorRe.exec(html))) {
      const name = cleanHorseName(match[1].replace(/<[^>]+>/g, ' '));
      if (!name || seen.has(name.toLowerCase()) || /equibase|entries|results/i.test(name)) continue;
      seen.add(name.toLowerCase());
      race.horses.push({
        programNumber: String(idx),
        name,
        jockey: '',
        trainer: '',
        morningLine: '10/1',
        oddsDecimal: 10,
        speedFigure: 70,
        recentForm: 70,
        jockeyWinPct: 10,
        trainerWinPct: 10,
        classRating: 70,
        paceRating: 70
      });
      idx += 1;
    }
  }

  if (race.horses.length < 2) return null;
  race.horses = race.horses.map((horse, index) => ({ ...horse, ...estimateRatings(horse, race, index) }));
  return race;
}

function parseMobileTrackDates(html, trackCode) {
  // Mobile pages link dates like entriesMNR20260608.html. These are much more reliable than full desktop pages.
  const re = new RegExp(`entries${trackCode}(\\d{8})\\.html`, 'gi');
  const dates = new Set();
  let match;
  while ((match = re.exec(html))) dates.add(match[1]);
  return [...dates];
}

function parseMobileRaceLinks(html, trackCode, dateYmd) {
  const re = new RegExp(`entries${trackCode}${dateYmd}(\\d{2})\\.html`, 'gi');
  const races = new Set();
  let match;
  while ((match = re.exec(html))) races.add(match[1]);

  // Some fetch renderers hide hrefs but include Race 1, Race 2 text. Fallback creates the normal URLs.
  if (!races.size) {
    for (const line of htmlToLines(html)) {
      const raceMatch = line.match(/Race\s+(\d{1,2})\b/i);
      if (raceMatch) races.add(String(raceMatch[1]).padStart(2, '0'));
    }
  }

  return [...races].sort((a, b) => Number(a) - Number(b));
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

export async function loadRacesFromEquibaseMobile() {
  const today = todayYyyyMmDd(config.timezone);
  const allRaces = [];

  for (const trackCode of config.data.trackCodes) {
    try {
      const trackUrl = `https://mobile.equibase.com/html/entries${trackCode}.html`;
      console.log(`Fetching mobile track page ${trackUrl}`);
      const trackHtml = await fetchText(trackUrl);
      const dates = parseMobileTrackDates(trackHtml, trackCode);
      const dateToUse = dates.includes(today) ? today : today;
      if (dates.length && !dates.includes(today)) {
        console.log(`${trackCode}: mobile page has dates ${dates.join(', ')}, but not today ${today}. Skipping.`);
        continue;
      }

      const dayUrl = `https://mobile.equibase.com/html/entries${trackCode}${dateToUse}.html`;
      console.log(`Fetching mobile day page ${dayUrl}`);
      const dayHtml = await fetchText(dayUrl);
      const raceIds = parseMobileRaceLinks(dayHtml, trackCode, dateToUse);
      if (!raceIds.length) {
        console.warn(`${trackCode}: found 0 race links on mobile day page.`);
        continue;
      }

      for (const raceId of raceIds) {
        const raceUrl = `https://mobile.equibase.com/html/entries${trackCode}${dateToUse}${raceId}.html`;
        try {
          const raceHtml = await fetchText(raceUrl);
          const race = parseMobileRacePage(raceHtml, trackCode, raceUrl);
          if (race) allRaces.push(race);
          else console.warn(`${trackCode} race ${Number(raceId)}: parsed 0 horses.`);
        } catch (error) {
          console.warn(`Could not fetch ${trackCode} race ${Number(raceId)}: ${error.message}`);
        }
      }
    } catch (error) {
      console.warn(`Could not fetch mobile entries for ${trackCode}: ${error.message}`);
    }
  }

  const deduped = new Map();
  for (const race of allRaces) deduped.set(`${race.trackCode}|${race.race}`, race);
  return [...deduped.values()];
}

export async function loadRawRaces() {
  let races = [];

  if (config.data.source === 'csv') {
    races = await loadRacesFromCsv();
  } else if (config.data.source === 'public_csv_url') {
    races = await loadRacesFromPublicCsvUrl();
  } else {
    races = await loadRacesFromEquibaseMobile();
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
