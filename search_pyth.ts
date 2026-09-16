const symbols = ['AAPL', 'TSLA', 'NVDA', 'GOOGL', 'MSTR'];

async function search() {
  const res = await fetch('https://hermes.pyth.network/v2/price_feeds');
  const feeds = await res.json();
  for (const feed of feeds) {
    if (feed.attributes.asset_type === 'Equity' && feed.attributes.symbol.startsWith('Equity.US.')) {
      const sym = feed.attributes.symbol.split('.')[2].split('/')[0];
      if (symbols.includes(sym)) {
        console.log(sym, feed.attributes.symbol, feed.id);
      }
    }
  }
}
search().catch(console.error);
