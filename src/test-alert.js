process.env.DRY_RUN = process.env.DRY_RUN || 'true';
const { runMorningReport } = await import('./run-alerts.js');

await runMorningReport();
