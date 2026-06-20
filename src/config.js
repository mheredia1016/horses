import 'dotenv/config';

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  discord: {
    mainWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    winBetWebhookUrl: process.env.WIN_BET_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '',
    longshotWebhookUrl: process.env.LONGSHOT_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '',
    exactaWebhookUrl: process.env.EXACTA_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '',
    superfectaWebhookUrl: process.env.SUPERFECTA_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '',
    resultsWebhookUrl: process.env.RESULTS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || ''
  },
  timezone: process.env.TIMEZONE || 'America/Chicago',
  schedule: {
    morningReportHour: num(process.env.MORNING_REPORT_HOUR, 8),
    resultsReportHour: num(process.env.RESULTS_REPORT_HOUR, 21),
    runOnStart: bool(process.env.RUN_ON_START, true),
    upcomingScanMinutes: num(process.env.UPCOMING_SCAN_MINUTES, 15),
    upcomingWindowMinutes: num(process.env.UPCOMING_WINDOW_MINUTES, 720)
  },
  features: {
    winBets: bool(process.env.ENABLE_WIN_BETS, true),
    longshots: bool(process.env.ENABLE_LONGSHOTS, true),
    exactas: bool(process.env.ENABLE_EXACTAS, true),
    superfectas: bool(process.env.ENABLE_SUPERFECTAS, true),
    resultsReport: bool(process.env.ENABLE_RESULTS_REPORT, true)
  },
  scoring: {
    minWinScore: num(process.env.MIN_WIN_SCORE, 55),
    minExactaScore: num(process.env.MIN_EXACTA_SCORE, 55),
    minSuperfectaScore: num(process.env.MIN_SUPERFECTA_SCORE, 60),
    longshotMinOdds: num(process.env.LONGSHOT_MIN_ODDS, 8),
    maxLongshotAlertsPerDay: num(process.env.MAX_LONGSHOT_ALERTS_PER_DAY, 5),
    maxSuperfectaAlertsPerDay: num(process.env.MAX_SUPERFECTA_ALERTS_PER_DAY, 3)
  },
  sgo: {
    apiKey: process.env.SPORTSGAMEODDS_API_KEY || process.env.SGO_API_KEY || '',
    sportID: process.env.SGO_SPORT_ID || 'HORSE_RACING',
    bookmakerIds: (process.env.SGO_BOOKMAKER_IDS || process.env.BOOKMAKER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean),
    limit: num(process.env.SGO_EVENT_LIMIT, 100),
    maxPages: num(process.env.SGO_MAX_PAGES, 3),
    minHorses: num(process.env.SGO_MIN_HORSES, 4)
  },
  data: {
    source: process.env.DATA_SOURCE || 'sportsgameodds',
    raceCsvPath: process.env.RACE_CSV_PATH || 'data/sample-races.csv',
    publicCsvUrl: process.env.PUBLIC_RACE_CSV_URL || '',
    trackCodes: (process.env.TRACK_CODES || 'CD,BAQ,GP,SA,DMR,SAR,KEE,OP,TP,WO,PID,MTH,LS,ELP,DEL,PRX,CT,MNR,LAD,EVD,PEN,CBY,RP,HST,ALB,IND,ASD,BTP,FMT,EMD,FER,HAW').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean),
    autoDiscoverTracks: bool(process.env.AUTO_DISCOVER_TRACKS, true),
    fallbackToCsv: bool(process.env.FALLBACK_TO_CSV, false),
    postOnlyToday: bool(process.env.POST_ONLY_TODAY, true),
    skipPastRaces: bool(process.env.SKIP_PAST_RACES, true),
    postTimeGraceMinutes: num(process.env.POST_TIME_GRACE_MINUTES, 0)
  },
  dryRun: bool(process.env.DRY_RUN, false),
  logLevel: process.env.LOG_LEVEL || 'info'
};
