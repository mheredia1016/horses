import { config } from './config.js';
import { getTodayRaces } from './race-scraper.js';
import { buildPlays } from './scoring.js';
import { postToDiscord } from './discord.js';
import {
  buildMorningCardEmbed,
  buildWinBetAlert,
  buildLongshotAlert,
  buildExactaAlert,
  buildSuperfectaAlert,
  buildResultsPlaceholderEmbed
} from './alerts.js';

export async function runMorningReport() {
  const races = await getTodayRaces();
  const plays = buildPlays(races, config.scoring);

  await postToDiscord(config.discord.mainWebhookUrl, buildMorningCardEmbed(plays));

  if (config.features.winBets) {
    for (const play of plays.winBets.slice(0, 3)) {
      await postToDiscord(config.discord.winBetWebhookUrl, buildWinBetAlert(play));
    }
  }

  if (config.features.longshots) {
    for (const play of plays.longshots) {
      await postToDiscord(config.discord.longshotWebhookUrl, buildLongshotAlert(play));
    }
  }

  if (config.features.exactas) {
    for (const play of plays.exactas.slice(0, 3)) {
      await postToDiscord(config.discord.exactaWebhookUrl, buildExactaAlert(play));
    }
  }

  if (config.features.superfectas) {
    for (const play of plays.superfectas) {
      await postToDiscord(config.discord.superfectaWebhookUrl, buildSuperfectaAlert(play));
    }
  }

  console.log(`Posted morning report: ${races.length} races, ${plays.winBets.length} win bets, ${plays.longshots.length} longshots, ${plays.exactas.length} exactas, ${plays.superfectas.length} superfectas.`);
}

export async function runResultsReport() {
  if (!config.features.resultsReport) return;
  await postToDiscord(config.discord.resultsWebhookUrl, buildResultsPlaceholderEmbed());
}
