import assert from 'node:assert/strict';
import { devNull } from 'node:os';
import fs from 'node:fs';
import test from 'node:test';
import { isolatedAppEnvironment } from './acceptance/environment.mjs';

test('fixture environment cannot inherit operator application settings or transport proxies', () => {
  const inherited = {
    PATH: '/fixture/bin', SystemRoot: 'fixture-root', HOME: '/fixture/home',
    SHELLPAMC_ENV_FILE: '/operator/config.env', SHELLPAMC_DEMO_MODE: 'true',
    SHELLPAMC_CPA_BASE_URL: 'https://operator.example.test', SHELLPAMC_FUTURE_OPTION: 'enabled',
    SHELLPAMC_MASTER_KEY: 'operator-value', PORT: '8080',
    HTTPS_PROXY: 'https://proxy.example.test', http_proxy: 'http://proxy.example.test',
    ALL_PROXY: 'http://proxy.example.test', no_proxy: '*',
  };
  const before = { ...inherited };
  assert.deepEqual(isolatedAppEnvironment({ SHELLPAMC_CPA_BASE_URL: 'http://127.0.0.1:9001' }, inherited), {
    PATH: inherited.PATH, SystemRoot: inherited.SystemRoot, HOME: inherited.HOME,
    SHELLPAMC_CPA_BASE_URL: 'http://127.0.0.1:9001', SHELLPAMC_ENV_FILE: devNull,
  });
  assert.deepEqual(inherited, before);
});

test('explicit fixture proxies survive but dotenv remains an empty platform file', () => {
  const environment = isolatedAppEnvironment({
    SHELLPAMC_DEMO_MODE: 'true', HTTPS_PROXY: 'http://127.0.0.1:1', SHELLPAMC_ENV_FILE: '/operator/config.env',
  }, {});
  assert.equal(environment.SHELLPAMC_DEMO_MODE, 'true');
  assert.equal(environment.HTTPS_PROXY, 'http://127.0.0.1:1');
  assert.equal(environment.SHELLPAMC_ENV_FILE, devNull);
  assert.equal(fs.readFileSync(environment.SHELLPAMC_ENV_FILE, 'utf8'), '');
});
