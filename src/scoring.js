function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function oddsValueBoost(oddsDecimal) {
  if (oddsDecimal >= 15) return 8;
  if (oddsDecimal >= 10) return 6;
  if (oddsDecimal >= 8) return 5;
  if (oddsDecimal >= 5) return 3;
  if (oddsDecimal <= 2) return -3;
  return 0;
}

export function scoreHorse(horse) {
  const base =
    horse.speedFigure * 0.3 +
    horse.recentForm * 0.2 +
    horse.paceRating * 0.15 +
    horse.classRating * 0.15 +
    horse.jockeyWinPct * 0.5 +
    horse.trainerWinPct * 0.5 +
    oddsValueBoost(horse.oddsDecimal);

  return {
    ...horse,
    score: Math.round(clamp(base))
  };
}

export function scoreRace(race) {
  const horses = race.horses
    .map(scoreHorse)
    .sort((a, b) => b.score - a.score);

  return {
    ...race,
    horses,
    raceScore: horses.length ? Math.round(horses.slice(0, 4).reduce((sum, h) => sum + h.score, 0) / Math.min(4, horses.length)) : 0
  };
}

export function buildPlays(races, scoringConfig) {
  const scoredRaces = races.map(scoreRace);
  const winBets = [];
  const longshots = [];
  const exactas = [];
  const superfectas = [];

  for (const race of scoredRaces) {
    const [top, second, third, fourth] = race.horses;
    if (!top || !second) continue;

    if (top.score >= scoringConfig.minWinScore) {
      winBets.push({ type: 'WIN_BET', race, horse: top, score: top.score });
    }

    const longshot = race.horses.find(
      (horse) => horse.oddsDecimal >= scoringConfig.longshotMinOdds && horse.score >= scoringConfig.minWinScore - 6
    );
    if (longshot) {
      longshots.push({ type: 'LONGSHOT', race, horse: longshot, score: longshot.score });
    }

    const exactaScore = Math.round((top.score + second.score) / 2);
    if (exactaScore >= scoringConfig.minExactaScore) {
      exactas.push({ type: 'EXACTA_BOX', race, horses: [top, second], score: exactaScore });
    }

    if (third && fourth) {
      const superScore = Math.round((top.score + second.score + third.score + fourth.score) / 4);
      const hasValueHorse = [top, second, third, fourth].some((horse) => horse.oddsDecimal >= scoringConfig.longshotMinOdds);
      if (superScore >= scoringConfig.minSuperfectaScore && hasValueHorse) {
        superfectas.push({ type: 'SUPERFECTA_BOX', race, horses: [top, second, third, fourth], score: superScore });
      }
    }
  }

  return {
    scoredRaces,
    winBets: winBets.sort((a, b) => b.score - a.score),
    longshots: longshots.sort((a, b) => b.score - a.score).slice(0, scoringConfig.maxLongshotAlertsPerDay),
    exactas: exactas.sort((a, b) => b.score - a.score),
    superfectas: superfectas.sort((a, b) => b.score - a.score).slice(0, scoringConfig.maxSuperfectaAlertsPerDay)
  };
}
