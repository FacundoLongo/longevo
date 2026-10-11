const SECRETS = [
  ['aws access key', /AKIA[0-9A-Z]{16}/],
  ['github token', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['api key', /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['password or token value', /(?:password|passwd|secret|token)\s*[:=]\s*["']?[^\s"'`]{8,}/i],
];
const PERSONAL_PATH = /(?:\/Users\/|\/home\/|C:\\Users\\)[\w.-]+/;
const INSTALL_FROM_WEB = /(?:curl|wget)\s+[^|]*\|\s*(?:ba)?sh|npm\s+i(?:nstall)?\s+-g\s/i;

// Replaces anything that looks like a secret, for text the report has to show.
export function redact(text) {
  return SECRETS.reduce((out, [, pattern]) => out.replace(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`), '[redacted]'), text);
}

// Runs every string in a report through redact, so no field can carry a secret.
export function redactDeep(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactDeep(item)]));
  return value;
}

// Reports where a risk is, never the matched text.
export function securityFindings(file, text) {
  const findings = [];
  text.split('\n').forEach((line, index) => {
    for (const [kind, pattern] of SECRETS) if (pattern.test(line)) findings.push({ file, line: index + 1, kind });
    if (PERSONAL_PATH.test(line)) findings.push({ file, line: index + 1, kind: 'personal path' });
    if (INSTALL_FROM_WEB.test(line)) findings.push({ file, line: index + 1, kind: 'install from the internet' });
  });
  return findings;
}
