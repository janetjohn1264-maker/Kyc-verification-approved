// Regression check for the Democratic Republic of the Congo addition.
// Verifies the country registration, the DRC passport view markup and the
// reference specimen values are present, and that no other country was removed.
const fs = require('fs');
const path = require('path');

const files = ['index.html', path.join('dist', 'index.html')].filter((f) => fs.existsSync(f));
if (!files.length) {
  console.error('FAIL: neither index.html nor dist/index.html exists');
  process.exit(1);
}

const problems = [];

function check(file) {
  const html = fs.readFileSync(file, 'utf8');
  const prefix = file + ': ';

  // --- DRC registration ---
  const required = {
    'country pill button': /id="country-btn-drcongo"[^>]*onclick="switchVerificationCountry\('drcongo'\)"/,
    'countryNames entry': /drcongo:\s*'Democratic Republic of the Congo'/,
    'countryStyles entry': /drcongo:\s*\{/,
    'switchVerificationCountry branch': /\}\s*else if \(countryKey === 'drcongo'\)\s*\{\s*currentDocType = 'passport';/,
    'renderActiveDocumentView lookup': /const drcPassView = \$\('drcongo-passport-view'\);/,
    'renderActiveDocumentView hide': /if \(drcPassView\) drcPassView\.classList\.add\('hidden'\);/,
    'renderActiveDocumentView show': /\}\s*else if \(currentCountry === 'drcongo'\)\s*\{\s*if \(drcPassView\) drcPassView\.classList\.remove\('hidden'\);/,
    'POA countryMap entry': /drcongo:\s*\{[\s\S]{0,300}?Kinshasa/,
    'DRC view container': /<div id="drcongo-passport-view" class="hidden">/,
    'MRZ line 1 element': /id="drcMrzLine1"/,
    'MRZ line 2 element': /id="drcMrzLine2"/,
    'preview card': /id="drc-passport-card"/,
    'controller render fn': /function updateDrcPreview\(/,
    'controller mrz builder': /function buildDrcMrz\(/,
    'randomize export': /window\.randomizeDrcPassport = randomizeDrcPassport;/,
    'png export': /window\.downloadDrcPassPNG = downloadDrcPassPNG;/,
    'print export': /window\.printDrcPassport = printDrcPassport;/,
  };
  for (const [name, re] of Object.entries(required)) {
    if (!re.test(html)) problems.push(prefix + 'missing ' + name);
  }

  // --- exact reference specimen values ---
  const specimenValues = [
    'OP1123637',
    'MIEZI',
    'MINGI',
    'CARMI',
    'KINSHASA',
    '23/04/2000',
    'CONGOLAISE',
    '22/07/2022',
    '21/07/2027',
    'MINAFFET',
    '110619112',
    'AV SANKURU',
    'ETUDIANT',
    'RÉPUBLIQUE DÉMOCRATIQUE DU CONGO',
    'DEMOCRATIC REPUBLIC OF THE CONGO',
    'P<CODMIEZI<<CARMI<MINGI',
    'OP11236378COD0004237M270721110619112',
  ];
  // --- two-page spread structure (endorsement page above, data page below) ---
  const structure = [
    ['endorsement page', /id="drcEndorsementPage"/],
    ['biometric data page', /id="drcDataPage"/],
    ['vertical passport number on the endorsement page', /id="drcOutPassNoVertical"/],
    ['vertical writing mode for the passport number', /writing-mode:\s*vertical-rl/],
    ['main portrait element', /id="drcOutPhotoMain"/],
    ['secondary ghost portrait element', /id="drcOutPhotoSecondary"/],
    ['bearer signature element', /id="drcOutSignature"/],
    ['address block element', /id="drcOutAddress"/],
    ['profession element', /id="drcOutProfession"/],
  ];
  for (const [name, re] of structure) {
    if (!re.test(html)) problems.push(prefix + 'missing ' + name);
  }

  for (const value of specimenValues) {
    if (!html.includes(value)) problems.push(prefix + 'missing specimen value ' + JSON.stringify(value));
  }

  // --- existing countries must be untouched ---
  const countries = [
    'kenya',
    'somalia',
    'ethiopia',
    'nigeria',
    'uk',
    'uganda',
    'pakistan',
    'seychelles',
    'senegal',
    'drcongo',
  ];
  for (const c of countries) {
    if (!new RegExp('country-btn-' + c).test(html)) problems.push(prefix + 'country pill missing for ' + c);
  }
  if ((html.match(/id="country-btn-/g) || []).length !== countries.length) {
    problems.push(
      prefix +
        'unexpected country pill count: ' +
        (html.match(/id="country-btn-/g) || []).length +
        ' (expected ' + countries.length + ')'
    );
  }

  // --- DRC passport images intentionally removed from the view ---
  // The section must render no portrait/signature/reference image assets.
  for (const asset of [
    'drc_passport_portrait.jpg',
    'drc_passport_signature.png',
    'drc_passport_reference.jpg',
  ]) {
    if (html.includes('/assets/aistudio/' + asset)) problems.push(prefix + 'unexpected image reference: ' + asset);
  }
  for (const id of ['drcOutPhotoMain', 'drcOutPhotoSecondary', 'drcOutSignature']) {
    const tag = html.match(new RegExp('<img[^>]*id="' + id + '"[^>]*>'));
    if (tag && /\ssrc=/.test(tag[0])) problems.push(prefix + 'image element still has a src: ' + id);
  }
}

files.forEach(check);

// --- no stray duplicate element ids inside the DRC view ---
const source = fs.readFileSync('index.html', 'utf8');
const allIds = [...source.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
if (dupes.length) problems.push('index.html: duplicate element ids: ' + [...new Set(dupes)].join(', '));

if (problems.length) {
  console.error('DRC regression check FAILED:');
  problems.forEach((p) => console.error(' - ' + p));
  process.exit(1);
}

console.log('DRC regression check passed for: ' + files.join(', '));
console.log(' - country registration, view markup, controller wiring present');
console.log(' - all reference specimen values present');
console.log(' - all 10 country pills intact, passport images removed from the view');
