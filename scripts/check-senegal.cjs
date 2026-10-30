#!/usr/bin/env node
/**
 * Senegal (Carte d'Identité CEDEAO) regression check.
 * Mirrors scripts/check-drc.cjs: guards the reference specimen values, the
 * preserved container IDs and the data-sen <-> updateSenPreview() contract.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = ['index.html', 'dist/index.html'].filter((f) =>
  fs.existsSync(path.join(root, f))
);
const errors = [];
const warn = [];

function fail(msg) {
  errors.push(msg);
}

// ---- 1. Required container IDs (original structure preserved) -------------
const containerIds = [
  'senegal-passport-view',
  'sen-view-spread',
  'sen-view-datapage',
  'sen-view-page1',
  'senegal-passport-spread',
  'senegal-spread-page1',
  'senegal-spread-datapage',
  'senegal-datapage-card',
  'senegal-page1-card',
  'senPassDocForm',
  'senMrzLine1',
  'senMrzLine2',
  'senSingleMrzLine1',
  'senSingleMrzLine2',
  'senPassInputSurname',
  'senPassInputGiven',
  'senPassInputPassNo',
  'senPassInputAuthority',
  'senPassInputSignature',
  'senPassInputHeight',
  'senPassInputAddress',
];

// ---- 2. Exact reference specimen values / design strings -----------------
const referenceValues = [
  "CARTE D'IDENTITE CEDEAO",
  'ECOWAS IDENTITY CARD',
  'REPUBLIQUE DU SENEGAL',
  'DIOP',
  'AICHA SAMBA',
  '167 cm',
  'DAKAR',
  '08/04/2021',
  'COMMISSARIAT DE MALIKA',
  'KEUR MASSAR QRT AINOUMADY',
  '2 01 20030215 00023 7',
  'senegal_id_portrait.jpg',
  'sen-eco-star',
  'sen-eco-emblem',
  'sen-eco-flag',
];

files.forEach((file) => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const out = (msg) => fail(`${file}: ${msg}`);

  containerIds.forEach((id) => {
    if (!html.includes(`id="${id}"`)) out(`missing container id "${id}"`);
  });

  referenceValues.forEach((val) => {
    if (!html.includes(val)) out(`missing reference value "${val}"`);
  });

  // ---- 3. No duplicate id attributes (appended markup must not collide) ---
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  const dupes = new Set();
  ids.forEach((id) => (seen.has(id) ? dupes.add(id) : seen.add(id)));
  if (dupes.size) out(`duplicate ids: ${[...dupes].join(', ')}`);

  // ---- 4. data-sen contract with updateSenPreview() ----------------------
  const keysInMarkup = new Set(
    [...html.matchAll(/data-sen="([a-z]+)"/g)].map((m) => m[1])
  );
  const keysSetByJs = new Set(
    [...html.matchAll(/setField\('([a-z]+)'/g)].map((m) => m[1])
  );
  keysSetByJs.forEach((k) => {
    if (!keysInMarkup.has(k)) out(`setField('${k}') has no data-sen target`);
  });
  keysInMarkup.forEach((k) => {
    if (!keysSetByJs.has(k)) warn.push(`${file}: data-sen="${k}" never updated`);
  });

  // ---- 5. Stale ids from the previous passport booklet must be gone ------
  ['senPreview', 'senSingle', 'senPage1PassNo'].forEach((stale) => {
    if (html.includes(stale)) {
      out(`stale Senegal id prefix "${stale}" still referenced (use data-sen)`);
    }
  });

  // ---- 6. Portrait asset referenced from the card must exist ------------
  const portraitRefs = [...html.matchAll(/assets\/aistudio\/(senegal_id_portrait\.jpg)/g)];
  if (portraitRefs.length < 3) {
    out(`portrait asset referenced only ${portraitRefs.length}x (expected 3+ cards)`);
  }
});

const asset = path.join(root, 'public', 'assets', 'aistudio', 'senegal_id_portrait.jpg');
if (!fs.existsSync(asset)) fail('missing portrait asset public/assets/aistudio/senegal_id_portrait.jpg');

warn.forEach((w) => console.log(` - warn: ${w}`));

if (errors.length) {
  console.error('Senegal regression check FAILED:');
  errors.forEach((e) => console.error(` - ${e}`));
  process.exit(1);
}

console.log(
  `Senegal regression check passed for: ${files.join(', ')}\n` +
    ' - container IDs preserved, no duplicate ids\n' +
    ' - reference specimen values and CEDEAO card design strings present\n' +
    ' - data-sen markup matches updateSenPreview() field keys\n' +
    ' - portrait asset present and referenced by every card'
);
