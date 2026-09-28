// Renders the Android launcher icons (and a Play Store 512 px icon) from
// tools/dev/icon.html with Playwright. Needs the dev server running:
//   npm start &  node tools/android-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = new URL('../android/res/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const size of [144, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: size / 512 });
  await page.goto('http://localhost:8080/tools/dev/icon.html');
  await page.waitForFunction(() => window.iconReady);
  await page.locator('#c').screenshot({ path: `${out}ic_launcher_${size}.png`, omitBackground: true });
  await page.close();
  console.log(`ic_launcher_${size}.png`);
}
await browser.close();
