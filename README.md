# Horse Racing Discord Bot — SportsGameOdds Version

This version uses the SportsGameOdds API instead of scraping Equibase/DRF pages.

## Required Railway Variables

```env
DISCORD_WEBHOOK_URL=your_discord_webhook
SPORTSGAMEODDS_API_KEY=your_sgo_key
DATA_SOURCE=sportsgameodds
TIMEZONE=America/Chicago
RUN_ON_START=true
```

SportsGameOdds lists `HORSE_RACING` as a supported `sportID`, and this bot requests upcoming events from `/v2/events/` with `sportID=HORSE_RACING` and `oddsAvailable=true`.

## Recommended Variables

```env
UPCOMING_SCAN_MINUTES=15
UPCOMING_WINDOW_MINUTES=720
POST_TIME_GRACE_MINUTES=10
MIN_WIN_SCORE=55
MIN_EXACTA_SCORE=55
MIN_SUPERFECTA_SCORE=60
SGO_EVENT_LIMIT=100
SGO_MAX_PAGES=3
SGO_MIN_HORSES=4
```

Optional bookmaker filter:

```env
SGO_BOOKMAKER_IDS=fanduel,draftkings,betmgm,hardrockbet
```

Leave it blank to use all available books returned by your plan.

## Commands

```bash
npm start
npm run diagnose
npm run sgo-diagnose
npm run upcoming
npm run once
npm run test-alert
```

## What Posts

- Best Win Bet
- Best Longshot
- Exacta Box
- Selective Superfecta Box

The bot uses available win odds/fair odds from SportsGameOdds to rank horses. Exacta and superfecta boxes are derived from the ranked horses; they are not official exotic pool prices unless your API response includes those markets.

## Notes

If `npm run sgo-diagnose` shows 0 races, check:

1. `SPORTSGAMEODDS_API_KEY` is set correctly.
2. Your SportsGameOdds plan includes horse racing.
3. There are upcoming horse racing events with odds in your requested window.
4. Remove `SGO_BOOKMAKER_IDS` temporarily to avoid filtering out all books.
