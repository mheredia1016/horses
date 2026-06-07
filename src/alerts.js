function raceTitle(race) {
  const bits = [`${race.track} Race ${race.race}`];
  if (race.postTime) bits.push(`Post: ${race.postTime}`);
  if (race.surface || race.distance) bits.push([race.distance, race.surface].filter(Boolean).join(' '));
  return bits.join(' • ');
}

function horseLine(horse) {
  return `#${horse.programNumber} ${horse.name} (${horse.morningLine || `${horse.oddsDecimal}/1`}) — Score ${horse.score}`;
}

export function buildMorningCardEmbed(plays) {
  const fields = [];

  if (plays.winBets[0]) {
    const play = plays.winBets[0];
    fields.push({
      name: '🏇 Best Win Bet',
      value: `**${raceTitle(play.race)}**\n${horseLine(play.horse)}`,
      inline: false
    });
  }

  if (plays.longshots[0]) {
    const play = plays.longshots[0];
    fields.push({
      name: '💰 Best Longshot',
      value: `**${raceTitle(play.race)}**\n${horseLine(play.horse)}`,
      inline: false
    });
  }

  if (plays.exactas[0]) {
    const play = plays.exactas[0];
    fields.push({
      name: '🎯 Best Exacta Box',
      value: `**${raceTitle(play.race)}**\n${play.horses.map((h) => `#${h.programNumber} ${h.name}`).join(' • ')}\nScore ${play.score}`,
      inline: false
    });
  }

  if (plays.superfectas[0]) {
    const play = plays.superfectas[0];
    fields.push({
      name: '💣 Top Superfecta Bomb',
      value: `**${raceTitle(play.race)}**\n${play.horses.map((h) => `#${h.programNumber}`).join(' • ')}\n$0.10 box cost: $2.40\nScore ${play.score}`,
      inline: false
    });
  }

  if (!fields.length) {
    fields.push({ name: 'No plays qualified', value: 'No races passed today\'s score thresholds.', inline: false });
  }

  return {
    username: 'Horse Racing Alerts',
    embeds: [{
      title: '🏇 Daily Horse Racing Card',
      description: 'Free-data model picks for win bets, longshots, exactas, and selective superfecta boxes.',
      fields,
      footer: { text: 'Bet responsibly. These are model alerts, not guaranteed winners.' },
      timestamp: new Date().toISOString()
    }]
  };
}

export function buildWinBetAlert(play) {
  return { username: 'Horse Racing Alerts', embeds: [{ title: '🏇 Best Win Bet Alert', description: `**${raceTitle(play.race)}**\n${horseLine(play.horse)}`, fields: [{ name: 'Why', value: 'Top model score in race with enough confidence to qualify.', inline: false }], timestamp: new Date().toISOString() }] };
}

export function buildLongshotAlert(play) {
  return { username: 'Horse Racing Alerts', embeds: [{ title: '💰 Longshot Alert', description: `**${raceTitle(play.race)}**\n${horseLine(play.horse)}`, fields: [{ name: 'Angle', value: `Qualified as value at ${play.horse.morningLine || `${play.horse.oddsDecimal}/1`} or higher.`, inline: false }], timestamp: new Date().toISOString() }] };
}

export function buildExactaAlert(play) {
  return { username: 'Horse Racing Alerts', embeds: [{ title: '🎯 Exacta Box Alert', description: `**${raceTitle(play.race)}**\n${play.horses.map((h) => `#${h.programNumber} ${h.name}`).join(' • ')}`, fields: [{ name: 'Bet', value: '$1 exacta box = $2 total', inline: true }, { name: 'Score', value: String(play.score), inline: true }], timestamp: new Date().toISOString() }] };
}

export function buildSuperfectaAlert(play) {
  return { username: 'Horse Racing Alerts', embeds: [{ title: '💣 Superfecta Bomb Alert', description: `**${raceTitle(play.race)}**\n${play.horses.map((h) => `#${h.programNumber} ${h.name}`).join(' • ')}`, fields: [{ name: 'Bet', value: '$0.10 superfecta box = $2.40 total', inline: true }, { name: 'Score', value: String(play.score), inline: true }], timestamp: new Date().toISOString() }] };
}

export function buildResultsPlaceholderEmbed() {
  return { username: 'Horse Racing Alerts', embeds: [{ title: '🏆 Daily Results Tracking', description: 'Results tracking is ready for a future results CSV/API step. For now, compare posted plays manually or add results to data/results.csv.', timestamp: new Date().toISOString() }] };
}
