import Groq from 'groq-sdk';
import { VerificationResult } from './verification';
import { KnownAsset } from './known-assets';

export async function narrateVerificationResult(result: VerificationResult, asset: KnownAsset): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const raw = result.raw;
  const expectedYieldPct = (result.expectedPct * 100).toFixed(4);
  const actualYieldPct = (result.actualPct * 100).toFixed(4);
  const discrepancyPct = (result.discrepancy * 100).toFixed(1);

  const systemPrompt = `You are the narration engine for Notary, a trust and verification layer for tokenized equities on Solana.
Your job is to generate a short, factual, plain-English explanation of a corporate action verification.

TONE GUIDELINES:
- Factual and professional
- Plain-English (explain the economics simply)
- No hype language, no marketing fluff, no alarmist wording
- Explain WHAT was found and WHY it likely happened

CRITICAL RULES:
- You MUST reference the specific raw numbers provided in the prompt (dividend amount, price, discrepancy percentage).
- Do NOT generate a generic explanation that could apply to any result.
- If the verdict is "unexplained discrepancy", you MUST state plainly that the cause is not identified. Do NOT invent or guess plausible causes.`;

  const userPrompt = `Generate a verification narration for the following event:
Asset: ${asset.name} (${asset.symbol})
Dividend Amount: $${raw.dividendAmount}
Ex-Dividend Date: ${raw.exDividendDate}
Reference Price (day before ex-date): $${raw.referencePrice}

Calculations:
- Expected yield: ${expectedYieldPct}%
- Actual on-chain yield: ${actualYieldPct}%
- Discrepancy: ${discrepancyPct}%

Verdict: ${result.verdict}

Write a short (2-3 sentences) plain-English explanation of this result for the user.`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'qwen/qwen3.8-27b',
      temperature: 0.1,
      max_tokens: 150,
    });
    
    return chatCompletion.choices[0]?.message?.content || 'Failed to generate narration.';
  } catch (error) {
    console.error('Groq API error:', error);
    return 'Narration generation failed due to an API error.';
  }
}
