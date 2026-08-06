import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:3333';
const OTHER_TENANT = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const slug = `sec-${Date.now().toString(36)}`;

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// ---- collectors ----
const consoleAll = [];
const failedRequests = [];
let screenApiCalls = []; // reset per screen

page.on('console', (m) => consoleAll.push({ type: m.type(), text: m.text().slice(0, 500) }));
page.on('pageerror', (e) => consoleAll.push({ type: 'pageerror', text: String(e).slice(0, 500) }));
page.on('response', (r) => {
  const isApi = r.url().startsWith(API);
  const entry = { method: r.request().method(), url: r.url().replace(API, ''), status: r.status(), type: r.request().resourceType() };
  if (isApi) screenApiCalls.push(entry);
  if (r.status() >= 400) failedRequests.push({ status: r.status(), url: r.url(), type: r.request().resourceType() });
});
page.on('requestfailed', (r) => failedRequests.push({ status: 'FAILED', url: r.url(), error: (r.failure() || {}).errorText }));

const out = [];
const report = (...a) => { const l = a.join(' '); out.push(l); console.log(l); };
let passCount = 0, failCount = 0;
const ok = (cond, label) => {
  report(`- ${cond ? 'PASS' : 'FAIL'}   ${label}`);
  cond ? passCount++ : failCount++;
};

async function gotoAndSettle(path, settleMs = 3000) {
  screenApiCalls = [];
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(settleMs);
  return [...screenApiCalls];
}

