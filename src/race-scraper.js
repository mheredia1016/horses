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
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
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
    jockeyWinPct: horse.jockeyWinPct || 10,
    trainerWinPct: horse.trainerWinPct || 10,
    classRating: Math.round(oddsScore - 1),
    paceRating: Math.round(oddsScore + postBoost / 2)
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      accept: 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function cleanHorseName(value) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^#?\d+[A-Z]?\.?\s+/, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\b(?:win|place|show|pick|selection|horse|jockey|trainer|odds|morning line)\b:?/gi, '')
    .trim();
}

function parseProgramOddsLine(line) {
  return line.match(/Program:\s*([0-9A-Z]+).*?Post:\s*([0-9A-Z]+).*?Odds:\s*([^|]+)/i)
    || line.match(/^([0-9A-Z]+)\s+.*?Odds:\s*([^|]+)/i);
}

function parseMobileRacePage(html, trackCode, sourceUrl) {
  const lines = htmlToLines(html);
  const joined = lines.join('\n');
  if (/Pardon Our Interruption|Access Denied|captcha|blocked/i.test(joined)) {
    console.warn(`${trackCode}: Equibase appears blocked by bot protection.`);
    return null;
  }
  const track = lines.find((line) => !/EQUIBASE|source|-----|Image:|entries/i.test(line) && line.length > 2) || trackCode;
  const dateLine = lines.find((line) => /\d{1,2}\/\d{1,2}\/\d{4}.*Race\s+\d+/i.test(line)) || '';
  const raceNum = Number(dateLine.match(/Race\s+(\d+)/i)?.[1] || sourceUrl.match(/(\d{2})\.html$/)?.[1] || 0);
  const dateMatch = dateLine.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const date = dateMatch ? `${dateMatch[3]}-${String(dateMatch[1]).padStart(2, '0')}-${String(dateMatch[2]).padStart(2, '0')}` : todayIso(config.timezone);
  const postTime = (joined.match(/Post Time:\s*([^\n|<]+)/i)?.[1] || '').trim();
  const raceType = (joined.match(/Race Type:\s*([^\n|<]+)/i)?.[1] || '').trim();
  if (!raceNum) return null;

  const race = { date, track, trackCode, race: raceNum, postTime, surface: '', distance: raceType, sourceUrl, horses: [] };

  for (let i = 0; i < lines.length; i += 1) {
    const m = parseProgramOddsLine(lines[i]);
    if (!m) continue;
    const programNumber = m[1];
    const morningLine = (m[3] || m[2] || '').trim();
    let name = '';
    let jockey = '';
    let trainer = '';
    for (let j = i + 1; j < Math.min(lines.length, i + 14); j += 1) {
      const line = lines[j];
      if (parseProgramOddsLine(line)) break;
      if (/^Jockey:/i.test(line)) jockey = line.replace(/^Jockey:\s*/i, '').trim();
      else if (/^Trainer:/i.test(line)) trainer = line.replace(/^Trainer:\s*/i, '').trim();
      else if (!name && !/^(Jockey|Trainer|Owner|Breeder|Weight|Med|Equipment|Claiming|Program|Post|Odds)/i.test(line)) name = cleanHorseName(line);
    }
    if (!name) name = `Horse ${programNumber}`;
    race.horses.push({ programNumber, name, jockey, trainer, morningLine, oddsDecimal: parseOdds(morningLine) });
  }

  if (race.horses.length < 2) {
    const anchorRe = /<a[^>]+(?:type=Horse|horse|HorseRef|profile)[^>]*>([\s\S]*?)<\/a>/gi;
    let match; let idx = 1; const seen = new Set();
    while ((match = anchorRe.exec(html))) {
      const name = cleanHorseName(match[1]);
      if (!name || seen.has(name.toLowerCase()) || /equibase|entries|results/i.test(name)) continue;
      seen.add(name.toLowerCase());
      race.horses.push({ programNumber: String(idx), name, jockey: '', trainer: '', morningLine: '10/1', oddsDecimal: 10 });
      idx += 1;
    }
  }

  if (race.horses.length < 2) return null;
  race.horses = race.horses.map((horse, index) => ({ ...horse, ...estimateRatings(horse, race, index) }));
  return race;
}

