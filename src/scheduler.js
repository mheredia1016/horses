import cron from 'node-cron';
import { config } from './config.js';
import { runMorningReport, runResultsReport } from './run-alerts.js';
import { runUpcomingReport } from './run-upcoming.js';

function safeRun(name, fn) {
  return async () => {
    try {
      console.log(`[${new Date().toISOString()}] Running ${name}`);
      await fn();
    } catch (error) {
      console.error(`[${name}]`, error);
    }
  };
}

export function startScheduler() {
  cron.schedule(`0 ${config.schedule.morningReportHour} * * *`, safeRun('morning report', runMorningReport), {
    timezone: config.timezone
  });

  cron.schedule(`*/${config.schedule.upcomingScanMinutes} * * * *`, safeRun('upcoming race scan', runUpcomingReport), {
    timezone: config.timezone
  });

  cron.schedule(`0 ${config.schedule.resultsReportHour} * * *`, safeRun('results report', runResultsReport), {
    timezone: config.timezone
  });

  console.log(`Scheduler active. Morning: ${config.schedule.morningReportHour}:00, Upcoming scan: every ${config.schedule.upcomingScanMinutes} min, Results: ${config.schedule.resultsReportHour}:00, TZ: ${config.timezone}`);
}
