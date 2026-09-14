export interface KnownAsset {
  symbol: string;
  name: string;
  issuer: string;
  mintAddress: string;
  underlyingTicker: string;
  notarizationSignature?: string;
}

export const KNOWN_ASSETS: KnownAsset[] = [
  {
    symbol: "AAPLx",
    name: "Apple xStock",
    issuer: "xStocks",
    mintAddress: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    underlyingTicker: "AAPL",
    notarizationSignature: "251HidB29MDnm3viyRods8ZP6VPWJmD6F5SFsWNR1gKwTPXo6vncuEtcYgzTvudtrn6Q5UC7qXGq8jXexmdw4ubn"
  },
  {
    symbol: "TSLAx",
    name: "Tesla xStock",
    issuer: "xStocks",
    mintAddress: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    underlyingTicker: "TSLA"
  },
  {
    symbol: "NVDAx",
    name: "NVIDIA xStock",
    issuer: "xStocks",
    mintAddress: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    underlyingTicker: "NVDA",
    notarizationSignature: "64bKZAc764iyu2gEJ9GqAUfu4Q2R8zCx9NVYtj7eSDAD1s6R7YSGdH5x3afCJEtppuaJdBbdZRh6BmWThD1uMhmM"
  },
  {
    symbol: "AAPLon",
    name: "Apple (Ondo Tokenized)",
    issuer: "Ondo",
    mintAddress: "123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo",
    underlyingTicker: "AAPL"
  },
  {
    symbol: "TSLAon",
    name: "Tesla (Ondo Tokenized)",
    issuer: "Ondo",
    mintAddress: "KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo",
    underlyingTicker: "TSLA"
  },
  {
    symbol: "NVDAon",
    name: "NVIDIA (Ondo Tokenized)",
    issuer: "Ondo",
    mintAddress: "gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo",
    underlyingTicker: "NVDA"
  }
];

export const KNOWN_ASSETS_MAP: Record<string, KnownAsset> = KNOWN_ASSETS.reduce((acc, asset) => {
  acc[asset.mintAddress] = asset;
  return acc;
}, {} as Record<string, KnownAsset>);
