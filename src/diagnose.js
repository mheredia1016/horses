import { loadRawRaces } from './race-scraper.js';
import { filterUpcomingRaces, racePostDateUtc, getLocalDateString } from './time-filter.js';
import { buildPlays } from './scoring.js';
import { config } from './config.js';

function fmtDate(d) {
  return d ? d.toISOString() : 'unparsed';
}

function reason(race, now) {
  const today = getLocalDateString(now, config.timezone);
  if (config.data.postOnlyToday && race.date && race.date !== 'today' && race.date !== today) {
    return `wrong date ${race.date}, today is ${today}`;
  }
  const postUtc = racePostDateUtc(race);
  if (!postUtc) return 'kept: post time unparsed, allowed through';
  const mins = Math.round((postUtc.getTime() - now.getTime()) / 60000);
  if (mins < -config.data.postTimeGraceMinutes) return `past post by ${Math.abs(mins)} min`;
  if (mins > config.schedule.upcomingWindowMinutes) return `outside upcoming window: ${mins} min away`;
  return `kept: ${mins} min to post`;
}

const now = new Date();
const raw = await loadRawRaces();
const upcoming = filterUpcomingRaces(raw, now);
const plays = buildPlays(upcoming, config.scoring);

console.log('\n=== HORSE BOT DIAGNOSTICS ===');
console.log(`Now UTC: ${now.toISOString()}`);
console.log(`Bot timezone: ${config.timezone}`);
console.log(`Today local: ${getLocalDateString(now, config.timezone)}`);
console.log(`Data source: ${config.data.source}`);
console.log(`Mobile Equibase source: enabled`);
console.log(`Track codes: ${config.data.trackCodes.join(',')}`);
console.log(`Raw races loaded: ${raw.length}`);
console.log(`Upcoming races kept: ${upcoming.length}`);
console.log(`Thresholds: win ${config.scoring.minWinScore}, exacta ${config.scoring.minExactaScore}, super ${config.scoring.minSuperfectaScore}`);
console.log(`Plays: win ${plays.winBets.length}, longshot ${plays.longshots.length}, exacta ${plays.exactas.length}, super ${plays.superfectas.length}`);

console.log('\n=== RACE FILTER REASONS ===');
for (const race of raw.slice(0, 80)) {
  console.log(`${race.trackCode || ''} ${race.track} R${race.race} date=${race.date} post=${race.postTime || '(blank)'} postUtc=${fmtDate(racePostDateUtc(race))} horses=${race.horses?.length || 0} -> ${reason(race, now)}`);
}

if (!raw.length) {
  console.log('\nNo raw races loaded. Most likely Equibase mobile pages blocked Railway, today is not available for your TRACK_CODES, or the source page format changed. Set DATA_SOURCE=public_csv_url with a published Google Sheet CSV if this repeats.');
}
if (raw.length && !upcoming.length) {
  console.log('\nRaw races loaded, but all were filtered out. Increase UPCOMING_WINDOW_MINUTES or set SKIP_PAST_RACES=false for testing.');
}
