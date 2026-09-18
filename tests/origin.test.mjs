import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from '../lib/origin.mjs';
function request(origin, host = '127.0.0.1:3000', url = 'http://localhost:3000/api/auth/admin', extras = {}) {
  return new Request(url, { headers: { ...(origin ? { origin } : {}), host, ...extras } });
}
test('Next dev localhost normalization accepts the real 127.0.0.1 browser origin', () => {
  assert.equal(isAllowedOrigin(request('http://127.0.0.1:3000')), true);
  assert.equal(isAllowedOrigin(request('http://localhost:3000', 'localhost:3000')), true);
});
test('the shared origin check covers student login, registration and admin login', () => {
  for (const route of ['auth/login','auth/register','auth/eligibility','auth/admin']) {
    const url = `http://localhost:3000/api/${route}`;
    assert.equal(isAllowedOrigin(request('http://127.0.0.1:3000','127.0.0.1:3000',url)),true,route);
    assert.equal(isAllowedOrigin(request('https://untrusted.example','127.0.0.1:3000',url)),false,route);
  }
});
test('development fallback requires the same actual host, scheme and port', () => {
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3001', 'https://127.0.0.1:3000', 'https://evil.example', 'null', null]) {
    assert.equal(isAllowedOrigin(request(origin)), false, String(origin));
  }
  assert.equal(isAllowedOrigin(request('http://evil.example', 'evil.example')), false);
  assert.equal(isAllowedOrigin(request('https://evil.example','127.0.0.1:3000',undefined,{'x-forwarded-host':'evil.example'})),false);
});
test('production does not enable the local development exception', () => {
  assert.equal(isAllowedOrigin(request('http://127.0.0.1:3000'), { production: true }), false);
});
test('explicit public origin works behind a proxy and remains authoritative', () => {
  const options = { appOrigin:'https://offframe.example.com/', production:true };
  assert.equal(isAllowedOrigin(request('https://offframe.example.com'), options), true);
  assert.equal(isAllowedOrigin(request('http://127.0.0.1:3000'), options), false);
  assert.equal(isAllowedOrigin(request('https://evil.example'), options), false);
  assert.equal(isAllowedOrigin(request('https://offframe.example.com'), { appOrigin:'invalid' }), false);
});
