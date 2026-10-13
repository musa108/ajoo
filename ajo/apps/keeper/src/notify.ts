import { settings } from "./config.js";

/** Reminders go to the console and, if WEBHOOK_URL is set, to any HTTP endpoint (Telegram relay, Slack, n8n...). */
export async function notify(kind: string, text: string, payload: Record<string, unknown>) {
  console.log(`[${new Date().toISOString()}] ${kind.toUpperCase()} ${text}`);
  if (!settings.webhookUrl) return;
  try {
    const res = await fetch(settings.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, text, ...payload }),
    });
    if (!res.ok) console.warn(`webhook responded ${res.status}`);
  } catch (e) {
    console.warn("webhook failed:", (e as Error).message);
  }
}
