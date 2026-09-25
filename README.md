# Notary

Notary is a brokerage grade safety layer for tokenized stocks on Solana. It's not a brokerage itself, it never holds funds, never executes trades, never gives advice. It reads real data off chain and off a couple of market data APIs and tells you what it found: whether a dividend rebase matches what it should, whether your Kamino loan against a tokenized stock is closer to liquidation than you think, and whether a token address is actually the one it claims to be before you trade it.

Built for a Solana hackathon (Stocklana). See `JUDGES.md` for a full accurate walkthrough of what's really in here, including what's live on mainnet versus what writes to devnet.

## The problem

Tokenized stocks like xStocks and Ondo pay dividends by silently changing the Token-2022 scaled UI amount multiplier on your balance. There's no transaction to notice, and if the issuer withheld US tax on the way there's nothing telling you that happened unless you go check yourself. Separately, these tokens trade 24/7 while the real stock market is closed most of the week, so if you're borrowing against one on Kamino your collateral can move a lot before the market that prices it even reopens, and Kamino liquidations don't wait for Monday.

## What it does

- Reads your real holdings, dividend history, and Kamino loan positions straight off Solana mainnet
- Verifies dividend rebases against actual dividend data and classifies the result (matches expected yield, consistent with US withholding tax, or unexplained)
- Computes a gap stressed health factor for Kamino loans using the worst weekend price gap Notary has actually measured for that stock over the last year
- Lets you view any wallet by pasting its address, no wallet connection required
- Pre-trade checklist and token address checker on the Trade tab, deep links to Jupiter to actually trade, never executes anything itself
- Publishes risk attestations on chain through the Solana Attestation Service, and a separate user signed Endorse action built on the Solana Actions spec
- A Telegram bot with daily briefings and on demand commands
- An AI assistant (Ask Notary, via Groq) that only answers from real data it's been handed, refuses to guess
- A public read only API so other apps can pull the same risk data

Full breakdown of every tab and exactly what's real is in `JUDGES.md`.

## Tech stack

- Next.js 14 (App Router), TypeScript, Tailwind
- Solana web3.js, wallet adapter, Kamino's `klend-sdk`, `sas-lib` for the Solana Attestation Service
- Groq SDK for the LLM features
- Upstash Redis for Telegram subscriber state and cached market data
- Tiingo for historical stock prices, xStocks' public proof of reserves API for backing ratios
- GitHub Actions for the scheduled jobs (attestation refresh, market watch, daily briefings)

## Running it locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

There's no `.env.example` checked in, so create `.env.local` yourself with the variables below. Most features degrade gracefully without a key (they'll show insufficient data instead of crashing) but the app won't be very interesting without at least the Solana RPC and market data keys.

## Environment variables

| Variable | What it's for |
|---|---|
| `SOLANA_RPC_URL` | Mainnet RPC, used for reading real holdings, dividend history, Kamino positions |
| `SOLANA_DEVNET_RPC_URL` | Devnet RPC, used for the Endorse action and reading SAS attestations |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | RPC the wallet adapter connects to in the browser |
| `NOTARY_KEYPAIR` | 64 number JSON array, the backend keypair that signs and pays for published risk attestations |
| `GROQ_API_KEY` | Ask Notary and the Wallet Digest AI summary |
| `TIINGO_API_KEY` | Historical stock prices, used for weekend gap measurement and CPI day move checks |
| `MARKET_DATA_API_KEY` | Live stock price lookups |
| `JUPITER_API_KEY` | Jupiter quote API, used for trade cost / price impact estimates |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis, Telegram subscriber storage, weekend gap cache, market watch state |
| `TELEGRAM_BOT_TOKEN` | Sending messages as the bot |
| `TELEGRAM_WEBHOOK_SECRET` | Verifies incoming Telegram webhook requests are actually from Telegram |
| `CRON_SECRET` | Bearer token protecting `/api/cron/daily-briefing` |

## Project structure

```
app/
  page.tsx              landing page
  app/page.tsx           the actual app shell, six tabs plus alerts
  actions.ts              server actions, most of the app's logic gets called through here
  actions.json/route.ts   Solana Actions / Blinks manifest
  api/
    actions/verify/[symbol]  the Endorse Solana Action endpoint
    v1/                      the public read only API (registry, attestation, directory, market-watch)
    telegram/webhook         Telegram bot webhook
    cron/daily-briefing      Vercel cron endpoint for briefings
components/               UI components
components/views/         one component per tab / sub tab
lib/                      everything else: trust scoring, verification, risk math, market data, Kamino reads, SAS attestation, Telegram logic
scripts/                  cron job entry points plus a bunch of one off dev/debug scripts I used while building this
.github/workflows/        the three scheduled GitHub Actions jobs
```

## Scheduled jobs

Three GitHub Actions workflows, all in `.github/workflows/`:

- `refresh-attestations.yml`, every 6 hours, refreshes the on-chain risk attestations for the demo obligation pairs
- `market-watch.yml`, every 3 hours, checks the Kamino xStocks lending market for newly listed collateral and checks for alert conditions
- `telegram-daily-briefing.yml`, once a day at 07:00 UTC, sends the daily briefing to all subscribers

There's also a Vercel cron in `vercel.json` hitting `/api/cron/daily-briefing` at 13:00 UTC, which right now duplicates the GitHub Actions briefing job. Flagged in `JUDGES.md`, needs to become one path.

## License

Apache 2.0, see `LICENSE`.
