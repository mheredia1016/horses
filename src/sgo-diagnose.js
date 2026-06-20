import { config } from './config.js';
import { fetchSportsGameOddsRaces } from './sgo-client.js';

const races = await fetchSportsGameOddsRaces();
console.log('\n=== SPORTSGAMEODDS HORSE RACING DIAGNOSTICS ===');
console.log(`SPORTSGAMEODDS_API_KEY: ${config.sgo.apiKey ? 'set' : 'missing'}`);
console.log(`SGO sportID: ${config.sgo.sportID}`);
console.log(`Bookmakers: ${config.sgo.bookmakerIds.length ? config.sgo.bookmakerIds.join(',') : 'all available'}`);
console.log(`Races converted: ${races.length}`);
for (const race of races.slice(0, 20)) {
  console.log(`${race.track} Race ${race.race} post=${race.postTime} horses=${race.horses.length} eventID=${race.rawEventID}`);
  for (const horse of race.horses.slice(0, 8)) {
    console.log(`  #${horse.programNumber} ${horse.name} odds=${horse.morningLine} book=${horse.bestBook} fair=${horse.fairOdds} edge=${(horse.valueEdge * 100).toFixed(1)}%`);
  }
}
