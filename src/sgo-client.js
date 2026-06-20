import { config } from './config.js';

const API_BASE = 'https://api.sportsgameodds.com/v2';

export function americanToDecimal(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[+]/g, ''));
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

export function americanToImplied(value) {
  const n = Number(String(value).replace(/[+]/g, ''));
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 100 / (n + 100) : Math.abs(n) / (Math.abs(n) + 100);
}

function bestBookOdd(odd) {
  const books = odd?.byBookmaker || {};
  let best = null;
  for (const [bookmaker, data] of Object.entries(books)) {
    if (data?.available === false) continue;
    const american = data?.odds ?? data?.bookOdds ?? null;
    const decimal = americanToDecimal(american);
    if (!decimal) continue;
    if (!best || decimal > best.decimal) {
      best = {
        bookmaker,
        american: String(american),
        decimal,
        deeplink: data?.deeplink || ''
      };
    }
  }

  if (!best) {
    const american = odd?.bookOdds ?? odd?.fairOdds ?? null;
    const decimal = americanToDecimal(american);
    if (decimal) best = { bookmaker: 'consensus', american: String(american), decimal, deeplink: '' };
  }
  return best;
}

function cleanName(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bHORSE RACING\b/gi, '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function entityNameFromOdd(odd, event) {
  const id = odd?.playerID || odd?.statEntityID || '';
  const direct = odd?.playerName || odd?.statEntityName || odd?.participantName || odd?.entityName || odd?.name;
  if (direct) return cleanName(direct);

  const players = event?.players || event?.participants || {};
  const found = Array.isArray(players)
    ? players.find((p) => [p.playerID, p.statEntityID, p.id].includes(id))
    : players[id];
  const foundName = found?.names?.long || found?.names?.medium || found?.name || found?.fullName;
  if (foundName) return cleanName(foundName);

  return cleanName(id || odd?.sideID || 'Horse');
}

function looksLikeHorseWinOdd(odd) {
  if (!odd || odd.cancelled || odd.ended) return false;
  const id = `${odd.oddID || ''} ${odd.marketName || ''} ${odd.betTypeID || ''} ${odd.sideID || ''}`.toLowerCase();
  if (id.includes('exacta') || id.includes('trifecta') || id.includes('superfecta')) return false;
  if (id.includes('winner') || id.includes('win') || id.includes('moneyline') || id.includes(' ml') || id.includes('-ml')) return true;
  // Horse racing APIs often expose only participant win odds, so keep odds with a statEntity/player that are not team home/away/draw markets.
  if ((odd.playerID || odd.statEntityID) && !['home', 'away', 'draw', 'home+draw', 'away+draw'].includes(String(odd.sideID || '').toLowerCase())) return true;
  return false;
}

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

function trackName(event) {
  return event?.info?.track || event?.info?.venue || event?.venue?.name || event?.leagueID || event?.eventName || 'Horse Racing';
}

