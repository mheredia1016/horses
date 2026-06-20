export const config = {
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  sgoApiKey: process.env.SPORTSGAMEODDS_API_KEY || '',
  timezone: process.env.TIMEZONE || 'America/Chicago',
  runOnStart: parseBool(process.env.RUN_ON_START, true),
  scanIntervalMinutes: parseInt(process.env.SCAN_INTERVAL_MINUTES || '15', 10),
  upcomingWindowMinutes: parseInt(process.env.UPCOMING_WINDOW_MINUTES || '720', 10),
  minHorsesPerRace: parseInt(process.env.MIN_HORSES_PER_RACE || '4', 10),
  maxRacesPerScan: parseInt(process.env.MAX_RACES_PER_SCAN || '10', 10),
  enableWinBets: parseBool(process.env.ENABLE_WIN_BETS, true),
  enableLongshots: parseBool(process.env.ENABLE_LONGSHOTS, true),
  enableExactas: parseBool(process.env.ENABLE_EXACTAS, true),
  enableSuperfectas: parseBool(process.env.ENABLE_SUPERFECTAS, true),
  minWinScore: parseFloat(process.env.MIN_WIN_SCORE || '55'),
  minExactaScore: parseFloat(process.env.MIN_EXACTA_SCORE || '55'),
  minSuperfectaScore: parseFloat(process.env.MIN_SUPERFECTA_SCORE || '60'),
  longshotMinAmericanOdds: parseInt(process.env.LONGSHOT_MIN_AMERICAN_ODDS || '800', 10),
  maxSuperfectaAlertsPerScan: parseInt(process.env.MAX_SUPERFECTA_ALERTS_PER_SCAN || '3', 10),
  dryRun: parseBool(process.env.DRY_RUN, false)
};

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).toLowerCase());
}
