import { runMorningReport } from './run-alerts.js';

runMorningReport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
