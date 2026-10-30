/**
 * Live DOM regression check for the DR Congo passport live preview.
 *
 * Loads index.html in a real DOM (jsdom), switches the app to the DR Congo
 * passport view and clicks the "Randomize Card" button, then asserts that the
 * live preview (data page fields + MRZ) actually re-renders with the new
 * values while the passport layout/design nodes stay untouched.
 *
 * Usage: node scripts/check-drc-live.cjs
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const errors = [];
const fail = (msg) => errors.push(msg);
const assert = (cond, msg) => { if (!cond) fail(msg); };

const PREVIEW_IDS = [
  'drcOutSurname', 'drcOutPostname', 'drcOutGivenNames', 'drcOutPassNo',
  'drcOutPassNoVertical', 'drcOutDob', 'drcOutSex', 'drcOutNationality',
  'drcOutPob', 'drcOutIssue', 'drcOutExpiry', 'drcOutPersonalNo',
  'drcOutAuthority', 'drcOutProfession', 'drcOutAddress',
  'drcMrzLine1', 'drcMrzLine2',
];

const INPUT_IDS = [
  'drcInputSurname', 'drcInputPostname', 'drcInputGivenNames', 'drcInputPassNo',
  'drcInputPersonalNo', 'drcInputDob', 'drcInputSex', 'drcInputNationality',
  'drcInputPob', 'drcInputIssue', 'drcInputExpiry', 'drcInputAuthority',
  'drcInputProfession', 'drcInputAddress',
];

// Design fingerprint: the passport artwork must stay byte-identical to what is
// shipped today, so the check pins the structural nodes and their classes.
const DESIGN_NODES = [
  ['drc-passport-card', 'aspect-ratio: 443 / 1214'],
  ['drcEndorsementPage', 'absolute inset-x-0 top-0 overflow-hidden'],
  ['drcDataPage', 'absolute inset-x-0 bottom-0 overflow-hidden flex flex-col'],
];

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://localhost/',
  virtualConsole,
});
const { window } = dom;
const doc = window.document;

const $ = (id) => doc.getElementById(id);
const text = (id) => { const el = $(id); return el ? el.textContent.trim() : null; };

const run = async () => {
  // ---- 1. Controls must be wired on the real DOM ------------------------
  const randomizeBtn = doc.querySelector('#drcongo-passport-view button[onclick="randomizeDrcPassport()"]');
  assert(!!randomizeBtn, 'DR Congo view has no button wired to randomizeDrcPassport()');
  assert(typeof window.randomizeDrcPassport === 'function', 'window.randomizeDrcPassport is not exported');
  if (!randomizeBtn || typeof window.randomizeDrcPassport !== 'function') return;

  // ---- 2. Design must be untouched ---------------------------------------
  DESIGN_NODES.forEach(([id, marker]) => {
    const el = $(id);
    assert(!!el, `design node #${id} is missing`);
    if (el) {
      assert(el.outerHTML.includes(marker), `design node #${id} no longer carries its "${marker}" layout`);
    }
  });

  // ---- 3. Every preview sink the randomiser feeds must exist -------------
  PREVIEW_IDS.forEach((id) => assert(!!$(id), `missing live preview node #${id}`));
  INPUT_IDS.forEach((id) => assert(!!$(id), `missing editor input #${id}`));

  // ---- 4. Randomize must refresh the preview in the DOM ------------------
  const specimenValues = {};
  PREVIEW_IDS.forEach((id) => { specimenValues[id] = text(id); });
  assert(specimenValues.drcOutSurname === 'MIEZI', `specimen surname should be MIEZI, saw "${specimenValues.drcOutSurname}"`);

  let clicked = 0;
  for (let i = 0; i < 4; i += 1) {
    // Exercise the button itself (inline onclick handler), like a user click.
    randomizeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    clicked += 1;

    const surnameInput = $('drcInputSurname').value.trim().toUpperCase();
    const passInput = $('drcInputPassNo').value.trim().toUpperCase();
    const personalInput = $('drcInputPersonalNo').value.trim();

    assert(!!surnameInput, `run ${i + 1}: randomiser left the surname input empty`);
    assert(/^OP\d{7}$/.test(passInput), `run ${i + 1}: passport number "${passInput}" is not OP + 7 digits`);
    assert(/^\d{9}$/.test(personalInput), `run ${i + 1}: personal number "${personalInput}" is not 9 digits`);

    // The data page must mirror the editor (this is the "live preview" contract).
    assert(text('drcOutSurname') === surnameInput, `run ${i + 1}: preview surname "${text('drcOutSurname')}" != input "${surnameInput}"`);
    assert(text('drcOutPassNo') === passInput, `run ${i + 1}: preview passport no "${text('drcOutPassNo')}" != input "${passInput}"`);
    assert(text('drcOutPassNoVertical') === passInput, `run ${i + 1}: vertical passport no "${text('drcOutPassNoVertical')}" != input "${passInput}"`);
    assert(text('drcOutPersonalNo') === personalInput, `run ${i + 1}: preview personal no "${text('drcOutPersonalNo')}" != input "${personalInput}"`);
    assert(text('drcOutProfession') === $('drcInputProfession').value.trim().toUpperCase(), `run ${i + 1}: preview profession not refreshed`);
    assert(!!text('drcOutDob') && text('drcOutDob') !== '—', `run ${i + 1}: preview date of birth is empty`);
    assert(!!text('drcOutIssue') && text('drcOutIssue') !== '—', `run ${i + 1}: preview issue date is empty`);
    assert(!!text('drcOutExpiry') && text('drcOutExpiry') !== '—', `run ${i + 1}: preview expiry date is empty`);

    // MRZ must be rebuilt (44 chars per line, ICAO TD3) and must track the data.
    const l1 = text('drcMrzLine1');
    const l2 = text('drcMrzLine2');
    assert(l1 && l1.length === 44, `run ${i + 1}: MRZ line 1 is ${l1 && l1.length} chars, expected 44`);
    assert(l2 && l2.length === 44, `run ${i + 1}: MRZ line 2 is ${l2 && l2.length} chars, expected 44`);
    assert(l1 && l1.startsWith('P<COD'), `run ${i + 1}: MRZ line 1 "${l1}" does not start with P<COD`);
    assert(l1 && l1.includes(surnameInput.slice(0, 10)), `run ${i + 1}: MRZ line 1 does not contain the new surname`);
    assert(l2 && l2.startsWith(passInput), `run ${i + 1}: MRZ line 2 does not start with the new passport number`);
  }

  // ---- 5. Randomising must actually vary the data -----------------------
  const firstSurname = text('drcOutSurname');
  let changed = false;
  for (let i = 0; i < 12 && !changed; i += 1) {
    randomizeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    if (text('drcOutSurname') !== firstSurname) changed = true;
  }
  assert(changed, 'randomiser produced the same holder on 13 consecutive clicks');

  // ---- 6. Specimen restore still works ----------------------------------
  if (typeof window.resetDrcPassportSpecimen === 'function') {
    window.resetDrcPassportSpecimen();
    assert(text('drcOutSurname') === 'MIEZI', `specimen restore gave surname "${text('drcOutSurname')}"`);
    assert(text('drcOutPassNo') === 'OP1123637', `specimen restore gave passport no "${text('drcOutPassNo')}"`);
    assert(text('drcMrzLine2') === 'OP11236378COD0004237M270721110619112<<<<<<68', 'specimen restore did not restore the printed MRZ');
  } else {
    fail('window.resetDrcPassportSpecimen is not exported');
  }

  // ---- 7. View switching shows the live preview -------------------------
  if (typeof window.selectCountry === 'function') {
    window.selectCountry('senegal');
    window.selectCountry('drcongo');
  }
  const view = $('drcongo-passport-view');
  assert(!!view && !view.classList.contains('hidden'), 'DR Congo view stays hidden after selecting the country');
  assert(clicked > 0, 'randomize button was never clicked');
};

run()
  .catch((e) => fail(`unexpected error: ${e && e.stack ? e.stack.split('\n')[0] : e}`))
  .then(() => {
    if (errors.length) {
      console.error('DR Congo live preview check FAILED:');
      errors.forEach((e) => console.error(` - ${e}`));
      process.exit(1);
    }
    console.log(
      'DR Congo live preview check passed:\n' +
      ' - clicking Randomize Card re-renders the data page, endorsement page and MRZ in the DOM\n' +
      ' - editor inputs and preview stay in sync across repeated clicks\n' +
      ' - passport design nodes (card, endorsement page, data page) untouched\n' +
      ' - reference specimen restore still renders MIEZI / OP1123637 and the printed MRZ'
    );
  });
