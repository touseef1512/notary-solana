import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { handleTelegramText } from "@/lib/telegram-commands";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");

  if (!secret || !headerSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const secretBuffer = Buffer.from(secret);
  const headerSecretBuffer = Buffer.from(headerSecret);

  if (secretBuffer.length !== headerSecretBuffer.length) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!crypto.timingSafeEqual(secretBuffer, headerSecretBuffer)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body?.message?.chat?.id || !body?.message?.text) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const chatId = String(body.message.chat.id);
    const text = body.message.text;

    const reply = await handleTelegramText(chatId, text);
    const sendRes = await sendTelegramMessage(chatId, reply);
    
    if (!sendRes.ok) {
      console.error(`Failed to send telegram message to ${chatId}: ${sendRes.error}`);
    }
  } catch {
    // Errors are swallowed to ensure a 200 response to Telegram.
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
