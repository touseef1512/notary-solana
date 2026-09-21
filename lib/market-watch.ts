import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';
import { getParityAssets } from './parity-assets';
import {
  WatchState,
  CurrentMint,
  MarketWatchResult,
  findNewMints,
  mergeWatchState,
  isWatchState,
  WatchEntry,
} from './market-watch-core';

const KLEND_PROGRAM_ID = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
const XSTOCKS_MARKET = new PublicKey('5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua');
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

const REDIS_KEY = 'notary:watch:state';
const MIN_CHECK_INTERVAL_SECONDS = 600;
const REDIS_TIMEOUT_MS = 2000;
const CHAIN_TIMEOUT_MS = 5000;

let redisClient: Redis | null = null;
let redisInitialized = false;

function getRedis(): Redis | null {
  if (redisInitialized) return redisClient;
  redisInitialized = true;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redisClient = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return redisClient;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function readString(data: Buffer, ptr: number): { text: string; next: number } | null {
  if (ptr + 4 > data.length) return null;
  const len = data.readUInt32LE(ptr);
  const start = ptr + 4;
  if (len > 200 || start + len > data.length) return null;
  return { text: data.subarray(start, start + len).toString('utf8').replace(/\0/g, '').trim(), next: start + len };
}

function token2022Metadata(data: Buffer): { name: string; symbol: string } | null {
  if (data.length <= 166) return null;
  let ptr = 166;
  while (ptr + 4 <= data.length) {
    const type = data.readUInt16LE(ptr);
    const len = data.readUInt16LE(ptr + 2);
    const start = ptr + 4;
    if (start + len > data.length) return null;
    if (type === 19) {
      const name = readString(data, start + 64);
      if (!name) return null;
      const symbol = readString(data, name.next);
      if (!symbol) return null;
      return { name: name.text, symbol: symbol.text };
    }
    ptr = start + len;
  }
  return null;
}

function metaplexMetadata(data: Buffer): { name: string; symbol: string } | null {
  const name = readString(data, 65);
  if (!name) return null;
  const symbol = readString(data, name.next);
  if (!symbol) return null;
  return { name: name.text, symbol: symbol.text };
}

async function resolveSymbol(connection: Connection, mint: string): Promise<string> {
  try {
    const parityAssets = getParityAssets();
    for (let i = 0; i < parityAssets.length; i++) {
      if (parityAssets[i].mintAddress === mint) {
        return parityAssets[i].symbol;
      }
    }

    const mintPubkey = new PublicKey(mint);
    const info = await connection.getAccountInfo(mintPubkey);
    if (info) {
      if (info.owner.toBase58() === TOKEN_2022_PROGRAM) {
        const meta = token2022Metadata(info.data);
        if (meta) return meta.symbol;
      } else {
        const [pda] = PublicKey.findProgramAddressSync([Buffer.from('metadata'), METAPLEX_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()], METAPLEX_PROGRAM_ID);
        const mdInfo = await connection.getAccountInfo(pda);
        if (mdInfo) {
          const meta = metaplexMetadata(mdInfo.data);
          if (meta) return meta.symbol;
        }
      }
    }
  } catch {
    // silently ignore errors to fallback below
  }
  return mint.substring(0, 4) + '...' + mint.substring(mint.length - 4);
}

async function readReserveMints(connection: Connection): Promise<string[]> {
  const discriminator = createHash('sha256').update('account:Reserve').digest().subarray(0, 8);
  const accounts = await connection.getProgramAccounts(KLEND_PROGRAM_ID, {
    dataSlice: { offset: 128, length: 32 },
    filters: [
      { memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(discriminator) } },
      { memcmp: { offset: 32, bytes: XSTOCKS_MARKET.toBase58() } },
    ],
  });

  const uniqueMints: string[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const mintStr = new PublicKey(accounts[i].account.data).toBase58();
    if (uniqueMints.indexOf(mintStr) === -1) {
      uniqueMints.push(mintStr);
    }
  }
  return uniqueMints;
}

