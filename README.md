# Horse Racing Discord Bot

Clean Railway/GitHub starter using SportsGameOdds. No `node_modules` included.

## Required Railway variables

```env
DISCORD_WEBHOOK_URL=your_discord_webhook
SPORTSGAMEODDS_API_KEY=your_sgo_key
TIMEZONE=America/Chicago
RUN_ON_START=true
```

## Useful variables

```env
SCAN_INTERVAL_MINUTES=15
UPCOMING_WINDOW_MINUTES=720
MIN_HORSES_PER_RACE=4
MAX_RACES_PER_SCAN=10
ENABLE_WIN_BETS=true
ENABLE_LONGSHOTS=true
ENABLE_EXACTAS=true
ENABLE_SUPERFECTAS=true
MIN_WIN_SCORE=55
MIN_EXACTA_SCORE=55
MIN_SUPERFECTA_SCORE=60
LONGSHOT_MIN_AMERICAN_ODDS=800
MAX_SUPERFECTA_ALERTS_PER_SCAN=3
DRY_RUN=false
```

## Commands

```bash
npm start
npm run diagnose
npm run post-now
npm run test-alert
```

## Important

This bot uses `sportID=HORSE_RACING` and the `/v2/events/` endpoint with `oddsAvailable=true`.
SportsGameOdds says the most current sport list for your key should be checked with `/sports`, and their docs list `HORSE_RACING` as a sportID. Your plan/key still needs access to that data.

## GitHub upload

Upload these files only. Do not upload:

```text
node_modules/
.env
.git/
```

Railway will run `npm install`/`npm ci` itself.
