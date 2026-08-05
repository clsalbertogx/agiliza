import { chromium } from '@playwright/test';

const TOKEN = process.argv[2];
const routes = [
  { path: '/', label: 'root (redirect)' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/dashboard/clients', label: 'Clientes' },
  { path: '/dashboard/invoices', label: 'Faturas' },
  { path: '/dashboard/reminders', label: 'Lembretes' },
  { path: '/dashboard/risk', label: 'Risco' },
  { path: '/dashboard/templates', label: 'Mensagens' },
  { path: '/dashboard/reports', label: 'Relatórios' },
  { path: '/dashboard/settings', label: 'Configurações' },
  { path: '/billing', label: 'Billing (PIX checkout)' },
];

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Inject auth so dashboard fetches REAL data
await page.addInitScript((token) => {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('tenant_id', 'c87a3abd-a449-40d7-8152-461a24a27fd5');
}, TOKEN);

const consoleErrors = [];
const failedRequests = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text().slice(0, 200)}`); });
page.on('requestfailed', (req) => failedRequests.push(`[req] ${req.url()} :: ${req.failure()?.errorText}`));
page.on('response', (res) => { if (res.status() >= 400) failedRequests.push(`[res ${res.status()}] ${res.url()}`); });

const results = [];
for (const r of routes) {
  try {
    const resp = await page.goto(`http://localhost:3000${r.path}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    const status = resp ? resp.status() : 'no-response';
    const title = await page.title().catch(() => 'n/a');
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 120).replace(/\n/g, ' | ');
    const h1 = await page.locator('h1').first().innerText().catch(() => 'none');
    const hasErrorState = (await page.locator('text=Erro ao carregar').count().catch(() => 0)) > 0;
    const notFound = (await page.locator('text=404').count().catch(() => 0)) > 0;
    const hasSidebar = (await page.locator('nav[aria-label="Navegação principal"]').count().catch(() => 0)) > 0;
    await page.screenshot({ path: `/tmp/screen-${r.label.replace(/\s|\(|\)/g, '').toLowerCase()}.png`, fullPage: true });
    results.push({ route: r.path, label: r.label, status, title, h1, hasErrorState, notFound, hasSidebar, bodyText });
    console.log(JSON.stringify(results[results.length - 1]));
  } catch (e) {
    results.push({ route: r.path, label: r.label, status: 'CRASH', error: String(e).slice(0, 200) });
    console.log(JSON.stringify(results[results.length - 1]));
  }
}

console.log('\n=== CONSOLE ERRORS ===');
console.log([...new Set(consoleErrors)].slice(0, 25).join('\n') || 'none');
console.log('\n=== FAILED/HTTP>=400 REQUESTS ===');
console.log([...new Set(failedRequests)].slice(0, 30).join('\n') || 'none');
await browser.close();
