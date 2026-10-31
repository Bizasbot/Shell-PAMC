/** Exercises the canonical prefix used by the image health probe. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'deploy', 'base-path.sh');

const probe = spawnSync('sh', ['-c', 'exit 0'], { encoding: 'utf8' });
const hasShell = probe.error === undefined && probe.status === 0;

function basePath(rawValue) {
  return spawnSync('sh', [script], {
    encoding: 'utf8',
    env: { ...process.env, SHELLPAMC_BASE_PATH: rawValue },
  });
}

// The same table as the Go test for NormalizeBasePath, including the empty result
// that means the site root.
const ACCEPTED = [
  { name: 'unset value means the documented default', input: '', want: '/shell-pamc' },
  { name: 'plain name', input: 'shell-pamc', want: '/shell-pamc' },
  { name: 'absolute path', input: '/shell-pamc', want: '/shell-pamc' },
  { name: 'trailing slash', input: '/shell-pamc/', want: '/shell-pamc' },
  { name: 'nested path with trailing slash', input: '/tools/shell-pamc/', want: '/tools/shell-pamc' },
  { name: 'duplicate slashes', input: '/a//b/', want: '/a/b' },
  { name: 'single dot segment', input: '/shell-pamc/./x', want: '/shell-pamc/x' },
  { name: 'surrounding whitespace', input: '  /shell-pamc  ', want: '/shell-pamc' },
  { name: 'site root', input: '/', want: '' },
  { name: 'only slashes is the site root', input: '//', want: '' },
];

test('deploy/base-path.sh agrees with the server on every accepted value', { skip: hasShell ? false : 'requires a POSIX shell' }, () => {
  for (const { name, input, want } of ACCEPTED) {
    const result = basePath(input);
    assert.equal(result.status, 0, `${name}: exited ${result.status}: ${result.stderr}`);
    assert.equal(result.stdout.trim(), want, name);
  }
});

test('deploy/base-path.sh refuses values the server refuses', { skip: hasShell ? false : 'requires a POSIX shell' }, () => {
  for (const input of ['/shell-pamc?x=1', '/shell-pamc#fragment', '/../shell-pamc']) {
    const result = basePath(input);
    assert.notEqual(result.status, 0, `${input} was accepted`);
    assert.match(result.stderr, /SHELLPAMC_BASE_PATH/, `${input} failed without naming the variable`);
  }
});

// The script splits the value on "/" with word-splitting, and an unquoted
// expansion also globs. A base path containing "*" is therefore expanded against
// whatever the process happens to be sitting next to, while the server keeps the
// literal character - the health probe and the application would end up on different
// paths. "?" is refused before this point as URL syntax, so only the glob
// metacharacter is reachable.
test('deploy/base-path.sh does not glob a path segment', { skip: hasShell ? false : 'requires a POSIX shell' }, () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'omc-base-path-'));
  try {
    // Matching names, so a globbing shell would substitute them.
    fs.writeFileSync(path.join(workdir, 'alpha'), '');
    fs.writeFileSync(path.join(workdir, 'beta'), '');
    const result = spawnSync('sh', [script], {
      encoding: 'utf8',
      cwd: workdir,
      env: { ...process.env, SHELLPAMC_BASE_PATH: '/console/*' },
    });
    assert.equal(result.status, 0, `exited ${result.status}: ${result.stderr}`);
    assert.equal(result.stdout.trim(), '/console/*', 'the glob metacharacter must survive');
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});
