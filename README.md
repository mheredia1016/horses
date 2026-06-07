# Horse Racing Discord Bot

Free-source starter bot for horse racing Discord alerts.

## Alert Types

- Best Win Bet
- Best Longshot
- Exacta Box
- Selective Superfecta Bomb
- Daily morning card
- Results placeholder report

This is Option A. It now pulls from a free public entries source by default. CSV is only a backup/test mode.

## Setup

```bash
npm install
cp .env.example .env
```

Add your Discord webhook:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Run a dry test:

```bash
npm run test-alert
```

Run once for real:

```bash
npm run once
```

Run scheduled bot:

```bash
npm start
```

## Railway

1. Upload this repo to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Add this variable:

```env
DISCORD_WEBHOOK_URL=your_discord_webhook
```

Recommended variables:

```env
TIMEZONE=America/Chicago
DATA_SOURCE=equibase
TRACK_CODES=CD,BAQ,GP,SA,DMR,SAR,KEE,OP,TP,WO,PID,MTH,LS,ELP,DEL,PRX,CT,MNR,LAD
RUN_ON_START=true
```

Railway start command:

```bash
npm start
```

## Data Sources

### Default: Equibase public entries

```env
DATA_SOURCE=equibase
```

The bot builds today's Equibase entry URLs using track codes and today's date, for example:

```text
https://www.equibase.com/static/entry/CD060626USA-EQB.html
```

Control tracks with:

```env
TRACK_CODES=CD,BAQ,GP,SA,DMR,SAR,KEE,OP,TP,WO,PID,MTH,LS,ELP,DEL,PRX,CT,MNR,LAD
```

Important: this is a free public web source, not an official API. If Equibase blocks server requests or changes their page layout, the bot may return no races. That is why the project also supports a published CSV URL and local CSV fallback.

### Optional: Published CSV URL

This is the most stable free option if you publish a Google Sheet as CSV.

```env
DATA_SOURCE=public_csv_url
PUBLIC_RACE_CSV_URL=https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
```

### Backup: Local CSV

```env
DATA_SOURCE=csv
RACE_CSV_PATH=data/sample-races.csv
```

CSV columns:

```csv
date,track,race,post_time,surface,distance,program_number,horse,morning_line,jockey,trainer,speed_figure,recent_form,jockey_win_pct,trainer_win_pct,class_rating,pace_rating
```

## Race Date/Time Filters

These are enabled by default so the bot does not post old races:

```env
POST_ONLY_TODAY=true
SKIP_PAST_RACES=true
POST_TIME_GRACE_MINUTES=0
```

Use post times like `2:42 PM ET`, `4:18 PM CT`, etc.

## Scores

When using the free Equibase entry pages, premium speed figures are not included. The model estimates rankings from free fields like morning line, post position, and field depth. If you use CSV/Google Sheet mode, you can include your own speed/form/pace/class numbers and the model will use them.

Thresholds are controlled in `.env`:

```env
MIN_WIN_SCORE=78
MIN_EXACTA_SCORE=74
MIN_SUPERFECTA_SCORE=84
LONGSHOT_MIN_ODDS=8
MAX_LONGSHOT_ALERTS_PER_DAY=5
MAX_SUPERFECTA_ALERTS_PER_DAY=3
```

## Channel Overrides

Set these if you want separate Discord channels:

```env
WIN_BET_WEBHOOK_URL=
LONGSHOT_WEBHOOK_URL=
EXACTA_WEBHOOK_URL=
SUPERFECTA_WEBHOOK_URL=
RESULTS_WEBHOOK_URL=
```

If blank, everything posts to `DISCORD_WEBHOOK_URL`.

## Notes

This bot does not guarantee winners. It is a ranking/alert system for discussion and tracking. Bet responsibly.


## Important: upcoming-race scanner

The bot now does **not** only post at 8 AM. It also scans for upcoming races every `UPCOMING_SCAN_MINUTES` minutes and posts plays for races inside `UPCOMING_WINDOW_MINUTES`.

Recommended Railway variables:

```env
RUN_ON_START=true
UPCOMING_SCAN_MINUTES=15
UPCOMING_WINDOW_MINUTES=240
POST_TIME_GRACE_MINUTES=10
MIN_WIN_SCORE=68
MIN_EXACTA_SCORE=68
MIN_SUPERFECTA_SCORE=70
```

Manual Railway commands:

```bash
npm run upcoming
```

Debug the data source without posting:

```bash
npm run debug-source
```

If you see races loaded but no plays, lower the score thresholds. Free public pages do not include premium speed figures, so this bot estimates ratings from public fields like morning line and field depth.

If you see 0 raw races, the issue is usually `TRACK_CODES`, the public source blocking Railway, or the track not having a free Equibase entries page for that date.