function parseMobileTrackDates(html, trackCode) {
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
  return normalizeRowsToRaces(rows);
}

function normalizeRowsToRaces(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.date || todayIso(config.timezone)}|${row.track || row.track_name}|${row.race}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        date: row.date || todayIso(config.timezone),
        track: row.track || row.track_name || row.track_code || 'Unknown Track',
        trackCode: row.track_code || '',
        race: Number(row.race),
        postTime: row.post_time || row.postTime || '',
        surface: row.surface || '',
        distance: row.distance || '',
        sourceUrl: row.source_url || '',
        horses: []
      });
    }
    grouped.get(key).horses.push({
      programNumber: String(row.program_number || row.number || row.post || '').trim(),
      name: row.horse || row.name || 'Unknown Horse',
      jockey: row.jockey || '',
      trainer: row.trainer || '',
      morningLine: row.morning_line || row.odds || '10/1',
      oddsDecimal: parseOdds(row.morning_line || row.odds || '10/1'),
      speedFigure: toNumber(row.speed_figure, 70),
      recentForm: toNumber(row.recent_form, 70),
      jockeyWinPct: toNumber(row.jockey_win_pct, 10),
      trainerWinPct: toNumber(row.trainer_win_pct, 10),
      classRating: toNumber(row.class_rating, 70),
      paceRating: toNumber(row.pace_rating, 70)
    });
  }
  return [...grouped.values()].filter((race) => race.race && race.horses.length >= 2);
}

export async function loadRacesFromPublicCsvUrl(url = config.data.publicCsvUrl) {
  if (!url) return [];
  console.log(`Fetching public CSV URL ${url}`);
  const csv = await fetchText(url);
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  return normalizeRowsToRaces(rows);
}

const sportsBetting3TrackSlugs = {
  CT: 'charles-town-race-track',
  MNR: 'mountaineer-park-race-track',
  LAD: 'louisiana-downs-race-track',
  PRX: 'parx-racing-race-track',
  GP: 'gulfstream-park-race-track',
  SA: 'santa-anita-race-track',
  CD: 'churchill-downs-race-track',
  SAR: 'saratoga-race-course',
  WO: 'woodbine-race-track',
  EMD: 'emerald-downs-race-track',
  RP: 'remington-park-race-track',
  HAW: 'hawthorne-race-track'
};

function inferHorseNamesFromBlock(blockText) {
  const names = [];
  const seen = new Set();
  const patterns = [
    /(?:^|\n)\s*(?:#)?(\d{1,2}[A-Z]?)\s*[.)-]?\s+([A-Z][A-Za-z' .-]{2,40})(?=\s+(?:\d+\/\d+|\d+-\d+|Jockey|Trainer|\||$))/g,
    /(?:Win|Place|Show|Top Pick|Best Bet|Selection|Pick)\s*[:\-]\s*(?:#?\d+\s*)?([A-Z][A-Za-z' .-]{2,40})/gi
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(blockText))) {
      const raw = match[2] || match[1];
      const name = cleanHorseName(raw).replace(/\b(?:Race|Entries|Picks|Stats|Trifecta|Exacta).*$/i, '').trim();
      if (name.length < 3 || name.length > 42) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); names.push(name); }
    }
  }
  return names.slice(0, 10);
}

