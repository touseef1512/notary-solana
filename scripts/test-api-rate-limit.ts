import { createRateLimiter } from '../lib/api-rate-limit';
let pass = 0;
let fail = 0;
function check(name: string, ok: boolean) {
  if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); }
}
const a = createRateLimiter(3, 1000);
check('1st allowed', a('x', 0).allowed);
check('2nd allowed', a('x', 10).allowed);
check('3rd allowed', a('x', 20).allowed);
const blocked = a('x', 30);
check('4th blocked', !blocked.allowed);
check('retry seconds valid', Number.isInteger(blocked.retryAfterSeconds) && blocked.retryAfterSeconds >= 1);
check('other key allowed', a('y', 40).allowed);
check('allowed after window', a('x', 1001).allowed);
const b = createRateLimiter(3, 1000);
check('limiters independent', b('x', 50).allowed);
console.log(pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
