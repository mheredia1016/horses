import { getSports, getHorseRacingEvents } from './sgo.js';
import { eventToRace } from './races.js';

console.log('Checking SportsGameOdds connection...');
const sports = await getSports().catch(err => ({ error: err.message }));
if (sports.error) console.log('Sports endpoint error:', sports.error);
else console.log('Sports endpoint OK. Response shape:', Array.isArray(sports) ? `array(${sports.length})` : Object.keys(sports).join(', '));

console.log('\nFetching HORSE_RACING events with oddsAvailable=true...');
const events = await getHorseRacingEvents();
console.log(`Raw events returned: ${events.length}`);
for (const event of events.slice(0, 10)) {
  const race = eventToRace(event);
  console.log(`- ${race?.name || event.eventID}: horses=${race?.horses.length || 0}, post=${race?.postTime || 'TBD'}`);
  if (race?.horses?.length) console.log('  ', race.horses.slice(0, 5).map(h => `#${h.number} ${h.name} ${h.americanOdds ?? ''}`).join(' | '));
}
if (!events.length) console.log('No horse racing events returned. Your API plan/key may not include HORSE_RACING or there may be no current odds available.');
