import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

// Use only local routes and a stub of the external Pixel script.
process.env.VITE_META_PIXEL_ID = '123456789';
process.env.VITE_SUPABASE_URL = '';
process.env.VITE_SUPABASE_ANON_KEY = '';
const browser = await chromium.launch({ channel: process.env.MDFLUX_TEST_BROWSER || undefined, headless: true, timeout: 15000 });
let server;
try {
  const options = { build: { outDir: '../meta-test-dist', emptyOutDir: false } };
  await build(options);
  server = await preview({ ...options, preview: { host: '127.0.0.1', port: 4190, strictPort: true } });
  const origin = 'http://127.0.0.1:4190';
  const page = await browser.newPage();
  const events = [];
  let loads = 0;
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === '/.netlify/functions/events') {
      events.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'connect.facebook.net' && url.pathname.endsWith('/fbevents.js')) {
      loads++;
      return route.fulfill({ contentType: 'application/javascript', body: 'window.pixelCalls=[...fbq.queue];fbq.callMethod=(...args)=>pixelCalls.push(args);' });
    }
    return route.abort();
  });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Recusar', exact: true }).click();
  assert.equal(loads, 0);
  assert.equal(events.length, 0);
  const prefs = page.getByRole('button', { name: 'Preferências de cookies' });
  await prefs.click();
  const sent = page.waitForRequest(r => r.url() === origin + '/.netlify/functions/events');
  await page.getByRole('button', { name: 'Permitir medição' }).click();
  const pageView = (await sent).postDataJSON();
  await page.waitForFunction(() => Array.isArray(window.pixelCalls));
  assert.equal(loads, 1);
  assert.equal(pageView.event, 'PageView');
  const calls = () => page.evaluate(() => window.pixelCalls);
  assert.ok((await calls()).some(x => x[0] === 'track' && x[1] === 'PageView' && x[3].eventID === pageView.id));
  await prefs.click();
  assert.ok((await calls()).some(x => x[0] === 'consent' && x[1] === 'revoke'));
  await page.getByRole('button', { name: 'Permitir medição' }).click();
  assert.ok((await calls()).filter(x => x[0] === 'consent' && x[1] === 'grant').length >= 2);
  const authDocument = page.waitForRequest(r => r.url() === origin + '/auth' && r.resourceType() === 'document');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await authDocument;
  await page.getByRole('heading', { name: 'Bom ter você de volta.' }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.fbq), 'undefined');
  assert.equal(loads, 1);
  await page.goto(origin + '/document/test-only');
  assert.equal(await page.evaluate(() => typeof window.fbq), 'undefined');
  assert.equal(loads, 1);
  console.log('PASS: decline, grant, shared event ID, revoke, grant again, and Pixel isolation on private routes. No Meta requests sent.');
} finally {
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  await browser.close();
}
