import { config } from './config.js';

const TZ_ABBR = {
  ET: 'America/New_York',
  EST: 'America/New_York',
  EDT: 'America/New_York',
  CT: 'America/Chicago',
  CST: 'America/Chicago',
  CDT: 'America/Chicago',
  MT: 'America/Denver',
  MST: 'America/Denver',
  MDT: 'America/Denver',
  PT: 'America/Los_Angeles',
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles'
};

export function getLocalDateString(date = new Date(), timeZone = config.timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function parsePostTime(postTime) {
  const raw = String(postTime || '').trim();
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*([A-Z]{2,3})?/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = (match[3] || '').toUpperCase();
  const zoneAbbr = (match[4] || '').toUpperCase();

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  return {
    hour,
    minute,
    timeZone: TZ_ABBR[zoneAbbr] || config.timezone
  };
}

function getOffsetMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );

  return (asUtc - date.getTime()) / 60000;
}

export function racePostDateUtc(race) {
  const parsed = parsePostTime(race?.postTime);
  if (!parsed) return null;

  const today = getLocalDateString(new Date(), config.timezone);
  const raceDate = (!race?.date || race.date === 'today') ? today : race.date;

  const [year, month, day] = String(raceDate).split('-').map(Number);
  if (!year || !month || !day) return null;

  const utcGuess = new Date(Date.UTC(year, month - 1, day, parsed.hour, parsed.minute, 0));
  const offset = getOffsetMinutes(parsed.timeZone, utcGuess);
  return new Date(utcGuess.getTime() - offset * 60000);
}

export function filterRacesForPosting(races, now = new Date()) {
  const today = getLocalDateString(now, config.timezone);
  const graceMs = config.data.postTimeGraceMinutes * 60 * 1000;

  return races.filter((race) => {
    if (config.data.postOnlyToday && race.date && race.date !== 'today' && race.date !== today) {
      return false;
    }

    if (config.data.skipPastRaces) {
      const postUtc = racePostDateUtc(race);
      if (postUtc && postUtc.getTime() + graceMs < now.getTime()) {
        return false;
      }
    }

    return true;
  });
}


export function filterUpcomingRaces(races, now = new Date(), windowMinutes = config.schedule.upcomingWindowMinutes) {
  const windowMs = windowMinutes * 60 * 1000;
  return filterRacesForPosting(races, now)
    .filter((race) => {
      const postUtc = racePostDateUtc(race);
      if (!postUtc) return true;
      const delta = postUtc.getTime() - now.getTime();
      return delta >= 0 && delta <= windowMs;
    })
    .sort((a, b) => {
      const at = racePostDateUtc(a)?.getTime() ?? 0;
      const bt = racePostDateUtc(b)?.getTime() ?? 0;
      return at - bt;
    });
}
