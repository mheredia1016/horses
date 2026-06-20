import { config } from './config.js';
import { loadUpcomingRaces } from './races.js';
import { scoreRace, buildPlays } from './scoring.js';
import { formatRaceAlert } from './format.js';
import { postDiscord } from './discord.js';

const posted = new Set();

export async function runUpcomingScan({ force = false } = {}) {
  console.log(`[${new Date().toISOString()}] Loading upcoming horse races...`);
  const races = await loadUpcomingRaces();
  console.log(`Loaded ${races.length} upcoming races with ${config.minHorsesPerRace}+ horses.`);

  let sent = 0;
  let superfectas = 0;

  for (const race of races) {
    const scored = scoreRace(race);
    let plays = buildPlays(scored, config);
    if (superfectas >= config.maxSuperfectaAlertsPerScan) plays = plays.filter(p => p.type !== 'superfecta');
    if (plays.some(p => p.type === 'superfecta')) superfectas++;
    if (!plays.length) continue;

    const key = `${race.id}:${plays.map(p => p.type).join(',')}`;
    if (!force && posted.has(key)) continue;
    posted.add(key);

    await postDiscord(formatRaceAlert(scored, plays));
    sent++;
  }

  console.log(`Posted ${sent} race alert message(s).`);
  return { races: races.length, sent };
}
