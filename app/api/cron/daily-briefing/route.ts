import { NextResponse } from 'next/server';
import { sendBriefingToChat } from '@/lib/telegram-briefing';
import { getAllSubscribers } from '@/lib/telegram-subscribers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const subscribers = await getAllSubscribers();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    try {
      const res = await sendBriefingToChat(sub.chatId);
      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }
  }

  return NextResponse.json({
    total: subscribers.length,
    successCount,
    failCount
  });
}
