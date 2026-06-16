# Horse Racing Discord Bot

Free-source horse racing Discord alerts for:
- Best Win Bet
- Best Longshot
- Exacta Box
- Value/longshot plays
- Selective Superfecta Bombs

## Important fix in this version

The bot now uses Equibase **mobile entry pages** instead of the desktop RaceCardIndex pages.

The mobile pages are easier to parse and expose entries like:

`https://mobile.equibase.com/html/entriesMNR.html`

Then the bot automatically checks today’s date page and race pages for each track code.

## Railway variables

Required:

```env
DISCORD_WEBHOOK_URL=your_discord_webhook
```

Recommended:

```env
DATA_SOURCE=equibase
TIMEZONE=America/Chicago
RUN_ON_START=true
UPCOMING_SCAN_MINUTES=15
UPCOMING_WINDOW_MINUTES=720
POST_ONLY_TODAY=true
SKIP_PAST_RACES=true
POST_TIME_GRACE_MINUTES=10
MIN_WIN_SCORE=55
MIN_EXACTA_SCORE=55
MIN_SUPERFECTA_SCORE=60
FALLBACK_TO_CSV=false
```

Track codes:

```env
TRACK_CODES=CD,BAQ,GP,SA,DMR,SAR,KEE,OP,TP,WO,PID,MTH,LS,ELP,DEL,PRX,CT,MNR,LAD,EVD,PEN,CBY,RP,HST,ALB,IND,ASD,BTP,FMT,EMD,FER,HAW
```

## Commands

Start the bot:

```bash
npm start
```

Post upcoming races now:

```bash
npm run upcoming
```

Diagnose why it is not posting:

```bash
npm run diagnose
```

The diagnose command prints:
- how many raw races were fetched
- how many upcoming races survived filters
- why each race was kept or filtered out
- whether the issue is data source, time parsing, track coverage, or score thresholds

## Free-source warning

Equibase is a free public website, not an official API. Sometimes Railway/server traffic can be blocked or page HTML can change. If Equibase returns zero races, the stable free fallback is a Google Sheet published as CSV:

```env
DATA_SOURCE=public_csv_url
PUBLIC_RACE_CSV_URL=your_published_google_sheet_csv_url
```
