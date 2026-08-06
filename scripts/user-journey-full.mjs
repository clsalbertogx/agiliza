import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API = 'http://localhost:3333';
const slug = `slackware-journey-${Date.now()}`;

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// ---------- collectors ----------
const consoleAll = [];          // {type,text}
const failedRequests = [];      // {status,url,type} or requestfailed
let currentApiCalls = [];       // reset per screen, api-only responses

page.on('console', (m) => consoleAll.push({ type: m.type(), text: m.text().slice(0, 400) }));
page.on('pageerror', (e) => consoleAll.push({ type: 'pageerror', text: String(e).slice(0, 400) }));
page.on('response', (r) => {
  if (r.url().startsWith(API)) {
    currentApiCalls.push({ method: r.request().method(), url: r.url().replace(API, ''), status: r.status() });
  }
  if (r.status() >= 400) {
    failedRequests.push({ status: r.status(), url: r.url(), type: r.request().resourceType() });
  }
});
page.on('requestfailed', (r) => failedRequests.push({ status: 'FAILED', url: r.url(), error: (r.failure() || {}).errorText }));

const out = [];
const report = (...args) => { const line = args.join(' '); out.push(line); console.log(line); };

async function gotoAndSettle(path, settleMs = 2500) {
  currentApiCalls = [];
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(settleMs);
  return [...currentApiCalls];
}

async function screenSnapshot() {
  const body = (await page.locator('body').innerText().catch(() => ''));
  const h1s = await page.locator('h1').allInnerTexts().catch(() => []);
  const buttons = (await page.locator('button').allInnerTexts().catch(() => []))
    .map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const links = (await page.locator('a').allInnerTexts().catch(() => []))
    .map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const emptyTitles = await page.locator('[role="status"] h3').allInnerTexts().catch(() => []);
  const sidebarLinks = await page.locator('aside a').allInnerTexts().catch(() => []);
  return { body, h1s, buttons, links, emptyTitles, sidebarLinks };
}

