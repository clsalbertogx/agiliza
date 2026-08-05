import { chromium } from '@playwright/test';

const TOKEN = process.argv[2];
const routes = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/dashboard/clients', label: 'Clientes' },
  { path: '/dashboard/invoices', label: 'Faturas' },
  { path: '/dashboard/reminders', label: 'Lembretes' },
  { path: '/dashboard/risk', label: 'Risco' },
  { path: '/dashboard/reports', label: 'Relatórios' },
  { path: '/dashboard/settings', label: 'Configurações' },
  { path: '/billing', label: 'Billing' },
];

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript((token) => {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('tenant_id', 'c87a3abd-a449-40d7-8152-461a24a27fd5');
}, TOKEN);

const consoleErrors = [];
const badResponses = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 150)); });
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`[${r.status()}] ${r.url()}`); });

const results = [];
for (const r of routes) {
  try {
    const resp = await page.goto(`http://localhost:3000${r.path}`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(1800);
    const status = resp ? resp.status() : 'no-response';
    const h1 = await page.locator('h1').first().innerText().catch(() => 'none');
    const notFound = (await page.locator('text=404').count().catch(() => 0)) > 0;
    const sidebarItems = await page.locator('nav[aria-label="Navegação principal"] a').allInnerTexts().catch(() => []);
    const hasCards = (await page.locator('text=Total Faturado, text=Total de Clientes, text=Faturamento').count().catch(() => 0)) > 0;
    await page.screenshot({ path: `/tmp/final-${r.label.toLowerCase()}.png`, fullPage: true });
    results.push({ route: r.path, status, h1, notFound, sidebarCount: sidebarItems.length, sidebar: sidebarItems.join(','), hasCards });
    console.log(JSON.stringify(results[results.length - 1]));
  } catch (e) {
    results.push({ route: r.path, status: 'CRASH', error: String(e).slice(0, 150) });
    console.log(JSON.stringify(results[results.length - 1]));
  }
}

console.log('\n=== CONSOLE ERRORS ===');
console.log([...new Set(consoleErrors)].slice(0, 20).join('\n') || 'none');
console.log('\n=== HTTP>=400 ===');
console.log([...new Set(badResponses)].slice(0, 20).join('\n') || 'none');
await browser.close();
