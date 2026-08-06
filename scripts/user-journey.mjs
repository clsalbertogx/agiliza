import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [], badResponses = [], navTimes = {};
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 150)); });
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`[${r.status()}] ${r.url()}`); });

const report = (label, data) => { console.log(`### ${label}`, JSON.stringify(data)); };

try {
  // 1. REGISTER a brand new tenant
  await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
  report('register-page', { h1: await page.locator('h1').first().innerText().catch(() => 'none'), url: page.url() });
  const slug = `academia-${Date.now().toString(36)}`;
  // robust fill: find inputs by label text
  const inputs = await page.locator('input').all();
  report('register-inputs', { count: inputs.length, ids: await Promise.all(inputs.map((i) => i.getAttribute('id'))) });
  await page.locator('#name').fill('Academia Teste Jornada');
  await page.locator('#slug').fill(slug);
  await page.locator('#email').fill(`admin@${slug}.com`);
  await page.screenshot({ path: '/tmp/journey-1-register-filled.png' });
  await page.locator('button:has-text("Criar conta")').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  report('after-signup', { url: page.url() });
  await page.screenshot({ path: '/tmp/journey-2-dashboard-fresh.png', fullPage: true });
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  report('token-stored', { hasToken: !!token, tenantId: await page.evaluate(() => localStorage.getItem('tenant_id')) });

  // 2. EMPTY-STATE CHECK: new tenant has no clients/invoices — visit each screen, capture state
  const screens = ['/dashboard/clients', '/dashboard/invoices', '/dashboard/reminders', '/dashboard/risk', '/dashboard/reports', '/dashboard/settings'];
  for (const s of screens) {
    const t0 = Date.now();
    await page.goto(`http://localhost:3000${s}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1200);
    navTimes[s] = Date.now() - t0;
    const bodyText = (await page.locator('body').innerText().catch(() => '')).replace(/\n+/g, ' | ').slice(0, 300);
    const buttons = await page.locator('button').allInnerTexts().catch(() => []);
    const emptyState = (await page.locator('text=Nenhum, text=não há, text=vazio').count().catch(() => 0)) > 0;
    report(`screen:${s}`, { h1: await page.locator('h1').first().innerText().catch(() => 'none'), buttons, emptyState, bodyText });
    await page.screenshot({ path: `/tmp/journey-${s.replace(/\//g, '-')}.png`, fullPage: true });
  }

  // 3. CREATE A CLIENT (normal user action) — find the "Novo cliente" button or similar
  await page.goto('http://localhost:3000/dashboard/clients', { waitUntil: 'networkidle' });
  const createBtn = page.locator('button:has-text("Novo"), button:has-text("Criar"), a:has-text("Novo cliente")').first();
  const btnCount = await page.locator('button, a').count();
  report('clients-page-actions', { btnCount, hasCreate: await createBtn.count().catch(() => 0) });

  // 4. BILLING / subscribe flow — check what /billing does (known: static mock)
  await page.goto('http://localhost:3000/billing', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  report('billing', { h1: await page.locator('h1').first().innerText().catch(() => 'none') });
  await page.screenshot({ path: '/tmp/journey-billing.png', fullPage: true });

  // 5. RESPONSIVENESS — mobile viewport pass on the main screens
  await page.setViewportSize({ width: 390, height: 844 });
  for (const s of ['/dashboard', '/dashboard/clients', '/dashboard/settings', '/register']) {
    await page.goto(`http://localhost:3000${s}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const sidebarVisible = await page.locator('nav[aria-label="Navegação principal"]').isVisible().catch(() => false);
    const hamburger = await page.locator('button[aria-label*="menu" i], button:has(svg.lucide-menu)').count();
    report(`mobile:${s}`, { overflow, sidebarVisible, hamburger });
    await page.screenshot({ path: `/tmp/mobile-${s.replace(/\//g, '-')}.png`, fullPage: true });
  }
} catch (e) {
  report('journey-error', { error: String(e).slice(0, 300) });
}

console.log('\n=== CONSOLE ERRORS ===');
console.log([...new Set(consoleErrors)].slice(0, 20).join('\n') || 'none');
console.log('\n=== HTTP>=400 ===');
console.log([...new Set(badResponses)].slice(0, 25).join('\n') || 'none');
console.log('\n=== NAV TIMES ===');
console.log(JSON.stringify(navTimes));
await browser.close();