try {
  // ============ 1. SIGNUP ============
  report(`## JOURNEY REPORT (headed, fresh tenant slug=${slug})`);
  await page.goto(`${BASE}/register`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  const h1Count = await page.locator('h1').count();
  report(`### 1. Signup`);
  report(`- h1 count: ${h1Count} (${h1Count === 1 ? 'PASS' : 'FAIL'})`);
  report(`- h1 text: ${(await page.locator('h1').allInnerTexts()).join(' | ')}`);
  report(`- url before submit: ${page.url()}`);

  await page.locator('#name').fill('Slackware Journey Tenant');
  await page.locator('#slug').fill(slug);
  await page.locator('#email').fill(`admin-${slug}@example.com`);

  const postRespPromise = page.waitForResponse(
    (r) => r.url().includes('/api/tenants') && r.request().method() === 'POST',
    { timeout: 20000 },
  ).catch(() => null);
  const tPost0 = Date.now();
  await page.locator('button:has-text("Criar conta")').click();
  const postResp = await postRespPromise;
  const postRoundTrip = Date.now() - tPost0;

  let postStatus = 'NO RESPONSE', tokenInBody = 'n/a';
  if (postResp) {
    postStatus = postResp.status();
    try {
      const json = await postResp.json();
      tokenInBody = typeof json.token === 'string' && json.token.length > 20 ? `present (${json.token.length} chars)` : 'MISSING';
    } catch { tokenInBody = 'body parse error'; }
  }
  report(`- signup POST: HTTP ${postStatus}, round-trip ${postRoundTrip}ms, token in body: ${tokenInBody}`);

  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  report(`- redirect after submit: ${page.url()} (${page.url().includes('/dashboard') ? 'PASS' : 'FAIL'})`);

  const ls = await page.evaluate(() => ({
    auth_token: localStorage.getItem('auth_token'),
    tenant_id: localStorage.getItem('tenant_id'),
  }));
  report(`- auth_token stored: ${ls.auth_token ? `PASS (len ${ls.auth_token.length})` : 'FAIL (empty/null)'}`);
  report(`- tenant_id stored: ${ls.tenant_id === null ? 'FAIL (null — register page never sets it)' : ls.tenant_id}`);
  await page.screenshot({ path: '/tmp/journey-full-dashboard-fresh.png', fullPage: true });

  // ============ 2. DASHBOARD ============
  report(`### 2. Dashboard`);
  const dashApi = await gotoAndSettle('/dashboard');
  const dashSnap = await screenSnapshot();
  report(`- data calls: ${dashApi.map((c) => `${c.method} ${c.url} -> ${c.status}`).join('; ') || 'NONE'}`);
  report(`- h1: ${dashSnap.h1s.join(' | ') || 'none'}`);
  report(`- greeting/nav: sidebar items=${dashSnap.sidebarLinks.join(', ')}`);
  report(`- empty state on dashboard: ${dashSnap.emptyTitles.join(' | ') || 'no'}`);

  // ============ 3. WALK SIDEBAR SCREENS ============
  const screens = [
    ['/dashboard/clients', 'Clientes'],
    ['/dashboard/invoices', 'Faturas'],
    ['/dashboard/reminders', 'Lembretes'],
    ['/dashboard/risk', 'Risco'],
    ['/dashboard/reports', 'Relatórios'],
    ['/dashboard/settings', 'Configurações'],
  ];
  report(`### 3. Screens`);
  for (const [path, label] of screens) {
    const apiCalls = await gotoAndSettle(path);
    const snap = await screenSnapshot();
    const mainCall = apiCalls.find((c) => c.method === 'GET' && !c.url.includes('/clients')) || apiCalls[0] || null;
    report(`- ${path} (${label}):`);
    report(`   data calls: ${apiCalls.length ? apiCalls.map((c) => `${c.method} ${c.url}->${c.status}`).join('; ') : 'NONE'}`);
    report(`   h1: ${snap.h1s.join(' | ') || 'none'}`);
    report(`   empty state: ${snap.emptyTitles.join(' | ') || 'no'}`);
    report(`   buttons: [${snap.buttons.join('; ') || 'none'}]`);
    const hasNovo = snap.buttons.some((b) => /novo/i.test(b)) || snap.links.some((l) => /novo/i.test(l));
    report(`   "Novo cliente" create button: ${hasNovo ? 'YES' : 'NO'}`);
    const statusSnippet = snap.body.replace(/\n+/g, ' | ').slice(0, 180);
    report(`   body snippet: ${statusSnippet}`);
    await page.screenshot({ path: `/tmp/journey-full-${label}.png`, fullPage: true });
  }

  // ============ 4. BILLING (static mock) ============
  const billApi = await gotoAndSettle('/billing');
  const billSnap = await screenSnapshot();
  report(`- /billing (assinatura, static mock): h1=${billSnap.h1s.join(' | ') || 'none'}; buttons=[${billSnap.buttons.join('; ')}]; apiCalls=${billApi.length ? billApi.map((c) => c.url + '->' + c.status).join(';') : 'none'}`);
  await page.screenshot({ path: '/tmp/journey-full-billing.png', fullPage: true });

  // ============ 5. MOBILE 390x844 ============
  report(`### 4. Mobile (390x844)`);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle('/dashboard', 2000);
  const mob = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const navs = [...document.querySelectorAll('nav')].map((n) => ({
      label: n.getAttribute('aria-label') || 'no-label',
      visible: n.offsetParent !== null,
      links: n.querySelectorAll('a').length,
    }));
    const hamburgers = [];
    document.querySelectorAll('button, [role="button"], a').forEach((el) => {
      const aria = el.getAttribute('aria-label') || '';
      const svgCls = el.querySelector('svg')?.className?.baseVal || el.querySelector('svg')?.getAttribute('class') || '';
      const txt = (el.textContent || '').trim();
      if (/menu|hamburger|navega/i.test(aria) || /lucide-menu/.test(svgCls) || txt === '☰' || txt === '≡') {
        hamburgers.push({ tag: el.tagName, aria, text: txt.slice(0, 30), svg: svgCls.slice(0, 40) });
      }
    });
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    return { asideVisible: aside ? aside.offsetParent !== null : false, navs, hamburgers, overflowX, viewport: { w: innerWidth, h: innerHeight } };
  });
  report(`- sidebar (aside) visible: ${mob.asideVisible ? 'yes' : 'NO'}`);
  report(`- nav elements: ${JSON.stringify(mob.navs)}`);
  report(`- hamburger/menu toggle found: ${mob.hamburgers.length ? JSON.stringify(mob.hamburgers) : 'NO -> MOBILE NAV INACCESSIBLE (FAIL)'}`);
  report(`- horizontal overflow: ${mob.overflowX ? 'YES' : 'no'}`);
  report(`- viewport: ${JSON.stringify(mob.viewport)}`);
  await page.screenshot({ path: '/tmp/journey-full-mobile-dashboard.png', fullPage: true });

  // ============ 6. PERFORMANCE ============
  report(`### 5. Performance`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAndSettle('/dashboard', 1500);
  const navPerf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint').find((p) => p.name === 'first-paint');
    return {
      firstPaint: paint ? Math.round(paint.startTime) : null,
      dcl: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
      responseStart: Math.round(nav.responseStart),
    };
  });
  report(`- first paint: ${navPerf.firstPaint}ms`);
  report(`- domContentLoaded: ${navPerf.dcl}ms`);
  report(`- load: ${navPerf.load}ms`);
  report(`- responseStart: ${navPerf.responseStart}ms`);
} catch (e) {
  report(`- JOURNEY ERROR: ${String(e).slice(0, 500)}`);
}

// ============ 7. CONSOLE & NETWORK SUMMARY ============
report(`### 6. Console/network issues (grouped)`);
const grouped = {};
for (const c of consoleAll) {
  const key = c.type === 'error' ? 'console.error' : c.type === 'pageerror' ? 'pageerror' : c.type === 'warning' ? 'console.warning' : null;
  if (!key) continue;
  const short = c.text.replace(/\s+/g, ' ').slice(0, 160);
  (grouped[key] = grouped[key] || new Set()).add(short);
}
for (const k of Object.keys(grouped)) {
  report(`- ${k}: ${grouped[k].size} unique`);
  for (const m of grouped[k]) report(`    · ${m}`);
}
if (!Object.keys(grouped).length) report('- no console errors/warnings/pageerrors');

const badApi = failedRequests.filter((f) => f.url.startsWith(API));
const badWeb = failedRequests.filter((f) => !f.url.startsWith(API));
report(`- failed API requests (${badApi.length}): ${badApi.length ? badApi.map((f) => `${f.status} ${f.url.replace(API, '')}`).join('; ') : 'none'}`);
report(`- failed web/static requests (${badWeb.length}):`);
for (const f of badWeb) report(`    · [${f.status}] ${f.url}`);

await browser.close();

// persist machine-readable evidence
writeFileSync('/tmp/journey-full-report.md', out.join('\n'));
console.log('\n(saved /tmp/journey-full-report.md)');
