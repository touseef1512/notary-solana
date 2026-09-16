import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { struct, u64, u8, publicKey, u128, array, u32 } from '@coral-xyz/borsh';
import BN from 'bn.js';

// Hardcoded for xStocks market as per requirements
const KLEND_PROGRAM_ID = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');
const XSTOCKS_MARKET = new PublicKey('5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua');

// Kamino Scaled Fraction base (2^60)
const SF_BASE = new BN(2).pow(new BN(60));

// Metaplex Token Metadata program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// We bypass anchor.BorshAccountsCoder because the full kamino IDL has nested arrays 
// that cause Anchor 0.29.0 to throw during layout instantiation. 
// Instead, we manually define the borsh layout matching the IDL exactly up to the fields we need.
const OBLIGATION_LAYOUT = struct([
  u64('tag'),
  struct([
    u64('slot'),
    u8('stale'),
    u8('priceStatus'),
    array(u8(), 2, 'alignmentPadding'),
    u32('timestamp'),
  ], 'lastUpdate'),
  publicKey('lendingMarket'),
  publicKey('owner'),
  array(
    struct([
      publicKey('depositReserve'),
      u64('depositedAmount'),
      u128('marketValueSf'),
      u64('borrowedAmountAgainstThisCollateralInElevationGroup'),
      array(u64(), 9, 'padding'),
    ]),
    8,
    'deposits'
  ),
  u64('lowestReserveDepositLiquidationLtv'),
  u128('depositedValueSf'),
  array(
    struct([
      publicKey('borrowReserve'),
      struct([array(u64(), 4, 'value'), array(u64(), 2, 'padding')], 'cumulativeBorrowRateBsf'),
      u64('lastBorrowedAtTimestamp'),
      u128('borrowedAmountSf'),
      u128('marketValueSf'),
      u128('borrowFactorAdjustedMarketValueSf'),
      u64('borrowedAmountOutsideElevationGroups'),
      struct([u8('autoRolloverEnabled'), u8('openTermAllowed'), u8('migrationToFixedEnabled'), u8('fixedTermRolloverWindowDurationDays'), u32('maxBorrowRateBps'), u64('minDebtTermSeconds')], 'fixedTermBorrowRolloverConfig'),
      u64('borrowedAmountAtExpiration'),
      array(u64(), 4, 'padding2'),
    ]),
    5,
    'borrows'
  ),
  u128('borrowFactorAdjustedDebtValueSf')
]);

function sfToReal(sfValue: BN | number | string): number {
  if (!sfValue) return 0;
  const val = new BN(sfValue.toString());
  return Number(val.toString()) / Number(SF_BASE.toString());
}

interface ReserveData {
  symbol: string;
  decimals: number;
  price: number;
}

async function getReserveData(connection: Connection, reservePubkey: PublicKey): Promise<ReserveData> {
  const fallback = { symbol: reservePubkey.toBase58(), decimals: 0, price: 0 };
  try {
    const accountInfo = await connection.getAccountInfo(reservePubkey);
    if (!accountInfo) return fallback;
    
    // Extract price and decimals from ReserveLiquidity
    const priceSf = new BN(accountInfo.data.subarray(248, 264), 'le');
    const price = sfToReal(priceSf);
    const decimals = Number(accountInfo.data.readBigUInt64LE(272));

    // Reserve data layout: discriminator(8) + version(8) + lastUpdate(16) + lendingMarket(32) + farmCollateral(32) + farmDebt(32)
    // The mint pubkey sits exactly at offset 8+8+16+32+32+32 = 128
    const mintPubkey = new PublicKey(accountInfo.data.subarray(128, 160));

    // Fetch metaplex metadata for the mint
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintPubkey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const metadataAccountInfo = await connection.getAccountInfo(metadataPda);
    if (metadataAccountInfo) {
      const data = metadataAccountInfo.data;
      const nameLen = data.readUInt32LE(65);
      const symbolOffset = 69 + nameLen;
      const symbolLen = data.readUInt32LE(symbolOffset);
      const symbolBytes = data.subarray(symbolOffset + 4, symbolOffset + 4 + symbolLen);
      const symbol = symbolBytes.toString('utf8').replace(/\0/g, '').trim();
      if (symbol) return { symbol, decimals, price };
    }
    
    // Fallback: Fetch mint account info to check for Token-2022 metadata extension (type 19)
    const mintAccountInfo = await connection.getAccountInfo(mintPubkey);
    if (mintAccountInfo && mintAccountInfo.data.length > 82) {
      const extBytes = Buffer.from([19, 0]);
      let index = mintAccountInfo.data.indexOf(extBytes, 82);
      while (index !== -1) {
        const len = mintAccountInfo.data.readUInt16LE(index + 2);
        if (index + 4 + len <= mintAccountInfo.data.length) {
          try {
            let ptr = index + 4 + 32 + 32; // Skip update_authority (32) and mint (32)
            const nameLen = mintAccountInfo.data.readUInt32LE(ptr); ptr += 4;
            ptr += nameLen;
            const symLen = mintAccountInfo.data.readUInt32LE(ptr); ptr += 4;
            const sym = mintAccountInfo.data.subarray(ptr, ptr + symLen).toString('utf8').replace(/\0/g, '').trim();
            if (sym.length > 0 && sym.length < 20) {
              return { symbol: sym, decimals, price };
            }
          } catch (e) {
            void e;
            // Not a valid TokenMetadata struct, continue searching
          }
        }
        index = mintAccountInfo.data.indexOf(extBytes, index + 1);
      }
    }
    
    return { symbol: mintPubkey.toBase58(), decimals, price };
  } catch (err) {
    console.error("Error resolving reserve data:", err);
    return fallback;
  }
}

