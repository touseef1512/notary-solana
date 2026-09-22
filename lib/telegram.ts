export interface TelegramUpdate {
  update_id: number;
  message?: {
    chat?: {
      id: number;
    };
    text?: string;
  };
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });

    const data: { ok: boolean; description?: string } = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description };
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof Error) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: String(err) };
  }
}

export async function getTelegramUpdates(offset?: number): Promise<TelegramUpdate[]> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
  }

  let url = `https://api.telegram.org/bot${token}/getUpdates`;
  if (offset !== undefined) {
    url += `?offset=${offset}`;
  }

  const res = await fetch(url);
  const data: { ok: boolean; result: TelegramUpdate[] } = await res.json();
  if (!data.ok) {
    throw new Error('Failed to fetch Telegram updates');
  }
  return data.result;
}
