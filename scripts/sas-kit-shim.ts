/**
 * sas-kit-shim.ts
 *
 * Single re-export shim for @solana/kit primitives from sas-lib's own nested
 * @solana/kit@5.5.1 install. This guarantees version consistency with sas-lib's
 * instruction builders (getCreateCredentialInstruction, etc.) which were compiled
 * against 5.5.1. Do NOT import these from bare '@solana/kit' or '@solana/signers'
 * specifiers — those resolve to the root-hoisted @solana/kit@2.3.0 and will produce
 * incompatible TransactionSigner objects.
 *
 * Every SAS setup/publish script must import kit primitives FROM THIS FILE ONLY.
 */

// NOTE: tsx uses ESM interop to handle this .mjs import at runtime.
// The path is relative to this file's location (scripts/).
export {
  // RPC + WS
  createSolanaRpc,
  createSolanaRpcSubscriptions,

  // Signers
  createKeyPairSignerFromBytes,

  // Transaction message builders
  createTransactionMessage,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,

  // Signing + sending
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,

  // Address utilities
  address,

  // Blockhash helper
  pipe,
  // @ts-ignore
} from '../node_modules/sas-lib/node_modules/@solana/kit/dist/index.node.mjs';