export interface KaminoPosition {
  type: 'deposit' | 'borrow';
  reservePubkey: string;
  symbol: string;
  amount: number;
  valueUsd: number;
}

export interface KaminoObligationData {
  obligationPubkey: string;
  positions: KaminoPosition[];
  depositedValue: number;
  borrowedValue: number;
  currentLtv: number;
  liquidationLtvThreshold: number;
}

export async function getKaminoPositions(walletAddress: string): Promise<KaminoObligationData[]> {
  const connection = new Connection(process.env.SOLANA_RPC_URL || process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com');
  const walletPubkey = new PublicKey(walletAddress);

  const discriminator = Buffer.from([168, 206, 141, 106, 88, 76, 172, 167]); // sha256("account:Obligation").slice(0, 8)

  const accounts = await connection.getProgramAccounts(KLEND_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(discriminator) } },
      { memcmp: { offset: 32, bytes: XSTOCKS_MARKET.toBase58() } },
      { memcmp: { offset: 64, bytes: walletPubkey.toBase58() } },
    ],
  });

  if (accounts.length === 0) return [];

  const results: KaminoObligationData[] = [];
  const reserveCache = new Map<string, ReserveData>();

  const resolveReserve = async (reserve: PublicKey) => {
    const key = reserve.toBase58();
    if (reserveCache.has(key)) return reserveCache.get(key)!;
    const data = await getReserveData(connection, reserve);
    reserveCache.set(key, data);
    return data;
  };

  for (const account of accounts) {
    // Slice off the 8-byte discriminator before passing to standard borsh layout
    const buffer = account.account.data.subarray(8);
    const data = OBLIGATION_LAYOUT.decode(buffer);

    // We do NOT rely on data.depositedValueSf or data.borrowFactorAdjustedDebtValueSf
    // because obligations are often stale on Kamino and those fields drop to 0 until a refresh_obligation.
    // Instead, we compute live values per-item using the live market prices.
    let liveDepositedValue = 0;
    let liveBorrowedValue = 0;

    const positions: KaminoPosition[] = [];

    for (const d of data.deposits) {
      if (d.depositReserve.equals(PublicKey.default)) continue;
      const rawAmount = Number(d.depositedAmount.toString());
      if (rawAmount > 0) {
        const rData = await resolveReserve(d.depositReserve);
        const amount = rawAmount / Math.pow(10, rData.decimals);
        const valueUsd = amount * rData.price;
        liveDepositedValue += valueUsd;
        positions.push({
          type: 'deposit',
          reservePubkey: d.depositReserve.toBase58(),
          symbol: rData.symbol,
          amount,
          valueUsd,
        });
      }
    }

    for (const b of data.borrows) {
      if (b.borrowReserve.equals(PublicKey.default)) continue;
      const rawAtomicAmount = sfToReal(b.borrowedAmountSf);
      if (rawAtomicAmount > 0) {
        const rData = await resolveReserve(b.borrowReserve);
        const amount = rawAtomicAmount / Math.pow(10, rData.decimals);
        
        // Note: We use principal at live price rather than accrued interest.
        // True value would involve multiplying by (current_reserve_rate / obligation_rate),
        // but this is an acceptable approximation for reading active balances.
        const valueUsd = amount * rData.price;
        liveBorrowedValue += valueUsd;

        positions.push({
          type: 'borrow',
          reservePubkey: b.borrowReserve.toBase58(),
          symbol: rData.symbol,
          amount,
          valueUsd,
        });
      }
    }
    
    let currentLtv = 0;
    if (liveDepositedValue > 0) {
        currentLtv = liveBorrowedValue / liveDepositedValue;
    }

    results.push({
      obligationPubkey: account.pubkey.toBase58(),
      positions,
      depositedValue: liveDepositedValue,
      borrowedValue: liveBorrowedValue,
      currentLtv,
      liquidationLtvThreshold: Number(data.lowestReserveDepositLiquidationLtv.toString()) / 100,
    });
  }

  return results;
}
