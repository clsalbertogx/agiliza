import { chromium } from '@playwright/test';
const TOKEN = process.argv[2];
const routes = [
  ['/dashboard', 'Dashboard'],
  ['/dashboard/clients', 'Clientes'],
  ['/dashboard/invoices', 'Faturas'],
  ['/dashboard/reminders', 'Lembretes'],
  ['/dashboard/risk', 'Risco'],
  ['/dashboard/reports', 'Relatorios'],
  ['/dashboard/settings', 'Configuracoes'],
  ['/billing', 'Billing'],
];
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((t) => {
  localStorage.setItem('auth_token', t);
  localStorage.setItem('tenant_id', 'c87a3abd-a449-40d7-8152-461a24a27fd5');
}, TOKEN);
const consoleErrors = [], badResponses = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)); });
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`[${r.status()}] ${r.url()}`); });
const results = [];
for (const [path, label] of routes) {
  try {
    const resp = await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(1800);
    const status = resp ? resp.status() : 'no-response';
    const h1 = await page.locator('h1').first().innerText().catch(() => 'none');
    const notFound = (await page.locator('text=404').count().catch(() => 0)) > 0;
    await page.screenshot({ path: `/tmp/finalvalid-${label}.png`, fullPage: true });
    results.push({ route: path, status, h1, notFound });
    console.log(JSON.stringify(results[results.length - 1]));
  } catch (e) {
    results.push({ route: path, status: 'CRASH', error: String(e).slice(0, 120) });
    console.log(JSON.stringify(results[results.length - 1]));
  }
}
console.log('\n=== CONSOLE ERRORS ===');
console.log([...new Set(consoleErrors)].slice(0, 15).join('\n') || 'none');
console.log('\n=== HTTP>=400 ===');
console.log([...new Set(badResponses)].slice(0, 15).join('\n') || 'none');
await browser.close();