function raceNumber(event) {
  const candidates = [event?.info?.raceNumber, event?.raceNumber, event?.eventName, event?.name, event?.info?.name, event?.info?.title].filter(Boolean);
  for (const value of candidates) {
    const m = String(value).match(/race\s*#?\s*(\d+)/i) || String(value).match(/\bR(?:ace)?\s*(\d+)\b/i);
    if (m) return m[1];
  }
  return event?.eventID?.slice(-4) || '1';
}

export function convertSgoEventToRace(event, index = 0) {
  const startsAt = event?.status?.startsAt || event?.startsAt || event?.startTime;
  const startDate = startsAt ? new Date(startsAt) : new Date();
  const parts = localParts(startDate, config.timezone);

  const byEntity = new Map();
  for (const odd of Object.values(event?.odds || {})) {
    if (!looksLikeHorseWinOdd(odd)) continue;
    const entityID = odd.playerID || odd.statEntityID || odd.sideID || odd.oddID;
    if (!entityID) continue;
    const best = bestBookOdd(odd);
    if (!best) continue;

    const fairAmerican = odd.fairOdds || odd.openFairOdds || odd.bookOdds || best.american;
    const fairProb = americanToImplied(fairAmerican) || americanToImplied(best.american) || 0.1;
    const bookProb = americanToImplied(best.american) || fairProb;
    const openProb = americanToImplied(odd.openBookOdds || odd.openFairOdds);
    const valueEdge = Math.max(0, fairProb - bookProb);
    const steamMove = openProb ? Math.max(0, openProb - bookProb) : 0;

    const existing = byEntity.get(entityID);
    if (!existing || best.decimal > existing.oddsDecimal) {
      byEntity.set(entityID, {
        programNumber: String(byEntity.size + 1),
        name: entityNameFromOdd(odd, event),
        morningLine: best.american,
        oddsDecimal: Number((best.decimal - 1).toFixed(2)),
        bestBook: best.bookmaker,
        deeplink: best.deeplink,
        fairOdds: fairAmerican ? String(fairAmerican) : '',
        fairProbability: fairProb,
        bookProbability: bookProb,
        valueEdge,
        steamMove,
        speedFigure: Math.round(45 + fairProb * 50 + valueEdge * 120),
        recentForm: Math.round(45 + fairProb * 45 + steamMove * 90),
        paceRating: Math.round(45 + fairProb * 35),
        classRating: Math.round(45 + fairProb * 35),
        jockeyWinPct: 8,
        trainerWinPct: 8
      });
    }
  }

  const horses = Array.from(byEntity.values()).map((horse, i) => ({ ...horse, programNumber: String(i + 1) }));
  return {
    id: event.eventID || `sgo-${index}`,
    source: 'sportsgameodds',
    track: trackName(event),
    trackCode: event.leagueID || 'HORSE_RACING',
    race: raceNumber(event),
    date: parts.date,
    postTime: parts.time,
    postTimeIso: startsAt || '',
    surface: event?.info?.surface || '',
    distance: event?.info?.distance || '',
    horses,
    links: event?.links || {},
    rawEventID: event.eventID
  };
}

export async function fetchSportsGameOddsRaces() {
  if (!config.sgo.apiKey) {
    console.log('SPORTSGAMEODDS_API_KEY is missing; cannot load SportsGameOdds races.');
    return [];
  }

  const now = new Date();
  const startsAfter = new Date(now.getTime() - config.data.postTimeGraceMinutes * 60000).toISOString();
  const startsBefore = new Date(now.getTime() + config.schedule.upcomingWindowMinutes * 60000).toISOString();

  const url = new URL(`${API_BASE}/events/`);
  url.searchParams.set('sportID', config.sgo.sportID);
  url.searchParams.set('oddsAvailable', 'true');
  url.searchParams.set('started', 'false');
  url.searchParams.set('cancelled', 'false');
  url.searchParams.set('startsAfter', startsAfter);
  url.searchParams.set('startsBefore', startsBefore);
  url.searchParams.set('includeOpenCloseOdds', 'true');
  url.searchParams.set('limit', String(config.sgo.limit));
  if (config.sgo.bookmakerIds.length) url.searchParams.set('bookmakerID', config.sgo.bookmakerIds.join(','));

  const all = [];
  let cursor = '';
  for (let page = 0; page < config.sgo.maxPages; page += 1) {
    if (cursor) url.searchParams.set('cursor', cursor);
    console.log(`Fetching SportsGameOdds ${url.toString().replace(config.sgo.apiKey, '***')}`);
    const res = await fetch(url, {
      headers: { 'X-Api-Key': config.sgo.apiKey, accept: 'application/json' }
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; }
    catch { throw new Error(`SportsGameOdds returned non-JSON: ${text.slice(0, 500)}`); }
    if (!res.ok || json?.success === false) {
      throw new Error(`SportsGameOdds ${res.status}: ${JSON.stringify(json).slice(0, 900)}`);
    }
    const events = Array.isArray(json?.data) ? json.data : [];
    all.push(...events);
    cursor = json?.nextCursor || '';
    if (!cursor || events.length === 0) break;
  }

  const races = all.map(convertSgoEventToRace).filter((race) => race.horses.length >= config.sgo.minHorses);
  console.log(`SportsGameOdds loaded ${all.length} events and converted ${races.length} races with at least ${config.sgo.minHorses} horses.`);
  return races;
}
