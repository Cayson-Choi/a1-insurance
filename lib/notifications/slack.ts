// Slack Incoming Webhook 전송 — fire-and-forget.
// env SLACK_WEBHOOK_URL 이 설정돼 있을 때만 동작.

const TIMEOUT_MS = 3000;

export async function sendSlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
  } catch (e) {
    console.warn("[slack] webhook failed:", e instanceof Error ? e.message : e);
  } finally {
    clearTimeout(timer);
  }
}
