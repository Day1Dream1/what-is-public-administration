import { chromium } from 'playwright';
const [w, h, ...routes] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--no-sandbox'] });
for (const r of routes) {
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('' + (process.env.SITE || 'http://localhost:4173/') + '#/' + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const tag = r.replace(/[\/]/g, '_') + (w < 800 ? '_m' : '');
  await page.screenshot({ path: `./shots/our_${tag}_00.png` });
  const ys = await page.evaluate(() => [...document.querySelectorAll('.step')].map(s => { const c = s.querySelector('.step-card').getBoundingClientRect(); return c.top + scrollY + c.height / 2; }));
  let i = 0;
  for (const y of ys) {
    i++;
    await page.evaluate(y => window.scrollTo(0, y - innerHeight / 2), y);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `./shots/our_${tag}_${String(i).padStart(2, '0')}.png` });
  }
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(h => window.scrollTo(0, h), H); await page.waitForTimeout(900);
  await page.screenshot({ path: `./shots/our_${tag}_99end.png` });
  console.log(r, ys.length, 'steps', errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'ok');
  await page.close();
}
await browser.close();
