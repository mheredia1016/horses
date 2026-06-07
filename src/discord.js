import { config } from './config.js';

export async function postToDiscord(webhookUrl, payload) {
  if (config.dryRun) {
    console.log('--- DRY RUN DISCORD PAYLOAD ---');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!webhookUrl) {
    throw new Error('Missing Discord webhook URL. Set DISCORD_WEBHOOK_URL or a channel-specific webhook.');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${text}`);
  }
}
