import { config } from './config.js';
import { startScheduler } from './scheduler.js';
import { runUpcomingReport } from './run-upcoming.js';

console.log('Horse racing Discord bot starting...');
startScheduler();

if (config.schedule.runOnStart) {
  runUpcomingReport().catch((error) => console.error('[startup upcoming report]', error));
}
