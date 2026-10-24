import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, securityFindings } from '../src/lib/security.mjs';

const PEM = ['-----BEGIN RSA PRIVATE KEY-----', 'MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun', 'VTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u+qKhbwKfBstIs+bMY2Zkp18gnTxK', '-----END RSA PRIVATE KEY-----'];

test('redaction catches KEY, TOKEN and SECRET variables', () => {
  assert.equal(redact('export API_KEY=abc123secretvalue'), 'export [redacted]');
  assert.equal(redact('STRIPE_SECRET: "sk_live_abcdefgh"'), '[redacted]');
});

test('code constants named like keys are not secrets', () => {
  for (const line of ['const LONGEVO_KEY = /^(covers|verified):/m;', 'const KEY_VALUE = /^([\\w.-]+):(?:\\s+(.*))?$/;', 'const API_KEY = process.env.API_KEY;']) {
    assert.equal(redact(line), line, line);
  }
});

test('redaction catches secret words in names, like SECRET_KEY, db_password and api_token', () => {
  for (const line of ['SECRET_KEY = "django-insecure-abc123def456"', 'STRIPE_SECRET_KEY = "abcdefgh12345678"', 'db_password: hunter2hunter2', 'POSTGRES_PASSWORD: hunter2hunter2', 'client_secret: abcdefgh12345678', 'api_token: abcdefgh12345678', 'db.password=hunter2hunter2']) {
    assert.match(redact(line), /\[redacted\]/, line);
  }
});

test('redaction leaves look-alike names and placeholders alone', () => {
  for (const line of ['KEYBOARD_LAYOUT=us-international', 'SSH_KEY_PATH=./keys/id.pub', 'monkey=bananas-and-more', 'token: "${{ secrets.X }}"', 'token: "${{secrets.DEPLOY}}"']) {
    assert.equal(redact(line), line, line);
  }
});

test('redaction stays fast on very long lines', () => {
  const started = Date.now();
  redact(`${'a-'.repeat(40_000)}=x`);
  redact('x'.repeat(100_000));
  assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
});

test('redaction catches real secret shapes', () => {
  const secrets = [
    '"password": "hunter2hunter2xx"',
    '"apiKey": "AIzaSyA1234567890abcdefghijklmnopqrstu"',
    'api_key = "abcd1234efgh5678"',
    'stripe = sk_live_abcdefghijklmnop1234',
    'DATABASE_URL=postgres://admin:SuperS3cretPw@db.example.com/app',
    'slack: xoxb-1234567890-abcdefghij',
    'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    'export api_key=abc123secretvalue',
    'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  ];
  for (const line of secrets) assert.match(redact(line), /\[redacted\]/, line);
});

test('redaction leaves ordinary code alone', () => {
  for (const line of ['CACHE_KEY = "user-profile-v2"', 'PRIMARY_KEY = "account_id_field"', 'const token = getTokenFromHeader(req);', 'const API_KEY = process.env.API_KEY;']) {
    assert.equal(redact(line), line, line);
  }
});

test('secrets on added or removed diff lines are redacted', () => {
  assert.equal(redact('+password: hunter2hunter2'), '+[redacted]');
  assert.equal(redact('-api_token: Zx9Qw8Er7Ty6Ui5'), '-[redacted]');
});

test('a private key is redacted from its first line to its last, and every line is reported', () => {
  const text = `const k = \`\n${PEM.map((line) => `+${line}`).join('\n')}\n\`;`;
  const out = redact(text);
  assert.equal(out.includes('MIIEow'), false, out);
  assert.equal(out.includes('VTLw7on'), false, out);
  assert.deepEqual(securityFindings('k.pem', PEM.join('\n')).map((f) => f.line), [1, 2, 3, 4]);
});
