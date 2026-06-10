# Horse Racing Discord Bot

Railway-ready Discord alerts for horse racing:

- Best Win Bet
- Best Longshot
- Exacta Box
- Selective Superfecta Box
- Daily/Upcoming scanner

## Important data-source note

Free Equibase scraping is not reliable on Railway. Equibase pages can be protected by bot detection, and datacenter IPs may receive block/interruption pages instead of race data. This version now defaults to:

```env
DATA_SOURCE=multi
```

`multi` tries sources in this order:

1. `PUBLIC_RACE_CSV_URL` if provided
2. SportsBetting3 free track pages when supported
3. Equibase mobile pages last

## Required Railway variable

```env
DISCORD_WEBHOOK_URL=your_discord_webhook
```

## Recommended Railway variables

```env
DATA_SOURCE=multi
TIMEZONE=America/Chicago
TRACK_CODES=CT,MNR,LAD,PRX,GP,SA,CD,SAR,WO,EMD,RP,HAW
RUN_ON_START=true
UPCOMING_SCAN_MINUTES=15
UPCOMING_WINDOW_MINUTES=720
POST_TIME_GRACE_MINUTES=20
MIN_WIN_SCORE=50
MIN_EXACTA_SCORE=50
MIN_SUPERFECTA_SCORE=55
```

## Commands

Start bot:

```bash
npm start
```

Run a diagnostic without posting:

```bash
npm run diagnose
```

Post upcoming alerts now:

```bash
npm run upcoming
```

Send a fake Discord test alert:

```bash
npm run test-alert
```

## Most stable free setup

The most stable free setup is a published Google Sheet as CSV:

```env
DATA_SOURCE=public_csv_url
PUBLIC_RACE_CSV_URL=https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
```

Required CSV columns:

```csv
date,track,track_code,race,post_time,program_number,horse,jockey,trainer,morning_line,speed_figure,recent_form,jockey_win_pct,trainer_win_pct,class_rating,pace_rating
```

CSV is not required, but it is the most stable free source if public pages block Railway.