export async function loadRacesFromSportsBetting3() {
  const allRaces = [];
  const date = todayIso(config.timezone);
  for (const trackCode of config.data.trackCodes) {
    const slug = sportsBetting3TrackSlugs[trackCode];
    if (!slug) continue;
    const url = `https://www.sportsbetting3.com/horse/${slug}`;
    try {
      console.log(`Fetching SportsBetting3 page ${url}`);
      const html = await fetchText(url);
      const lines = htmlToLines(html);
      const text = lines.join('\n');
      const trackLine = lines.find((l) => /Picks|Entries/i.test(l) && l.length < 80) || trackCode;
      const raceMatches = [...text.matchAll(/(?:^|\n)(?:#{1,4}\s*)?Race\s+(\d{1,2})\b/gi)];
      if (!raceMatches.length) {
        console.warn(`${trackCode}: no Race headings found on SportsBetting3.`);
        continue;
      }
      for (let i = 0; i < raceMatches.length; i += 1) {
        const raceNum = Number(raceMatches[i][1]);
        const start = raceMatches[i].index || 0;
        const end = raceMatches[i + 1]?.index || Math.min(text.length, start + 2500);
        const block = text.slice(start, end);
        const names = inferHorseNamesFromBlock(block);
        if (names.length < 2) {
          console.warn(`${trackCode} race ${raceNum}: SportsBetting3 found race but not enough horse names.`);
          continue;
        }
        const postTime = block.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|a\.m\.|p\.m\.)?\s*(?:ET|CT|EST|CST)?)/i)?.[1] || '';
        const horses = names.map((name, idx) => ({
          programNumber: String(idx + 1),
          name,
          jockey: '',
          trainer: '',
          morningLine: idx === 0 ? '5/1' : idx === 1 ? '7/1' : idx === 2 ? '10/1' : '12/1',
          oddsDecimal: idx === 0 ? 5 : idx === 1 ? 7 : idx === 2 ? 10 : 12,
          speedFigure: Math.max(61, 82 - idx * 3),
          recentForm: Math.max(60, 80 - idx * 3),
          jockeyWinPct: 10,
          trainerWinPct: 10,
          classRating: Math.max(60, 79 - idx * 2),
          paceRating: Math.max(60, 78 - idx * 2)
        }));
        allRaces.push({ date, track: trackLine.replace(/Picks.*$/i, '').trim() || trackCode, trackCode, race: raceNum, postTime, surface: '', distance: '', sourceUrl: url, horses });
      }
    } catch (error) {
      console.warn(`Could not fetch SportsBetting3 for ${trackCode}: ${error.message}`);
    }
  }
  return allRaces;
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
      if (dates.length && !dates.includes(today)) {
        console.log(`${trackCode}: mobile page has dates ${dates.join(', ')}, but not today ${today}. Skipping.`);
        continue;
      }
      const dayUrl = `https://mobile.equibase.com/html/entries${trackCode}${today}.html`;
      console.log(`Fetching mobile day page ${dayUrl}`);
      const dayHtml = await fetchText(dayUrl);
      const raceIds = parseMobileRaceLinks(dayHtml, trackCode, today);
      if (!raceIds.length) {
        console.warn(`${trackCode}: found 0 race links on mobile day page.`);
        continue;
      }
      for (const raceId of raceIds) {
        const raceUrl = `https://mobile.equibase.com/html/entries${trackCode}${today}${raceId}.html`;
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
  const source = config.data.source;
  if (source === 'csv') races = await loadRacesFromCsv();
  else if (source === 'public_csv_url') races = await loadRacesFromPublicCsvUrl();
  else if (source === 'sportsbetting3') races = await loadRacesFromSportsBetting3();
  else if (source === 'multi') {
    races = await loadRacesFromPublicCsvUrl();
    if (!races.length) races = await loadRacesFromSportsBetting3();
    if (!races.length) races = await loadRacesFromEquibaseMobile();
  } else {
    races = await loadRacesFromEquibaseMobile();
    if (!races.length && config.data.fallbackToCsv) races = await loadRacesFromCsv();
  }
  console.log(`Loaded ${races.length} raw races from ${source}.`);
  return races;
}

export async function getTodayRaces() {
  const races = await loadRawRaces();
  const filtered = filterRacesForPosting(races);
  console.log(`After today/upcoming filters: ${filtered.length} races.`);
  if (!filtered.length && races.length) console.log('Loaded races were filtered out. Check date, post_time, TIMEZONE, and POST_TIME_GRACE_MINUTES.');
  return filtered;
}
