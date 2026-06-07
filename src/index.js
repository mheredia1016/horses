import { config } from './config.js';
import { startScheduler } from './scheduler.js';
import { runMorningReport } from './run-alerts.js';

console.log('Horse racing Discord bot starting...');
startScheduler();

if (config.schedule.runOnStart) {
  runMorningReport().catch((error) => console.error('[startup report]', error));
}
