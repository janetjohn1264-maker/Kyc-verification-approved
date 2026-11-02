import React, { useMemo } from 'react';

export interface BangladeshPassportData {
  passportNo: string;
  surname: string;
  givenNames: string;
  nationality: string;
  personalNo: string;
  dateOfBirth: string; // e.g., "23 MAY 1997"
  previousPassportNo: string;
  sex: 'M' | 'F' | 'X';
  placeOfBirth: string;
  dateOfIssue: string; // e.g., "31 JAN 2023"
  issuingAuthority: string;
  dateOfExpiry: string; // e.g., "30 JAN 2033"
  bookletSerial: string; // e.g., "982450"
  fatherName: string;
  motherName: string;
  spouseName: string;
  permanentAddress1: string;
  permanentAddress2: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyAddress1: string;
  emergencyAddress2: string;
  emergencyPhone: string;
  photoUrl?: string;
  signatureUrl?: string;
}

export const defaultBangladeshPassportData: BangladeshPassportData = {
  passportNo: "A06821716",
  surname: "HOSSAIN",
  givenNames: "MD DELOWER",
  nationality: "BANGLADESHI",
  personalNo: "6902553657",
  dateOfBirth: "23 MAY 1997",
  previousPassportNo: "BT0283556",
  sex: "M",
  placeOfBirth: "BHOLA",
  dateOfIssue: "31 JAN 2023",
  issuingAuthority: "DIP/DHAKA",
  dateOfExpiry: "30 JAN 2033",
  bookletSerial: "982450",
  fatherName: "MD MOFIZUL ISLAM",
  motherName: "AMANA BEGUM",
  spouseName: "",
  permanentAddress1: "HOUSE # 57/59, ROAD # 31, BLOCK # D, PALLABI,",
  permanentAddress2: "PALLABI - 1216, DHAKA",
  emergencyName: "JAHIDUL ISLAM",
  emergencyRelationship: "BROTHER",
  emergencyAddress1: "HOUSE # 76, ROAD # 06, BLOCK-A, PALLABI, PALLABI",
  emergencyAddress2: "- 1216, DHAKA",
  emergencyPhone: "+8801616166031",
  photoUrl: "/assets/aistudio/bgd_passport_portrait.png",
  signatureUrl: "/assets/aistudio/bgd_passport_signature.png",
};

// 5x7 dot-matrix glyphs for authentic laser-perforated passport numbers
const DOT_MATRIX_FONT: Record<string, string[]> = {
  '0': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  '1': ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  '2': ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  '3': ["01110", "10001", "00001", "00110", "00001", "10001", "01110"],
  '4': ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  '5': ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  '6': ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  '7': ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  '8': ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  '9': ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  'A': ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  'B': ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  'C': ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  'D': ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  'E': ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  'F': ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  'G': ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  'H': ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  'I': ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  'J': ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  'K': ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  'L': ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  'M': ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  'N': ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  'O': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  'P': ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  'Q': ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  'R': ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  'S': ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  'T': ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  'U': ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  'V': ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  'W': ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  'X': ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  'Y': ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  'Z': ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

// Calculate ICAO 9303 7-3-1 check digit
function calcIcaoCheckDigit(input: string): string {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i].toUpperCase();
    let val = 0;
    if (char >= '0' && char <= '9') {
      val = char.charCodeAt(0) - 48;
    } else if (char >= 'A' && char <= 'Z') {
      val = char.charCodeAt(0) - 55;
    } else if (char === '<') {
      val = 0;
    }
    sum += val * weights[i % 3];
  }
  return String(sum % 10);
}

// Format date into YYMMDD for MRZ
function formatYYMMDD(dateStr: string, fallback: string): string {
  try {
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const monthMap: Record<string, string> = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
      };
      const month = monthMap[parts[1].toUpperCase()] || '01';
      const year = parts[2].slice(-2);
      return `${year}${month}${day}`;
    }
  } catch {
    // fallback
  }
  return fallback;
}

