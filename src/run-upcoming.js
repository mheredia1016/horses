import { config } from './config.js';
import { loadRawRaces } from './race-scraper.js';
import { filterUpcomingRaces } from './time-filter.js';
import { buildPlays } from './scoring.js';
import { postToDiscord } from './discord.js';
import {
  buildMorningCardEmbed,
  buildWinBetAlert,
  buildLongshotAlert,
  buildExactaAlert,
  buildSuperfectaAlert
} from './alerts.js';

const postedKeys = new Set();

function keyFor(play) {
  const horseBits = play.horses ? play.horses.map((h) => h.programNumber).join('-') : play.horse?.programNumber;
  return `${play.type}|${play.race.track}|${play.race.race}|${horseBits}`;
}

async function postPlayOnce(webhook, payload, play) {
  const key = keyFor(play);
  if (postedKeys.has(key)) return false;
  postedKeys.add(key);
  await postToDiscord(webhook, payload);
  return true;
}

export async function runUpcomingReport({ force = false } = {}) {
  const rawRaces = await loadRawRaces();
  const races = force ? rawRaces : filterUpcomingRaces(rawRaces);
  const plays = buildPlays(races, config.scoring);

  console.log(`Upcoming scan: ${rawRaces.length} raw races, ${races.length} upcoming races, ${plays.winBets.length} win, ${plays.longshots.length} longshot, ${plays.exactas.length} exacta, ${plays.superfectas.length} superfecta.`);

  if (!races.length) {
    console.log('No upcoming races matched. Check TRACK_CODES, DATA_SOURCE, post_time parsing, and UPCOMING_WINDOW_MINUTES.');
    return;
  }

  if (!plays.winBets.length && !plays.longshots.length && !plays.exactas.length && !plays.superfectas.length) {
    await postToDiscord(config.discord.mainWebhookUrl, buildMorningCardEmbed(plays));
    console.log('Upcoming races found, but no plays met thresholds. Lower MIN_WIN_SCORE / MIN_EXACTA_SCORE / MIN_SUPERFECTA_SCORE if needed.');
    return;
  }

  if (config.features.winBets) {
    for (const play of plays.winBets.slice(0, 3)) {
      await postPlayOnce(config.discord.winBetWebhookUrl, buildWinBetAlert(play), play);
    }
  }
  if (config.features.longshots) {
    for (const play of plays.longshots) {
      await postPlayOnce(config.discord.longshotWebhookUrl, buildLongshotAlert(play), play);
    }
  }
  if (config.features.exactas) {
    for (const play of plays.exactas.slice(0, 3)) {
      await postPlayOnce(config.discord.exactaWebhookUrl, buildExactaAlert(play), play);
    }
  }
  if (config.features.superfectas) {
    for (const play of plays.superfectas) {
      await postPlayOnce(config.discord.superfectaWebhookUrl, buildSuperfectaAlert(play), play);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  runUpcomingReport({ force }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
