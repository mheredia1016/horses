import { config } from './config.js';

export async function postDiscord(content) {
  if (config.dryRun || !config.discordWebhookUrl) {
    console.log('\n--- DRY RUN DISCORD MESSAGE ---\n' + content + '\n--- END ---\n');
    return;
  }
  const res = await fetch(config.discordWebhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
}
