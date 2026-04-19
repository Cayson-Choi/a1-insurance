// Telegram Bot sendMessage — fire-and-forget.
// env TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID 둘 다 설정돼 있을 때만 동작.

const TIMEOUT_MS = 3000;

export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // 미설정 시 조용히 skip

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[telegram] send failed:", res.status, body.slice(0, 200));
    }
  } catch (e) {
    console.warn(
      "[telegram] webhook failed:",
      e instanceof Error ? e.message : e,
    );
  } finally {
    clearTimeout(timer);
  }
}
