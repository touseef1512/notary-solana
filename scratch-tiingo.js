require('dotenv').config({ path: '.env.local' });
async function test() {
  const url = `https://api.tiingo.com/tiingo/daily/nvda/prices?token=${process.env.TIINGO_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(data.slice(0,2));
}
test();
