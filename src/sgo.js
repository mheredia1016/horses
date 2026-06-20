import { config } from './config.js';

const API_BASE = 'https://api.sportsgameodds.com/v2';

export async function getSports() {
  return sgoFetch('/sports/');
}

export async function getHorseRacingEvents() {
  const url = new URL(`${API_BASE}/events/`);
  url.searchParams.set('sportID', 'HORSE_RACING');
  url.searchParams.set('oddsAvailable', 'true');
  url.searchParams.set('limit', '200');
  const json = await sgoFetchUrl(url);
  return normalizeList(json);
}

async function sgoFetch(path) {
  return sgoFetchUrl(new URL(`${API_BASE}${path}`));
}

async function sgoFetchUrl(url) {
  if (!config.sgoApiKey) throw new Error('Missing SPORTSGAMEODDS_API_KEY');
  const res = await fetch(url, {
    headers: {
      'x-api-key': config.sgoApiKey,
      accept: 'application/json'
    }
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {
    throw new Error(`SportsGameOdds returned non-JSON: ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`SportsGameOdds ${res.status}: ${JSON.stringify(json).slice(0, 600)}`);
  return json;
}

export function normalizeList(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.events)) return json.events;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}
