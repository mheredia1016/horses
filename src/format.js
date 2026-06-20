export function formatRaceAlert(race, plays) {
  const post = race.postTimeMs ? new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short', timeStyle: 'short', timeZone: process.env.TIMEZONE || 'America/Chicago'
  }).format(new Date(race.postTimeMs)) : 'TBD';

  const lines = [
    `🏇 **Horse Racing Alerts**`,
    `**${race.name}**`,
    `Track: ${race.track} | Race: ${race.raceNumber} | Post: ${post}`,
    ''
  ];

  for (const play of plays) {
    lines.push(`${play.title} — Confidence ${play.score}`);
    lines.push(play.horses.map(h => `#${h.number} ${h.name}${h.americanOdds ? ` (${formatOdds(h.americanOdds)})` : ''}`).join(' • '));
    if (play.type === 'exacta') lines.push('Bet: $1 exacta box');
    if (play.type === 'superfecta') lines.push('Bet: $0.10 superfecta box');
    lines.push('');
  }
  return lines.join('\n').trim();
}

function formatOdds(n) {
  return n > 0 ? `+${n}` : String(n);
}
