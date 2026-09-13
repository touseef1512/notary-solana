const crypto = require('crypto');
async function test() {
  const res = await fetch('https://stooq.com/q/d/l/?s=nvda.us&i=d', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  let text = await res.text();
  const match = text.match(/const c="([^"]+)",d=(\d+)/);
  if (match) {
    console.log("Got challenge");
    const c = match[1];
    const d = parseInt(match[2], 10);
    const t = "0".repeat(d);
    let n = 0;
    while(true) {
      const hash = crypto.createHash('sha256').update(c + n).digest('hex');
      if (hash.startsWith(t)) break;
      n++;
    }
    console.log("Solved:", n);
    const verifyRes = await fetch('https://stooq.com/__verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': res.headers.get('set-cookie') || ''
      },
      body: `c=${encodeURIComponent(c)}&n=${n}`
    });
    console.log(verifyRes.status);
    const finalRes = await fetch('https://stooq.com/q/d/l/?s=nvda.us&i=d', {
      headers: { 'Cookie': verifyRes.headers.get('set-cookie') || res.headers.get('set-cookie') || '' }
    });
    console.log((await finalRes.text()).substring(0, 100));
  } else {
    console.log(text.substring(0, 100));
  }
}
test();
