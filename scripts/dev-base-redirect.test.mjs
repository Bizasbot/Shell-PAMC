// Tests for the dev server's bare mount path redirect.
//
// The Go router redirects /shell-pamc to /shell-pamc/ (internal/api handler_test.go); these
// cases hold the dev server to the same address and make sure nothing else is
// redirected, since the middleware sits ahead of every other dev route.

import assert from 'node:assert/strict';
import test from 'node:test';
import { bareBaseRedirectPlugin, resolveBareBaseRedirect } from './dev-base-redirect.mjs';

test('the bare mount path redirects to its slash', () => {
  assert.equal(resolveBareBaseRedirect('/shell-pamc/', '/shell-pamc'), '/shell-pamc/');
  assert.equal(resolveBareBaseRedirect('/nested/shell-pamc/', '/nested/shell-pamc'), '/nested/shell-pamc/');
});

test('the query string survives the redirect', () => {
  assert.equal(resolveBareBaseRedirect('/shell-pamc/', '/shell-pamc?next=%2Fusage'), '/shell-pamc/?next=%2Fusage');
});

test('paths under or beside the mount path are left alone', () => {
  for (const requestUrl of ['/shell-pamc/', '/shell-pamc/usage', '/shell-pamc/api/healthz', '/omcx', '/', '/other', '/shell-pamc/?a=1']) {
    assert.equal(resolveBareBaseRedirect('/shell-pamc/', requestUrl), null, requestUrl);
  }
});

test('a root or relative base has no bare mount path', () => {
  assert.equal(resolveBareBaseRedirect('/', '/'), null);
  assert.equal(resolveBareBaseRedirect('/', ''), null);
  assert.equal(resolveBareBaseRedirect('./', '.'), null);
});

function runMiddleware(base, requestUrl) {
  const plugin = bareBaseRedirectPlugin();
  plugin.configResolved({ base });
  let middleware;
  plugin.configureServer({ middlewares: { use: (handler) => { middleware = handler; } } });
  const outcome = { status: null, headers: null, isEnded: false, isPassedOn: false };
  middleware(
    { url: requestUrl },
    {
      writeHead: (status, headers) => { outcome.status = status; outcome.headers = headers; },
      end: () => { outcome.isEnded = true; },
    },
    () => { outcome.isPassedOn = true; },
  );
  return outcome;
}

test('the middleware answers the bare mount path and passes everything else on', () => {
  const redirected = runMiddleware('/shell-pamc/', '/shell-pamc');
  assert.equal(redirected.status, 302);
  assert.deepEqual(redirected.headers, { Location: '/shell-pamc/' });
  assert.equal(redirected.isEnded, true);
  assert.equal(redirected.isPassedOn, false);

  const passedOn = runMiddleware('/shell-pamc/', '/shell-pamc/usage');
  assert.equal(passedOn.status, null);
  assert.equal(passedOn.isPassedOn, true);
});
