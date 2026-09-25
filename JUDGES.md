# Notary, notes for judges

I didn't get a demo video recorded in time, so this doc plus the landing page is the real pitch. Everything below I checked against the actual code before writing it down, so if it's in here it's real, not aspirational.

## The problem, in one paragraph

Tokenized stocks on Solana (xStocks, Ondo) pay dividends as a silent balance rebase through the Token-2022 scaled UI amount extension. Your token count just changes one day, no transaction you'd notice, and if there was a US withholding tax taken out you have no way to tell unless you go compare it yourself. On top of that these tokens trade 24/7 while the underlying stock market is closed something like 135 hours a week, so if you're borrowing against one on Kamino your collateral can move against you over a weekend while liquidations on Kamino don't take weekends off. Nobody sits between the issuer and the trader checking any of this. Notary is that missing layer. It never holds funds, never executes a trade, never tells you to buy or sell anything. It just checks things and tells you what it found.

## Try it in under a minute, no wallet needed

Open the app and paste a Solana address into "Enter Solana Address to View" in the top bar instead of connecting a wallet. I used `S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS` while building this and it had AAPLx and NVDAx in it, worth double checking the balance is still there before you use it live since I can't guarantee what's in it today. Once you're viewing an address:

- Portfolio tab shows real holdings with live prices
- Trust tab shows trust scores and reserve backing for whatever it holds
- Loans tab shows any Kamino borrow position against it, including the gap stressed health factor
- The bell icon in the header shows upcoming dividend and liquidation alerts for that wallet

None of this needs a wallet connection, a signature, or gas. It's read only.

## Two different on-chain mechanisms, please don't mix these up

There are two separate things happening on Solana devnet and they work completely differently, so I want to be precise about which is which.

**Endorse (Trust Registry tab).** This is a Solana Actions / Blinks compliant endpoint. Click Endorse next to any asset, it calls `GET /api/actions/verify/{symbol}` for the action metadata, then `POST` to get back an unsigned transaction, then Phantom signs it with the visitor's own wallet and it lands on devnet as a memo instruction recording that symbol's trust score at that moment. This one is genuinely user signed, the visitor pays and signs, nobody else. There's a manifest at `/actions.json` that maps `/registry/*` and `/verify/*` to this endpoint, so it's discoverable by any Blinks compatible client, not just my own UI.

**Risk attestations (Loans tab, "Publish on-chain").** This is different. This writes a real Solana Attestation Service (SAS) record for a Kamino obligation, deposited value, borrowed value, liquidation threshold, current health factor, gap stressed health factor, worst asset drawdown, all serialized against a schema and written under a credential PDA. But the signer here is my own backend keypair (`NOTARY_KEYPAIR`), not the visitor's wallet. The visitor triggers it, my server signs and pays for it. This is Notary attesting to what it computed, not the user attesting to anything. A GitHub Actions workflow also refreshes these on a schedule for two fixed obligation pairs I hardcoded for the demo (wallet `Fa7LNzj3SCV364hya9dx9evL29pC1awx24iHeCEwX6vU` with obligation `7BACsXdze3FporEnXEbuSHStPPQ58tpZuWb7jgsUYmV`, and a second pair `QqxKVDPcxMLQ8UL8wet8RTLuwtpjLH8841pcNYTNBYK` / `7CVz2GhYLE7U568LrY4pyFocmnLpSwScBQGXmNrpbzH8`). The first of those obligation addresses is also the default value pre-filled in the Developer API tab so you can hit it with one click.

Both write to devnet right now. I did that on purpose for the hackathon rather than spend real SOL on mainnet writes, and it's disclosed in the app itself, the reserve attestation and trust registry rows both say "Verified on Solana Devnet (demo)" right on the label, I didn't hide it.

## What's real vs mocked, since the AI generated pitch missed this

Everything that reads your holdings, your Kamino loan position, dividend history, and the historical Token-2022 multiplier changes reads real data off Solana **mainnet**, plus Tiingo for stock prices and the xStocks proof of reserves API for backing ratios. None of that is mocked or hardcoded. The only devnet part is the two writing mechanisms above. I think this mainnet read, devnet write split is actually the correct way to build this for a hackathon and I'd rather say it plainly than have someone assume the whole thing is fake because it says devnet somewhere.

## Walking through the app tab by tab

**Today.** Landing view inside the app, surfaces alerts and routes you to the rest.

**Portfolio.** Holdings with live prices, plus a Tax Export sub tab that generates a CSV from a purchase date, price, and share count, and a Portfolio Proof / unified statement export with a SHA-256 hash printed next to the download so you can verify the file wasn't altered after the fact (`sha256sum` against what's shown).

