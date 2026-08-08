import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const slug = `smoke-journey-${Date.now()}`;
const results = [];
const rpt = (step, pass, note = '') => {
  results.push({ step, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${step} ${note}`);
};
const hasText = (page, re, ms = 8000) =>
  page
    .waitForFunction((rx) => rx.test(document.body.innerText), re, { timeout: ms })
    .then(() => true)
    .catch(() => false);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
// count only REAL app errors: uncaught exceptions + console errors that are not
// network-level artifacts of Next RSC prefetch aborts (ERR_ABORTED / Failed to load resource)
const appErrors = [];
const isNetworkNoise = (t) => /ERR_ABORTED|net::|Failed to load resource/.test(t);
page.on('console', (m) => {
  if (m.type() === 'error' && !isNetworkNoise(m.text())) appErrors.push(m.text().slice(0, 160));
});
page.on('pageerror', (e) => appErrors.push(`pageerror: ${String(e).slice(0, 200)}`));

try {
  const gotoHydrated = async (path, selector) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector(selector, { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(800);
  };

  // 1. signup journey
  await gotoHydrated('/register', '#slug');
  await page.locator('#name').fill(`Smoke Journey ${slug}`);
  await page.locator('#slug').fill(slug);
  await page.locator('#email').fill(`admin-${slug}@example.com`);
  const base0 = appErrors.length;
  await page.locator('button[type="submit"]').click();
  const redirected = await page
    .waitForURL(/\/dashboard$/, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  const storage = await page.evaluate(() => ({
    token: localStorage.getItem('auth_token'),
    tid: localStorage.getItem('tenant_id'),
  }));
  const step1Errs = appErrors.slice(base0).length;
  rpt(
    '1-signup',
    redirected && Boolean(storage.token && storage.tid) && step1Errs === 0,
    `url=${page.url()} token=${Boolean(storage.token)} tid=${Boolean(storage.tid)} appErrors=${step1Errs}`,
  );

  // 2. /dashboard loads cleanly
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  const base2 = appErrors.length;
  const errorState2 = await hasText(page, /Não foi possível carregar os dados/);
  const errs2 = appErrors.slice(base2).length;
  rpt('2-dashboard', errs2 === 0 && !errorState2, `appErrors=${errs2} errorState=${errorState2}`);

  // 3. /dashboard/clients: empty state OR data, no API error screen, no app errors
  await page.goto(`${BASE}/dashboard/clients`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);
  const base3 = appErrors.length;
  const empty = await hasText(page, /Nenhum cliente/);
  const data = !empty && (await hasText(page, /.+/, 4000));
  const apiErr = await hasText(page, /Não foi possível carregar os dados/, 4000);
  const errs3 = appErrors.slice(base3).length;
  rpt(
    '3-clients',
    (empty || data) && !apiErr && errs3 === 0,
    `empty=${empty} data=${data} apiError=${apiErr} appErrors=${errs3}`,
  );

  // 4. mobile drawer journey
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoHydrated('/dashboard', 'button[aria-label="Abrir menu"]');
  const base4 = appErrors.length;
  const burger = page.locator('button[aria-label="Abrir menu"]');
  const burgerVisible = await burger.isVisible().catch(() => false);
  await burger.click().catch(() => {});
  const drawerOpen = await page
    .locator('nav[aria-label="Menu móvel"]')
    .isVisible()
    .catch(() => false);
  const clientLink = page.locator('nav[aria-label="Menu móvel"] a', { hasText: 'Clientes' }).first();
  await clientLink.click().catch(() => {});
  const drawerClosed = await page
    .locator('nav[aria-label="Menu móvel"]')
    .isHidden()
    .catch(() => false);
  await page.waitForURL('**/clients', { timeout: 15000 }).catch(() => {});
  const errs4 = appErrors.slice(base4).length;
  rpt(
    '4-mobile-drawer',
    burgerVisible && drawerOpen && drawerClosed && errs4 === 0,
    `burger=${burgerVisible} opened=${drawerOpen} closed=${drawerClosed} appErrors=${errs4}`,
  );
} catch (e) {
  rpt('journey-aborted', false, String(e).slice(0, 300));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nRESULT: ${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
