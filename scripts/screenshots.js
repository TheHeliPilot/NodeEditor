// Renders the panel pages to PNG. Start `npm run demo` first.
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', 'screenshots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/login`);
  await page.screenshot({ path: path.join(OUT, '00-login.png') });
  await page.fill('input[name=username]', 'demo');
  await page.fill('input[name=password]', 'demo-heslo-123');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);

  const shots = [['01-statistiky', '/'], ['02-prihlaseni', '/signups'], ['03-hry', '/games'], ['04-nastavenia', '/settings'], ['05-admini', '/admins']];
  for (const [name, url] of shots) {
    await page.goto(BASE + url);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: url !== '/signups' });
  }
  // Tooltip on a chart point
  await page.goto(BASE + '/');
  const hit = page.locator('svg.chart').first().locator('rect.hit').nth(22);
  await hit.hover();
  await page.screenshot({ path: path.join(OUT, '06-tooltip.png'), clip: { x: 224, y: 0, width: 1216, height: 760 } });

  // Fresh invite link view
  await page.goto(BASE + '/admins');
  await page.fill('input[name=note]', 'Peter');
  await Promise.all([page.waitForNavigation(), page.click('form.add button')]);
  await page.screenshot({ path: path.join(OUT, '07-novy-odkaz.png') });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mobile.context().addCookies(await page.context().cookies());
  await mobile.goto(BASE + '/');
  await mobile.screenshot({ path: path.join(OUT, '08-mobil.png'), fullPage: true });
  await browser.close();
})();
