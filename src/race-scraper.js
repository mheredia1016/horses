import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { config } from './config.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOdds(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 99;
  if (raw.includes('/')) {
    const [a, b] = raw.split('/').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }
  return toNumber(raw, 99);
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

export async function getTodayRaces() {
  return loadRacesFromCsv();
}