**Loans.** Collateral Risk view showing every Kamino obligation for the viewed wallet, health factor, gap stressed health factor computed against the worst weekend gap Notary has actually measured for that stock over the last year (needs at least 8 observed gaps before it'll show a number, otherwise it says insufficient data honestly instead of guessing), and the Publish on-chain button described above. Also a What If simulator for a hypothetical loan before you open one.

**Markets.** Price Parity compares the on-chain token price against the real underlying close. Market Watch tracks the actual Kamino xStocks lending market on chain for newly listed collateral, checked every 3 hours by a GitHub Actions job, not a static list someone typed in. Comparator lets you put two assets side by side. Trade is the pre-trade checklist tab, this is the one I really want you to look at:

- Paste a token address or a Jupiter link and Notary checks it against its own registry, and it specifically checks for addresses that share the first or last few characters with a real registered token but aren't actually it, which is a real scam pattern
- Pick a stock and size, it pulls a live Jupiter quote and shows estimated price impact for real trade sizes
- Hit Trade and you get a 7 row checklist: token address match, whether the US market is open right now, gap versus the last close, liquidity, price impact at your size, whether a dividend and trading pause is coming up, and the next CPI print date if it's within 2 days
- Then a button that deep links straight to `jup.ag/swap` with the right mints prefilled. Notary never touches your funds past that point, it's stated right in the modal

**Trust.** Trust Registry is the main table, trust score, verified event count, reserve ratio, on-chain proof link, and the Endorse button per asset. Trust Score and Reserve Attestation are the same data broken out as their own views. Asset Directory lists all 13 tracked assets with issuer and whether they're in the Kamino lending market.

**Developers.** The public API, covered below.

There's also an Alerts view reachable from the bell dropdown that isn't in the main sidebar, and a floating Ask Notary chat button in the corner on every screen.

## Ask Notary

Bottom right corner, every page. It's Groq running `qwen/qwen3.8-27b`, and the prompt I wrote for it is deliberately restrictive: answer only from the JSON data I hand it, never make up a number, and if the question is really a buy or sell question say plainly it can't give financial advice instead of guessing. It also handles the case where a score is null because there isn't enough data yet, the prompt explicitly tells it that's not the same thing as a bad score of zero, since an LLM will happily treat missing data as zero if you don't stop it. There's also a separate Wallet Digest feature, a one paragraph plain English AI summary of your holdings and loan status, with a template fallback that kicks in if the AI output doesn't pass a safety check or just echoes the raw numbers back without saying anything.

## Telegram bot

Full webhook setup, not a stub. `/start` subscribes you, `/wallet <address>` links a wallet so your briefing includes loan status, `/stop`, `/status`, `/briefing` pulls today's briefing on demand, `/cost SYMBOL AMOUNT` gives you a price impact estimate right in the chat, and anything that isn't a slash command goes straight to the same Ask Notary logic as the web app. The webhook checks the Telegram secret token with a timing safe comparison before doing anything. Daily briefings go out through a GitHub Actions job at 07:00 UTC that calls the send script directly. I noticed while reviewing this that there's also a Vercel cron hitting `/api/cron/daily-briefing` at 13:00 UTC doing basically the same thing, so right now there are two delivery paths running, which I should clean up to one before this goes further, flagging it here so it doesn't look like I missed it.

## Public API

Four endpoints, documented and testable right in the Developer tab of the app:

- `GET /api/v1/registry` returns the SAS schema layout and units so a third party can decode the raw attestation bytes themselves
- `GET /api/v1/attestation/{obligation}` returns a decoded risk attestation for a Kamino obligation pubkey, rate limited and cached
- `GET /api/v1/directory` returns the 13 tracked assets with a note on what the Kamino market flag actually means
- `GET /api/v1/market-watch` returns the recorded history of new listings Notary has observed on chain

There's also `scripts/consumer-demo.ts` in the repo showing a third party reading an attestation straight off chain using only `sas-lib`, no dependency on my API at all, which is the actual point of publishing to SAS instead of just storing this in my own database.

## Real addresses you can check right now

AAPLx notarization tx: `251HidB29MDnm3viyRods8ZP6VPWJmD6F5SFsWNR1gKwTPXo6vncuEtcYgzTvudtrn6Q5UC7qXGq8jXexmdw4ubn`

NVDAx notarization tx: `64bKZAc764iyu2gEJ9GqAUfu4Q2R8zCx9NVYtj7eSDAD1s6R7YSGdH5x3afCJEtppuaJdBbdZRh6BmWThD1uMhmM`

Both viewable on Solana Explorer with `?cluster=devnet` appended to the tx URL.

Mint addresses if you want to check the live scaled UI amount config yourself: AAPLx `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp`, TSLAx `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB`, NVDAx `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh`, AAPLon `123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo`, TSLAon `KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo`, NVDAon `gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo`.

## Honest limitations

- Devnet writes, explained above, not hiding it
- The Publish on-chain button itself already works for any wallet's Kamino obligation, that part isn't restricted. What is hardcoded to the two demo pairs is the unattended GitHub Actions job that refreshes attestations every 6 hours on its own, it needs fixed obligations to check since there's no one clicking a button at 3am. Opening that background job up to more wallets automatically is the next step, not the manual publish flow
- Two daily briefing delivery paths running at once, needs to be one
- Gap stressed health factor uses the worst weekend gap Notary has actually measured historically, it's a stress test against a real past event, not a live prediction of what will happen next weekend, and the app says this itself rather than overselling it

That's the whole thing.