export function generateBangladeshMRZ(data: BangladeshPassportData) {
  // Format Line 1: P<BGD{SURNAME}<<{GIVEN_NAMES}<<<<< (padded to 44 chars)
  const cleanSurname = (data.surname || "").toUpperCase().replace(/[^A-Z]/g, '');
  const cleanGiven = (data.givenNames || "").toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/).join('<');
  let line1 = `P<BGD${cleanSurname}<<${cleanGiven}`;
  if (line1.length < 44) {
    line1 = line1.padEnd(44, '<');
  } else {
    line1 = line1.substring(0, 44);
  }

  // Format Line 2:
  // Passport number (9 chars) + check digit
  const passNoPadded = (data.passportNo || "").toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(9, '<').substring(0, 9);
  const passNoCheck = calcIcaoCheckDigit(passNoPadded);

  // Nationality (3 chars)
  const natCode = "BGD";

  // DOB (YYMMDD) + check digit
  const dobYYMMDD = formatYYMMDD(data.dateOfBirth, "970523");
  const dobCheck = calcIcaoCheckDigit(dobYYMMDD);

  // Sex
  const sexChar = data.sex || 'M';

  // Expiry (YYMMDD) + check digit
  const expYYMMDD = formatYYMMDD(data.dateOfExpiry, "330130");
  const expCheck = calcIcaoCheckDigit(expYYMMDD);

  // Personal No (up to 14 chars) + check digit
  const persNoClean = (data.personalNo || "").replace(/[^0-9A-Z]/g, '');
  const persNoPadded = persNoClean.padEnd(14, '<').substring(0, 14);
  const persNoCheck = calcIcaoCheckDigit(persNoPadded);

  // Composite check digit of positions 1-10, 14-20, 22-43
  const compositeInput = passNoPadded + passNoCheck + dobYYMMDD + dobCheck + expYYMMDD + expCheck + persNoPadded + persNoCheck;
  const compositeCheck = calcIcaoCheckDigit(compositeInput);

  const line2Raw = `${passNoPadded}${passNoCheck}${natCode}${dobYYMMDD}${dobCheck}${sexChar}${expYYMMDD}${expCheck}${persNoPadded}${persNoCheck}${compositeCheck}`;
  const line2 = line2Raw.padEnd(44, '<').substring(0, 44);

  return { line1, line2 };
}

