import { config } from './config.js';
import { getHorseRacingEvents } from './sgo.js';

export async function loadUpcomingRaces() {
  const events = await getHorseRacingEvents();
  const races = events.map(eventToRace).filter(Boolean);
  const now = Date.now();
  const max = now + config.upcomingWindowMinutes * 60 * 1000;
  return races
    .filter(r => !r.postTimeMs || (r.postTimeMs >= now - 10 * 60 * 1000 && r.postTimeMs <= max))
    .filter(r => r.horses.length >= config.minHorsesPerRace)
    .sort((a, b) => (a.postTimeMs || 0) - (b.postTimeMs || 0))
    .slice(0, config.maxRacesPerScan);
}

export function eventToRace(event) {
  const horses = extractHorses(event);
  const start = event.startTime || event.startDate || event.commence_time || event.eventTime || event.scheduledTime;
  const postTimeMs = start ? Date.parse(start) : null;
  const track = event.leagueName || event.leagueID || event.eventName || event.name || event.sportID || 'Horse Racing';
  const raceNumber = extractRaceNumber(event) || '?';
  return {
    id: event.eventID || event.id || `${track}-${raceNumber}-${start || ''}`,
    track,
    raceNumber,
    name: event.eventName || event.name || `${track} Race ${raceNumber}`,
    postTime: start || '',
    postTimeMs,
    horses,
    raw: event
  };
}

function extractRaceNumber(event) {
  const text = `${event.eventName || ''} ${event.name || ''} ${event.description || ''}`;
  const m = text.match(/race\s*(\d+)/i);
  return m ? m[1] : event.raceNumber || event.round || event.eventNumber;
}

function extractHorses(event) {
  const fromTeams = [];
  const teams = event.teams || event.competitors || event.participants || [];
  for (const t of teams) {
    const name = t.name || t.teamName || t.displayName || t.participantName;
    if (!name) continue;
    fromTeams.push({
      name,
      number: t.rotationNumber || t.number || t.runnerNumber || t.programNumber || '',
      odds: pickAmericanOdds(t),
      source: 'team'
    });
  }

  const byName = new Map();
  for (const h of fromTeams) byName.set(h.name, h);

  const markets = event.markets || event.odds || event.lines || [];
  const marketList = Array.isArray(markets) ? markets : Object.values(markets || {}).flat();
  for (const m of marketList) {
    const outcomes = m.outcomes || m.options || m.prices || m.books || [];
    for (const o of Array.isArray(outcomes) ? outcomes : []) {
      const name = o.name || o.label || o.selection || o.participantName || o.teamName;
      if (!name) continue;
      const current = byName.get(name) || { name, number: o.number || o.runnerNumber || o.programNumber || '', source: 'market' };
      current.odds = current.odds ?? pickAmericanOdds(o);
      byName.set(name, current);
    }
  }

  return [...byName.values()].map((h, idx) => ({
    number: h.number || String(idx + 1),
    name: h.name,
    americanOdds: Number.isFinite(h.odds) ? h.odds : null
  }));
}

function pickAmericanOdds(obj) {
  const candidates = [
    obj.americanOdds, obj.oddsAmerican, obj.priceAmerican, obj.price,
    obj.moneyline, obj.currentOdds, obj.consensusOdds
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && Math.abs(n) >= 100) return n;
  }
  return null;
}
