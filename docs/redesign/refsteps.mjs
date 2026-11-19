import { chromium } from 'playwright';
const chapters = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--no-sandbox'] });
for (const ch of chapters) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://whatisstrategy.org/' + ch, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `./shots/ref_${ch.replace(/\//g,'_')}_00hero.png` });
  // desktop step cards: visible elements with border-l-2 + rounded containing a 2-digit label
  const ys = await page.evaluate(() => [...document.querySelectorAll('div')].filter(d => /border-l-2/.test(d.className) && /rounded/.test(d.className) && d.getBoundingClientRect().width > 0 && /^\s*\d\d\s/.test(d.innerText)).map(d => ({ y: d.getBoundingClientRect().top + scrollY + d.getBoundingClientRect().height / 2, t: d.innerText.slice(0, 70).replace(/\n/g, ' ') })));
  const txt = [];
  let i = 0;
  for (const s of ys) {
    i++;
    await page.evaluate(y => window.scrollTo(0, y - innerHeight / 2), s.y);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `./shots/ref_${ch.replace(/\//g,'_')}_${String(i).padStart(2,'0')}.png` });
    txt.push(`${i}\t${s.t}`);
  }
  // interludes and end
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(h => window.scrollTo(0, h), H); await page.waitForTimeout(1200);
  await page.screenshot({ path: `./shots/ref_${ch.replace(/\//g,'_')}_99end.png` });
  console.log(`== ${ch}: ${ys.length} steps, H=${H}\n` + txt.join('\n'));
  await page.close();
}
await browser.close();