export const BangladeshPassportCard: React.FC<{
  data?: BangladeshPassportData;
  className?: string;
}> = ({ data = defaultBangladeshPassportData, className = "" }) => {
  const mrz = useMemo(() => generateBangladeshMRZ(data), [data]);

  const isCustomPhoto = Boolean(data.photoUrl && data.photoUrl !== defaultBangladeshPassportData.photoUrl);
  const isDefaultSignature = data.surname.toUpperCase() === defaultBangladeshPassportData.surname;

  // Formatted date string for ghost portrait watermark (e.g. 23.05.97)
  const dobWatermark = useMemo(() => {
    const parts = (data.dateOfBirth || "").trim().split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const monthMap: Record<string, string> = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
      };
      const month = monthMap[parts[1].toUpperCase()] || '05';
      const year = parts[2].slice(-2);
      return `${day}.${month}.${year}`;
    }
    return "23.05.97";
  }, [data.dateOfBirth]);

  const isCustomGhost = isCustomPhoto || dobWatermark !== "23.05.97";
  const cleanPassChars = (data.passportNo || "A06821716").toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9).split('');

  const isDefaultSpecimen = useMemo(() => {
    if (isCustomPhoto) return false;
    const keys: (keyof BangladeshPassportData)[] = [
      'passportNo', 'surname', 'givenNames', 'nationality', 'personalNo',
      'dateOfBirth', 'previousPassportNo', 'sex', 'placeOfBirth',
      'dateOfIssue', 'issuingAuthority', 'dateOfExpiry', 'bookletSerial',
      'fatherName', 'motherName', 'spouseName',
      'permanentAddress1', 'permanentAddress2',
      'emergencyName', 'emergencyRelationship',
      'emergencyAddress1', 'emergencyAddress2', 'emergencyPhone'
    ];
    return keys.every(
      (k) => String(data[k] ?? '').trim().toUpperCase() === String(defaultBangladeshPassportData[k] ?? '').trim().toUpperCase()
    );
  }, [data, isCustomPhoto]);

  return (
    <div
      className={`relative w-full overflow-hidden select-none shadow-2xl rounded-sm border border-stone-300 bg-stone-100 ${className}`}
      style={{
        aspectRatio: "623 / 863",
        containerType: "inline-size",
        fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* Clean 1:1 Reference Base Plate (623x863) */}
      <img
        src="/assets/aistudio/bgd_passport_clean_bg.png"
        alt="People's Republic of Bangladesh Passport Base Plate"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
      />

      {/* Exact 1:1 Reference Specimen Overlay when default specimen values & portrait are active */}
      {isDefaultSpecimen && (
        <img
          src="/assets/aistudio/bgd_passport_reference.png"
          alt="People's Republic of Bangladesh Passport Specimen Reference"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-30"
        />
      )}

      {/* Live Interactive Overlay Layer */}
      <div className="absolute inset-0 w-full h-full z-20 pointer-events-none text-[#1c1f24]">
        {/* ========================================================= */}
        {/* TOP PAGE: PERSONAL DATA AND EMERGENCY CONTACT             */}
        {/* ========================================================= */}

        {/* Top-Left Vertical Laser-Perforated Passport Number (reads bottom-to-top, rotated -90deg) */}
        <svg
          viewBox="0 0 36 310"
          className="absolute pointer-events-none"
          style={{
            left: "4.17%",
            top: "6.49%",
            width: "5.78%",
            height: "35.69%",
          }}
        >
          {cleanPassChars.map((ch, idx) => {
            const glyph = DOT_MATRIX_FONT[ch] || DOT_MATRIX_FONT['0'];
            // Character 0 ('A') at bottom, last character ('6') at top
            const charBaseY = 274 - idx * 33;
            return (
              <g key={idx}>
                {glyph.map((rowStr, rIdx) =>
                  rowStr.split('').map((bit, cIdx) => {
                    if (bit !== '1') return null;
                    // Rotated -90deg: glyph row rIdx goes left-to-right (x), glyph col cIdx goes bottom-to-top (y)
                    const cx = 4 + rIdx * 4.2;
                    const cy = charBaseY + (4 - cIdx) * 4.2;
                    return (
                      <g key={`${rIdx}-${cIdx}`}>
                        <circle cx={cx + 0.4} cy={cy + 0.4} r={1.45} fill="rgba(255,250,240,0.75)" />
                        <circle cx={cx} cy={cy} r={1.25} fill="#2b231d" fillOpacity={0.85} />
                      </g>
                    );
                  })
                )}
              </g>
            );
          })}
        </svg>

        {/* Top-Right Vertical Barcode Serial Text (reads bottom-to-top along right edge of 1D barcode) */}
        <div
          className="absolute font-mono font-bold text-[#1e2226] whitespace-nowrap leading-none"
          style={{
            left: "84.91%",
            top: "34.41%",
            transformOrigin: "left top",
            transform: "rotate(-90deg)",
            fontSize: "1.95cqw",
            letterSpacing: "0.49em",
          }}
        >
          {cleanPassChars.join(' ')}
        </div>

        {/* Top Page Text Fields (x = 30.34%) */}
        {/* Name */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.34%", top: "8.57%", fontSize: "1.78cqw", transform: "scaleX(0.88)", transformOrigin: "left top" }}
        >
          {data.givenNames} {data.surname}
        </div>

        {/* Father's Name */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.34%", top: "10.89%", fontSize: "1.78cqw", transform: "scaleX(0.88)", transformOrigin: "left top" }}
        >
          {data.fatherName}
        </div>

        {/* Mother's Name */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.34%", top: "13.09%", fontSize: "1.78cqw", transform: "scaleX(0.88)", transformOrigin: "left top" }}
        >
          {data.motherName}
        </div>

        {/* Spouse's Name */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.34%", top: "15.18%", fontSize: "1.78cqw", transform: "scaleX(0.88)", transformOrigin: "left top" }}
        >
          {data.spouseName || ""}
        </div>

        {/* Permanent Address Line 1 */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.34%", top: "17.27%", fontSize: "1.75cqw", transform: "scaleX(0.86)", transformOrigin: "left top" }}
        >
          {data.permanentAddress1}
        </div>

        {/* Permanent Address Line 2 */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.34%", top: "19.12%", fontSize: "1.75cqw", transform: "scaleX(0.86)", transformOrigin: "left top" }}
        >
          {data.permanentAddress2}
        </div>

        {/* Emergency Contact Name */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.34%", top: "23.75%", fontSize: "1.78cqw", transform: "scaleX(0.88)", transformOrigin: "left top" }}
        >
          {data.emergencyName}
        </div>

        {/* Emergency Contact Relationship */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.34%", top: "26.07%", fontSize: "1.78cqw", transform: "scaleX(0.88)", transformOrigin: "left top" }}
        >
          {data.emergencyRelationship}
        </div>

        {/* Emergency Contact Address Line 1 */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.50%", top: "28.16%", fontSize: "1.75cqw", transform: "scaleX(0.86)", transformOrigin: "left top" }}
        >
          {data.emergencyAddress1}
        </div>

        {/* Emergency Contact Address Line 2 */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.50%", top: "30.01%", fontSize: "1.75cqw", transform: "scaleX(0.86)", transformOrigin: "left top" }}
        >
          {data.emergencyAddress2}
        </div>

        {/* Emergency Contact Telephone No */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1e2124]"
          style={{ left: "30.66%", top: "32.10%", fontSize: "1.78cqw", transform: "scaleX(0.88)", transformOrigin: "left top" }}
        >
          {data.emergencyPhone}
        </div>

        {/* ========================================================= */}
        {/* BOTTOM PAGE: BIO-DATA & MRZ                               */}
        {/* ========================================================= */}

        {/* Custom Bearer Portrait Photo when uploaded */}
        {isCustomPhoto && (
          <div
            className="absolute overflow-hidden rounded-xs"
            style={{
              left: "4.65%",
              top: "62.57%",
              width: "23.44%",
              height: "21.67%",
            }}
          >
            <img
              src={data.photoUrl}
              alt="Bearer portrait"
              className="w-full h-full object-cover object-center contrast-105"
            />
          </div>
        )}

        {/* Ghost Portrait with DOB watermark overlay when photo or DOB is modified */}
        {isCustomGhost && (
          <div
            className="absolute overflow-hidden rounded-xs bg-[#e8e5ec]"
            style={{
              left: "85.71%",
              top: "69.52%",
              width: "9.31%",
              height: "6.95%",
            }}
          >
            <img
              src={data.photoUrl || "/assets/aistudio/bgd_passport_portrait.png"}
              alt="Ghost bearer portrait"
              className="w-full h-full object-cover object-top grayscale opacity-65 contrast-110 mix-blend-multiply"
            />
            <div
              className="absolute inset-x-0 bottom-[18%] text-center font-sans font-extrabold text-[#4a4d52]/80 leading-none"
              style={{
                fontSize: "1.75cqw",
                letterSpacing: "0.04em",
                textShadow: "0 0 2px rgba(255,255,255,0.85)",
              }}
            >
              {dobWatermark}
            </div>
          </div>
        )}

        {/* Row 1: Type / Country Code / Passport Number */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "31.78%", top: "58.52%", fontSize: "2.05cqw" }}
        >
          P
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "41.89%", top: "58.52%", fontSize: "2.05cqw", letterSpacing: "0.02em" }}
        >
          BGD
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "62.44%", top: "58.52%", fontSize: "2.05cqw", letterSpacing: "0.02em" }}
        >
          {data.passportNo}
        </div>

        {/* Row 2: Surname */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "31.46%", top: "62.11%", fontSize: "2.05cqw", letterSpacing: "0.01em" }}
        >
          {data.surname}
        </div>

        {/* Row 3: Given Name */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "31.62%", top: "65.35%", fontSize: "2.05cqw", letterSpacing: "0.01em" }}
        >
          {data.givenNames}
        </div>

        {/* Row 4: Nationality / Personal No. */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "31.78%", top: "68.83%", fontSize: "2.05cqw", letterSpacing: "0.01em" }}
        >
          {data.nationality}
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "53.93%", top: "68.83%", fontSize: "2.05cqw", letterSpacing: "0.02em" }}
        >
          {data.personalNo}
        </div>

        {/* Row 5: Date of Birth / Previous Passport No. */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "31.94%", top: "72.42%", fontSize: "2.05cqw", letterSpacing: "0.01em" }}
        >
          {data.dateOfBirth}
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "54.09%", top: "72.42%", fontSize: "2.05cqw", letterSpacing: "0.02em" }}
        >
          {data.previousPassportNo}
        </div>

        {/* Row 6: Sex / Place of Birth / Booklet Serial No */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "31.78%", top: "75.67%", fontSize: "2.05cqw" }}
        >
          {data.sex}
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "42.86%", top: "75.67%", fontSize: "2.05cqw", letterSpacing: "0.01em" }}
        >
          {data.placeOfBirth}
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#1c2026]"
          style={{ left: "74.32%", top: "75.67%", fontSize: "2.05cqw", letterSpacing: "0.02em" }}
        >
          {data.bookletSerial}
        </div>

        {/* Row 7: Date of Issue / Issuing Authority */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "31.94%", top: "79.03%", fontSize: "2.05cqw", letterSpacing: "0.01em" }}
        >
          {data.dateOfIssue}
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "53.93%", top: "79.03%", fontSize: "2.05cqw", letterSpacing: "0.01em" }}
        >
          {data.issuingAuthority}
        </div>

        {/* Row 8: Date of Expiry / Holder's Signature */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#16191d]"
          style={{ left: "32.10%", top: "82.73%", fontSize: "2.05cqw", letterSpacing: "0.01em" }}
        >
          {data.dateOfExpiry}
        </div>

        {isDefaultSignature ? (
          <img
            src="/assets/aistudio/bgd_passport_signature.png"
            alt="Holder Signature"
            className="absolute object-contain pointer-events-none"
            style={{
              left: "66.13%",
              top: "82.27%",
              width: "8.35%",
              height: "3.01%",
            }}
          />
        ) : (
          <div
            className="absolute italic text-[#1e2229] font-semibold whitespace-nowrap leading-none"
            style={{
              left: "65.8%",
              top: "82.5%",
              transform: "rotate(-6deg)",
              fontFamily: "'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive",
              fontSize: "2.5cqw",
            }}
          >
            {data.surname.slice(0, 1) + data.surname.slice(1).toLowerCase()}
          </div>
        )}

        {/* ========================================================= */}
        {/* ICAO Doc 9303 TD3 2-Line MRZ (44 monospace characters each) */}
        {/* ========================================================= */}
        <div
          className="absolute whitespace-pre uppercase leading-none font-bold text-[#14171a]"
          style={{
            left: "4.82%",
            top: "89.69%",
            fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
            fontSize: "2.75cqw",
            letterSpacing: "0.18em",
          }}
        >
          {mrz.line1}
        </div>
        <div
          className="absolute whitespace-pre uppercase leading-none font-bold text-[#14171a]"
          style={{
            left: "4.82%",
            top: "93.16%",
            fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
            fontSize: "2.75cqw",
            letterSpacing: "0.18em",
          }}
        >
          {mrz.line2}
        </div>
      </div>
    </div>
  );
};
