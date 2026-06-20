function impliedProbability(americanOdds) {
  if (!americanOdds) return 0.08;
  if (americanOdds < 0) return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  return 100 / (americanOdds + 100);
}

export function scoreRace(race) {
  const probs = race.horses.map(h => impliedProbability(h.americanOdds));
  const max = Math.max(...probs, 0.01);
  const scored = race.horses.map((h, i) => {
    const marketScore = (probs[i] / max) * 85;
    const longshotBonus = h.americanOdds >= 800 ? 8 : h.americanOdds >= 500 ? 4 : 0;
    return { ...h, score: Math.round(Math.min(99, marketScore + longshotBonus)) };
  }).sort((a, b) => b.score - a.score);
  return { ...race, horses: scored };
}

export function buildPlays(scoredRace, config) {
  const h = scoredRace.horses;
  const plays = [];
  if (config.enableWinBets && h[0]?.score >= config.minWinScore) {
    plays.push({ type: 'win', title: '🏇 BEST WIN BET', horses: [h[0]], score: h[0].score });
  }
  if (config.enableLongshots) {
    const longshot = h.find(x => x.americanOdds >= config.longshotMinAmericanOdds && x.score >= config.minWinScore - 8);
    if (longshot) plays.push({ type: 'longshot', title: '💰 BEST LONGSHOT', horses: [longshot], score: longshot.score });
  }
  if (config.enableExactas && h.length >= 2 && ((h[0].score + h[1].score) / 2) >= config.minExactaScore) {
    plays.push({ type: 'exacta', title: '🎯 EXACTA BOX', horses: h.slice(0, 2), score: Math.round((h[0].score + h[1].score) / 2) });
  }
  if (config.enableSuperfectas && h.length >= 4) {
    const avg4 = h.slice(0, 4).reduce((s, x) => s + x.score, 0) / 4;
    if (avg4 >= config.minSuperfectaScore) {
      plays.push({ type: 'superfecta', title: '💣 SUPERFECTA BOX', horses: h.slice(0, 4), score: Math.round(avg4) });
    }
  }
  return plays;
}
