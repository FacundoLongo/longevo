// A name with a secret word in it, as whole segments: SECRET_KEY, db_password, client.secret. Bounded, so long
// lines stay fast. A bare KEY is not enough: CACHE_KEY or SSH_KEY_PATH are not secrets.
const WORD = '(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|auth[_-]?key)';
const NAME = `(?:[A-Za-z0-9]{1,30}[_.-]){0,4}${WORD}(?:[_.-][A-Za-z0-9]{1,20}){0,3}`;

const SECRETS = [
  ['aws access key', /AKIA[0-9A-Z]{16}/],
  ['github token', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['api key', /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/],
  ['stripe key', /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['google api key', /\bAIza[0-9A-Za-z_-]{30,}/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/],
  ['password in a url', /\b[a-z][a-z0-9+.-]{0,20}:\/\/[^\s/:@]{1,100}:[^\s/@]{6,100}@/i],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['aws secret key', /aws_secret_access_key\s*[:=]\s*\S{20,}/i],
  // A quoted literal: "password": "...", SECRET_KEY = '...'. Code that reads a variable has no quotes; ${...} is a placeholder.
  ['secret value', new RegExp(`["']?\\b${NAME}["']?\\s*[:=]\\s*(["'])(?!\\$\\{)[^"'\\s]{8,200}\\1`, 'i')],
  // NAME=value as in .env, properties files and shell. Code has spaces around =, or a value that is a reference or a path.
  ['secret variable', new RegExp(`\\b${NAME}=(?![$({[./~])[^\\s"'\`]{8,200}`, 'i')],
  // name: value at the end of a YAML line, with no call or punctuation that code would have.
  ['secret in yaml', new RegExp(`(?<=^|[\\s"'{,])${NAME}\\s*:\\s*(?![$({[<"'])[A-Za-z0-9_\\-+/=!@%^&*]{8,200}\\s*$`, 'im')],
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
    // One secret finding per line: the first, most specific kind that matches.
    const secret = SECRETS.find(([, pattern]) => pattern.test(line));
    if (secret) findings.push({ file, line: index + 1, kind: secret[0] });
    if (PERSONAL_PATH.test(line)) findings.push({ file, line: index + 1, kind: 'personal path' });
    if (INSTALL_FROM_WEB.test(line)) findings.push({ file, line: index + 1, kind: 'install from the internet' });
  });
  return findings;
}