try {
  report(`# AGILIZA FULL USER JOURNEY — headed (fresh context), slug=${slug}, ${new Date().toISOString()}`);

  // ============ 1. REGISTER ============
  report(`## 1. Register (unique slug ${slug})`);
  await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1800);

  const lsBefore = await page.evaluate(() => ({ len: localStorage.length, keys: [...Object.keys(localStorage)] }));
  ok(lsBefore.len === 0, `fresh localStorage (len=${lsBefore.len}, keys=[${lsBefore.keys.join(',')}])`);

  const h1s = await page.locator('h1').allInnerTexts();
  ok(h1s.length === 1 && /criar conta/i.test(h1s[0] || ''), `register page renders h1="${h1s.join('|')}"`);

  await page.locator('#name').fill('Security Journey Tenant');
  await page.locator('#slug').fill(slug);
  await page.locator('#email').fill(`admin-${slug}@example.com`);

  const postRespPromise = page.waitForResponse(
    (r) => r.url().includes('/api/tenants') && r.request().method() === 'POST',
    { timeout: 30000 },
  ).catch(() => null);
  await page.locator('button:has-text("Criar conta")').click();
  const postResp = await postRespPromise;

  let postStatus = 'NO RESPONSE';
  let signupBody = null;
  if (postResp) {
    postStatus = postResp.status();
    try { signupBody = await postResp.json(); } catch {}
  }
  ok(postStatus === 201, `signup POST /api/tenants -> HTTP ${postStatus} (expected 201)`);

  const bodyToken = signupBody?.token;
  const bodyTenantId = signupBody?.data?.tenant?.id;
  ok(typeof bodyToken === 'string' && bodyToken.length > 20, `signup response body has token (len=${bodyToken?.length ?? 'n/a'})`);
  ok(typeof bodyTenantId === 'string' && UUID_RE.test(bodyTenantId), `signup response body has tenant uuid (${bodyTenantId ?? 'n/a'})`);

  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {});
  ok(page.url().includes('/dashboard'), `redirect after submit -> ${page.url()}`);
  await page.waitForTimeout(2500);

  const ls = await page.evaluate(() => ({
    auth_token: localStorage.getItem('auth_token'),
    tenant_id: localStorage.getItem('tenant_id'),
  }));
  ok(typeof ls.auth_token === 'string' && ls.auth_token.length > 20 && ls.auth_token.startsWith('eyJ'),
    `localStorage.auth_token = JWT (len=${ls.auth_token?.length ?? 0})`);
  ok(typeof ls.tenant_id === 'string' && UUID_RE.test(ls.tenant_id), `localStorage.tenant_id = uuid (${ls.tenant_id ?? 'null'})`);
  ok(ls.tenant_id === bodyTenantId, 'localStorage.tenant_id matches signup response');
  ok(ls.auth_token === bodyToken, 'localStorage.auth_token matches signup response');
  const tenantId = ls.tenant_id;

  // ============ 2. DASHBOARD ============
  report(`## 2. Dashboard`);
  const dashApi = await gotoAndSettle('/dashboard');
  const dashMain = await page.locator('main').innerText().catch(() => '');
  const dashError = (await page.getByText('Não foi possível carregar os dados').count()) > 0;
  ok(!dashApi.some((c) => c.status >= 400),
    `no 4xx/5xx API calls (${dashApi.map((c) => `${c.method} ${c.url}->${c.status}`).join('; ') || 'none'})`);
  ok(!dashError, 'no ErrorState');
  ok(!dashMain.includes('[object Object]'), 'no "[object Object]" in DOM');
  ok(!dashApi.some((c) => /tenantId=demo/.test(c.url)), 'no tenantId=demo in dashboard requests');
  ok(dashApi.some((c) => c.url.includes(tenantId)), `dashboard requests carry real tenant uuid (${tenantId.slice(0, 8)}…)`);
  report(`  dashboard data calls: ${dashApi.map((c) => `${c.method} ${c.url}->${c.status}`).join('; ') || 'NONE'}`);
  await page.screenshot({ path: '/tmp/security-journey-1-dashboard.png', fullPage: true });

  // ============ 3. ALL SCREENS ============
  report(`## 3. Screens (fresh tenant: empty states expected, ErrorState NOT)`);
  const screens = [
    ['/dashboard/clients', 'Clientes'],
    ['/dashboard/invoices', 'Faturas'],
    ['/dashboard/reminders', 'Lembretes'],
    ['/dashboard/risk', 'Risco'],
    ['/dashboard/reports', 'Relatórios'],
    ['/dashboard/settings', 'Configurações'],
  ];
  for (const [path, label] of screens) {
    const calls = await gotoAndSettle(path);
    const mainText = await page.locator('main').innerText().catch(() => '');
    const h1 = await page.locator('h1').allInnerTexts();
    const h1Len = h1.join('').trim().length;
    const hasError = (await page.getByText('Não foi possível carregar os dados').count()) > 0;
    const hasEmpty = (await page.locator('[role="status"]').count()) > 0;
    const stuckLoading = !hasError && !hasEmpty && mainText.trim().length <= h1Len + 8;
    const bad = calls.filter((c) => c.status >= 400);
    const demos = calls.filter((c) => /tenantId=demo/.test(c.url));
    const unscoped = calls.filter((c) => !c.url.includes(tenantId) && !/\/health|\/ready/.test(c.url));

    report(`- ${path} (${label}) — h1="${h1.join('|')}"`);
    ok(bad.length === 0, `  no 4xx/5xx API calls (${calls.map((c) => `${c.method} ${c.url}->${c.status}`).join('; ') || 'none'})`);
    ok(demos.length === 0, '  no tenantId=demo in requests');
    ok(unscoped.length === 0, `  every API call carries real tenant uuid (${calls.length} calls)`);
    ok(!hasError, '  no ErrorState');
    ok(!mainText.includes('[object Object]'), '  no "[object Object]" in DOM');
    ok(!stuckLoading, `  shows empty-state or data (empty=${hasEmpty ? 'yes' : 'no'}, stuckInLoading=${stuckLoading ? 'YES' : 'no'})`);

    if (path === '/dashboard/settings') {
      ok(calls.length > 0 && calls.every((c) => c.status === 200), `  settings API HTTP 200 (got ${calls.map((c) => c.status).join(',') || 'none'})`);
    }
    if (path === '/dashboard/risk' || path === '/dashboard/reports') {
      ok(!/demonstra|dados de demonstra/i.test(mainText), '  no demo-fallback content rendered');
      ok(!hasError && !stuckLoading, '  renders empty-state or data (no ErrorState, no demo fallback)');
    }
    report(`  empty state: ${hasEmpty ? (await page.locator('[role="status"] h3').allInnerTexts()).join(' | ') : 'no'}`);
    await page.screenshot({ path: `/tmp/security-journey-${label}.png`, fullPage: true });
  }

  // ============ 4. SECURITY REGRESSION SPOT-CHECKS ============
  report(`## 4. Security regression spot-checks (Bearer token of fresh tenant, ApiKey garbage)`);
  const sec = await page.evaluate(async ({ API, token, tenantId, other }) => {
    async function probe(label, url, headers) {
      let status = 'ERR';
      try {
        const res = await fetch(`${API}${url}`, { headers });
        status = res.status;
      } catch (e) {
        status = `FETCH_ERROR:${String(e).slice(0, 80)}`;
      }
      return { label, url, status };
    }
    return [
      await probe('own-tenant payment-provider (positive control)', `/api/tenants/${tenantId}/payment-provider`, { Authorization: `Bearer ${token}` }),
      await probe('cross-tenant payment-provider', `/api/tenants/${other}/payment-provider`, { Authorization: `Bearer ${token}` }),
      await probe('GET /api/tenants (list — removed)', '/api/tenants', { Authorization: `Bearer ${token}` }),
      await probe('garbage ApiKey', `/api/tenants/${tenantId}`, { Authorization: 'ApiKey garbage' }),
      await probe('missing auth header', `/api/tenants/${tenantId}/config`, {}),
    ];
  }, { API, token: ls.auth_token, tenantId, other: OTHER_TENANT });
  for (const s of sec) report(`- ${s.label}: HTTP ${s.status}`);
  ok(sec[0]?.status === 200, `positive control: own tenant payment-provider -> 200 (got ${sec[0]?.status})`);
  ok([403, 404].includes(sec[1]?.status), `cross-tenant payment-provider -> 403/404, NOT 200 (got ${sec[1]?.status})`);
  ok([403, 404].includes(sec[2]?.status), `GET /api/tenants (list) -> 403/404 (got ${sec[2]?.status})`);
  ok(sec[3]?.status === 401, `Authorization: ApiKey garbage -> 401 (got ${sec[3]?.status})`);
  ok(sec[4]?.status === 401, `missing Authorization header -> 401 (got ${sec[4]?.status})`);

  // ============ 5. MOBILE 390x844 ============
  report(`## 5. Mobile (390x844) — hamburger drawer`);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle('/dashboard', 2500);
  const hamburger = page.locator('button[aria-label="Abrir menu"]');
  ok(await hamburger.isVisible().catch(() => false), 'hamburger button visible on /dashboard');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  ok(!overflow, 'no horizontal overflow');
  await hamburger.click();
  const dialog = page.locator('[role="dialog"][aria-label="Menu móvel"]');
  ok(await dialog.isVisible().catch(() => false), 'drawer opens (role=dialog "Menu móvel")');
  await page.locator('nav[aria-label="Menu móvel"] a', { hasText: 'Clientes' }).click();
  await page.waitForTimeout(1800);
  const dialogGone = (await page.locator('[role="dialog"][aria-label="Menu móvel"]').count()) === 0;
  ok(dialogGone, 'drawer closes after nav link click');
  ok(page.url().includes('/dashboard/clients'), `navigated to /dashboard/clients (url=${page.url()})`);
  await page.screenshot({ path: '/tmp/security-journey-mobile-clients.png', fullPage: true });

  // ============ 6. CONSOLE / NETWORK ============
  report(`## 6. Console & network issues (grouped)`);
  const grouped = {};
  for (const c of consoleAll) {
    const key = c.type === 'error' ? 'console.error' : c.type === 'pageerror' ? 'pageerror' : c.type === 'warning' ? 'console.warning' : null;
    if (!key) continue;
    const short = c.text.replace(/\s+/g, ' ').slice(0, 200);
    (grouped[key] = grouped[key] || new Set()).add(short);
  }
  for (const k of Object.keys(grouped)) {
    report(`- ${k}: ${grouped[k].size} unique`);
    for (const m of grouped[k]) report(`    · ${m}`);
  }
  if (!Object.keys(grouped).length) report('- no console errors/warnings/pageerrors');

  const probeUrls = sec.map((s) => s.url).filter(Boolean);
  const unexpected = failedRequests.filter((f) => !probeUrls.some((u) => f.url.endsWith(u)));
  const expectedProbes = failedRequests.filter((f) => probeUrls.some((u) => f.url.endsWith(u)));
  report(`- failed requests total: ${failedRequests.length} (= ${expectedProbes.length} expected security-probe responses + ${unexpected.length} unexpected)`);
  if (expectedProbes.length) report(`  expected (probes): ${expectedProbes.map((f) => `[${f.status}] ${f.url.replace(API, '')}`).join('; ')}`);
  if (unexpected.length) {
    for (const f of unexpected) report(`    · UNEXPECTED [${f.status}] ${f.url}${f.error ? ` error=${f.error}` : ''}`);
  } else {
    report('- no unexpected failed requests');
  }
} catch (e) {
  report(`- JOURNEY ERROR: ${String(e).slice(0, 800)}`);
  failCount++;
}

report(`\n## SUMMARY: ${passCount} PASS / ${failCount} FAIL`);
await browser.close();
writeFileSync('/tmp/security-journey-report.md', out.join('\n'));
console.log(`\n(saved /tmp/security-journey-report.md)`);
