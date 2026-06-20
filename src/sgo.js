import { config } from './config.js';

const API_BASE = 'https://api.sportsgameodds.com/v2';

export async function getHorseRacingEvents() {
  const url = new URL(`${API_BASE}/events/`);

  url.searchParams.set('sportID', 'HORSE_RACING');
  url.searchParams.set('oddsAvailable', 'true');
  url.searchParams.set('limit', '200');

  const events = await fetchJson(url);

  return normalize(events);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'x-api-key': config.sgoApiKey,
      accept: 'application/json'
    }
  });

  const text = await res.text();

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non JSON response: ${text.slice(0, 500)}`);
  }

  if (!res.ok) {
    throw new Error(
      `SportsGameOdds ${res.status}: ${JSON.stringify(json).slice(0, 1000)}`
    );
  }

  return json;
}

function normalize(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.events)) return json.events;
  if (Array.isArray(json.results)) return json.results;
  return [];
}
