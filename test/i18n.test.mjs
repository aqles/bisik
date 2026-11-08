// i18n checks: dictionary parity, detection rules, and — the important one —
// every key referenced by the pages/app actually exists in the dictionary.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); ok ? pass++ : fail++; };

const src = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, console, URLSearchParams };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const I = sandbox.module.exports;
const { STRINGS } = I;

// 1. The no-storage promise holds for the language feature too. (Usage
// patterns only — the texts legitimately *mention* these APIs to say the
// app doesn't use them.)
check('i18n.js uses no storage (localStorage/sessionStorage/cookies/IndexedDB)',
  !/localStorage\s*\.|sessionStorage\s*\.|document\.cookie\s*=|indexedDB\s*\./.test(src));

// 2. Same keys in both languages, none empty.
const enKeys = Object.keys(STRINGS.en).sort();
const idKeys = Object.keys(STRINGS.id).sort();
check('EN and ID have exactly the same keys', JSON.stringify(enKeys) === JSON.stringify(idKeys));
check('no empty strings in either language',
  [...Object.values(STRINGS.en), ...Object.values(STRINGS.id)].every((s) => typeof s === 'string' && s.trim().length > 0));

// 3. Every key used by the markup and the app exists in the dictionary.
const used = new Set();
for (const f of ['index.html', 'privacy.html', 'terms.html', 'security.html']) {
  const html = readFileSync(new URL('../public/' + f, import.meta.url), 'utf8');
  for (const m of html.matchAll(/data-i18n(?:-html|-ph|-aria|-title)?="([^"]+)"/g)) used.add(m[1]);
}
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
for (const m of app.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]);
const missing = [...used].filter((k) => !(k in STRINGS.en));
check(`all ${used.size} keys referenced by pages/app exist in the dictionary`, missing.length === 0);
if (missing.length) console.log('  missing:', missing.join(', '));

// 4. Detection: device language rules + ?lang= override.
const D = I.detectLang;
check('device id-ID → id', D('id-ID', '') === 'id');
check('device id → id', D('id', '') === 'id');
check('legacy in-ID → id', D('in-ID', '') === 'id');
check('device en-US → en', D('en-US', '') === 'en');
check('device jv-ID (Javanese) → en fallback', D('jv-ID', '') === 'en');
check('?lang=id beats an English device', D('en-US', '?lang=id') === 'id');
check('?lang=en beats an Indonesian device', D('id-ID', '?lang=en') === 'en');
check('?lang=xx is ignored', D('en-US', '?lang=xx') === 'en');

// 5. Interpolation works (the reconnect countdown string).
check("t('noteReconnecting', {n}) interpolates",
  I.t('noteReconnecting', { n: 5 }).includes('5') && !I.t('noteReconnecting', { n: 5 }).includes('{n}'));
check('ID reconnect string also carries {n}', STRINGS.id.noteReconnecting.includes('{n}'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