type ReadStateResult = { ok: true; state: WatchState | null } | { ok: false };

async function readState(): Promise<ReadStateResult> {
  try {
    const redis = getRedis();
    if (!redis) return { ok: false };

    const value = await withTimeout(redis.get(REDIS_KEY), REDIS_TIMEOUT_MS);
    if (value === null) return { ok: true, state: null };

    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (isWatchState(parsed)) {
      return { ok: true, state: parsed };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function getMarketWatch(options?: { dryRun?: boolean }): Promise<MarketWatchResult> {
  const nowTs = Math.floor(Date.now() / 1000);
  const stateResult = await readState();

  if (!stateResult.ok) {
    return {
      status: 'unavailable',
      reason: 'History storage is unavailable, so first-seen dates cannot be shown.',
      checkedNow: false,
      baselineTs: null,
      lastCheckedTs: null,
      entries: []
    };
  }

  const previousState = stateResult.state;
  if (previousState && (nowTs - previousState.lastCheckedTs < MIN_CHECK_INTERVAL_SECONDS)) {
    return {
      status: 'ok',
      reason: null,
      checkedNow: false,
      baselineTs: previousState.baselineTs,
      lastCheckedTs: previousState.lastCheckedTs,
      entries: previousState.entries
    };
  }

  const rpc = process.env.SOLANA_RPC_URL || process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpc);

  let merged: WatchState;
  try {
    const chainPhase = async () => {
      const mints = await readReserveMints(connection);
      if (mints.length === 0) {
        throw new Error('No reserves found');
      }

      const newMints = findNewMints(previousState, mints);
      const resolvedSymbols = await Promise.all(newMints.map(mint => resolveSymbol(connection, mint)));

      const currentMints: CurrentMint[] = [];
      for (let i = 0; i < mints.length; i++) {
        const mint = mints[i];
        let symbol = '';
        const newMintIndex = newMints.indexOf(mint);
        if (newMintIndex !== -1) {
          symbol = resolvedSymbols[newMintIndex];
        } else if (previousState) {
          for (let j = 0; j < previousState.entries.length; j++) {
            if (previousState.entries[j].mint === mint) {
              symbol = previousState.entries[j].symbol;
              break;
            }
          }
        }
        currentMints.push({ mint, symbol });
      }

      return mergeWatchState(previousState, currentMints, nowTs);
    };

    merged = await withTimeout(chainPhase(), CHAIN_TIMEOUT_MS);
  } catch {
    console.error('Market watch chain check failed');
    if (previousState) {
      return {
        status: 'ok',
        reason: 'Could not read the lending market just now. Showing the last recorded list.',
        checkedNow: false,
        baselineTs: previousState.baselineTs,
        lastCheckedTs: previousState.lastCheckedTs,
        entries: previousState.entries
      };
    } else {
      return {
        status: 'unavailable',
        reason: 'Could not read the lending market just now. Try again in a moment.',
        checkedNow: false,
        baselineTs: null,
        lastCheckedTs: null,
        entries: []
      };
    }
  }

  if (!options?.dryRun) {
    try {
      const redis = getRedis();
      if (redis) {
        await withTimeout(redis.set(REDIS_KEY, JSON.stringify(merged)), REDIS_TIMEOUT_MS);
      }
    } catch {
      console.error('Market watch redis set failed');
    }
  }

  return {
    status: 'ok',
    reason: null,
    checkedNow: true,
    baselineTs: merged.baselineTs,
    lastCheckedTs: merged.lastCheckedTs,
    entries: merged.entries
  };
}

export async function getStoredMarketWatch(): Promise<WatchEntry[]> {
  const stateResult = await readState();
  if (!stateResult.ok || stateResult.state === null) return [];
  return stateResult.state.entries;
}

export async function getStoredWatchState(): Promise<WatchState | null> {
  const stateResult = await readState();
  if (!stateResult.ok || stateResult.state === null) return null;
  return stateResult.state;
}
