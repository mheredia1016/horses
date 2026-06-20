import { config } from './config.js';
import { runUpcomingScan } from './run.js';

async function safeRun() {
  try { await runUpcomingScan(); }
  catch (err) { console.error('Scan failed:', err.message); }
}

console.log('Horse Racing Discord Bot starting...');
console.log(`Scan interval: ${config.scanIntervalMinutes} minutes`);

if (config.runOnStart) await safeRun();
setInterval(safeRun, Math.max(1, config.scanIntervalMinutes) * 60 * 1000);
