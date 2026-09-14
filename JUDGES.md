# Notary Walkthrough for Judges

## Summary
Notary is an independent on-chain trust and verification layer for tokenized equities on Solana (such as xStocks and Ondo). It solves a critical transparency problem: dividend rebases via the Token-2022 `scaledUiAmountConfig` are silent, apply an invisible ~30% US withholding tax, and differ by issuer. Currently, nobody verifies if issuers are handling these corporate actions correctly. By acting as a decentralized auditor, Notary provides necessary infrastructure—not just a trading app—to ensure accountability and verify the integrity of tokenized real-world assets.

## Try it in 60 seconds
You can inspect real wallet data without needing to connect a wallet:
1. Paste this real wallet address into the **"Enter Solana Address to View"** field in the top bar: `S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS`
2. Navigate to the **Trust Score** tab to see that AAPLx and NVDAx show as 100% verified.
3. Navigate to the **Reserve Attestation** tab to view real backing ratios pulled directly from Backed Finance's live API.

## Proof this is real, not mocked
The system writes actual verification results on-chain. You can independently confirm these devnet transactions:
* **NVDAx Notarization**: `64bKZAc764iyu2gEJ9GqAUfu4Q2R8zCx9NVYtj7eSDAD1s6R7YSGdH5x3afCJEtppuaJdBbdZRh6BmWThD1uMhmM`
  * [View on Explorer](https://explorer.solana.com/tx/64bKZAc764iyu2gEJ9GqAUfu4Q2R8zCx9NVYtj7eSDAD1s6R7YSGdH5x3afCJEtppuaJdBbdZRh6BmWThD1uMhmM?cluster=devnet)
* **AAPLx Notarization**: `251HidB29MDnm3viyRods8ZP6VPWJmD6F5SFsWNR1gKwTPXo6vncuEtcYgzTvudtrn6Q5UC7qXGq8jXexmdw4ubn`
  * [View on Explorer](https://explorer.solana.com/tx/251HidB29MDnm3viyRods8ZP6VPWJmD6F5SFsWNR1gKwTPXo6vncuEtcYgzTvudtrn6Q5UC7qXGq8jXexmdw4ubn?cluster=devnet)

We evaluate these real on-chain mint addresses:
* **AAPLx**: `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp`
* **TSLAx**: `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB`
* **NVDAx**: `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh`
* **AAPLon**: `123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo`
* **TSLAon**: `KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo`
* **NVDAon**: `gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo`

## Architecture at a glance
* Next.js frontend
* Reads live mainnet data via Helius RPC + Alpha Vantage/Tiingo
* Writes verification results to Solana devnet via Memo Program
* LLM narration via Groq

## Roadmap
* **(a)** Migrating notarization from a single-keypair-signed memo to a proper on-chain program with PDA-based verification records, queryable by any other Solana program or dApp without needing our API.
* **(b)** Decentralizing notary signing authority via a Squads multisig rather than a single trusted keypair.
