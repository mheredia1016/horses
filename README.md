# Horse Racing Discord Bot

Free-source starter bot for horse racing Discord alerts.

## Alert Types

- Best Win Bet
- Best Longshot
- Exacta Box
- Selective Superfecta Bomb
- Daily morning card
- Results placeholder report

This is Option A: no live odds scraping yet. It uses a CSV entries file so the bot is stable and easy to run on GitHub/Railway.

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

Optional recommended variables:

```env
TIMEZONE=America/Chicago
MORNING_REPORT_HOUR=8
RESULTS_REPORT_HOUR=21
RUN_ON_START=true
```

Railway start command:

```bash
npm start
```

## CSV Data Format

Default path:

```env
RACE_CSV_PATH=data/sample-races.csv
```

Columns:

```csv
date,track,race,post_time,surface,distance,program_number,horse,morning_line,jockey,trainer,speed_figure,recent_form,jockey_win_pct,trainer_win_pct,class_rating,pace_rating
```

The bot groups rows by date + track + race, scores each horse, then creates alerts.

## Scores

The model uses:

- Speed figure
- Recent form
- Pace rating
- Class rating
- Jockey win percentage
- Trainer win percentage
- Odds value boost

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

This bot does not guarantee winners. It is a ranking/alert system for discussion and tracking.
