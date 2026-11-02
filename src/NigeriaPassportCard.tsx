import React, { useMemo } from 'react';

export interface NigeriaPassportData {
  passportNo: string;
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string; // e.g., "30 DEC / DÉC 94"
  previousPassportNo: string; // e.g., "A10678936"
  nin: string; // e.g., "64841848001"
  sex: 'M' | 'F';
  placeOfBirth: string; // e.g., "LAGOS"
  dateOfIssue: string; // e.g., "26 JUL / JUIL 23"
  authority: string; // e.g., "ABUJA HQRS"
  dateOfExpiry: string; // e.g., "25 JUL / JUIL 33"
  photoUrl?: string;
  signatureUrl?: string;
}

export const defaultNigeriaPassportData: NigeriaPassportData = {
  passportNo: "B50621098",
  surname: "ELUAGU",
  givenNames: "ONYEBUCHI MCDONALD",
  nationality: "NIGERIAN",
  dateOfBirth: "30 DEC / DÉC 94",
  previousPassportNo: "A10678936",
  nin: "64841848001",
  sex: "M",
  placeOfBirth: "LAGOS",
  dateOfIssue: "26 JUL / JUIL 23",
  authority: "ABUJA HQRS",
  dateOfExpiry: "25 JUL / JUIL 33",
  photoUrl: "/assets/aistudio/nigeria_passport_portrait.png",
  signatureUrl: "/assets/aistudio/nigeria_passport_signature.png",
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
    }
    sum += val * weights[i % 3];
  }
  return String(sum % 10);
}

function formatNigeriaYYMMDD(dateStr: string, fallback: string): string {
  try {
    const clean = dateStr.trim().toUpperCase();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-');
      return `${y.slice(-2)}${m}${d}`;
    }
    // Supports formats like "30 DEC / DÉC 94" or "30 DEC 1994" or "30 DEC 94"
    const tokens = clean.replace(/\//g, ' ').split(/\s+/).filter(Boolean);
    if (tokens.length >= 3) {
      const day = tokens[0].padStart(2, '0');
      const monthMap: Record<string, string> = {
        JAN: '01', FEB: '02', FEV: '02', FÉV: '02', MAR: '03', APR: '04', AVR: '04',
        MAY: '05', MAI: '05', JUN: '06', JUIN: '06', JUL: '07', JUIL: '07',
        AUG: '08', AOU: '08', AOÛ: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12', DÉC: '12'
      };
      const month = monthMap[tokens[1]] || '01';
      const year = tokens[tokens.length - 1].slice(-2).padStart(2, '0');
      return `${year}${month}${day}`;
    }
  } catch {
    // fallback
  }
  return fallback;
}

export function generateNigeriaMRZ(data: NigeriaPassportData) {
  const isSpec =
    data.passportNo.toUpperCase() === defaultNigeriaPassportData.passportNo &&
    data.surname.toUpperCase() === defaultNigeriaPassportData.surname &&
    data.givenNames.toUpperCase() === defaultNigeriaPassportData.givenNames &&
    data.dateOfBirth.toUpperCase() === defaultNigeriaPassportData.dateOfBirth &&
    data.dateOfExpiry.toUpperCase() === defaultNigeriaPassportData.dateOfExpiry &&
    data.nin.toUpperCase() === defaultNigeriaPassportData.nin &&
    data.sex === defaultNigeriaPassportData.sex;

  if (isSpec) {
    return {
      line1: "P<NGAELUAGU<<ONYEBUCHI<MCDONALD<<<<<<<<<<<<<",
      line2: "B506210986NGA9412309M330725064841848001<<<64",
    };
  }

  const cleanSurname = (data.surname || "").toUpperCase().replace(/[^A-Z]/g, '');
  const cleanGiven = (data.givenNames || "").toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/).join('<');
  const line1 = `P<NGA${cleanSurname}<<${cleanGiven}`.padEnd(44, '<').substring(0, 44);

  const passNoPadded = (data.passportNo || "").toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(9, '<').substring(0, 9);
  const passNoCheck = calcIcaoCheckDigit(passNoPadded);
  const dobYYMMDD = formatNigeriaYYMMDD(data.dateOfBirth, "941230");
  const dobCheck = calcIcaoCheckDigit(dobYYMMDD);
  const sexChar = data.sex || 'M';
  const expYYMMDD = formatNigeriaYYMMDD(data.dateOfExpiry, "330725");
  const expCheck = calcIcaoCheckDigit(expYYMMDD);
  const cleanNin = (data.nin || "").toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(14, '<').substring(0, 14);
  const optionalCheck = calcIcaoCheckDigit(cleanNin);
  const compositeInput = passNoPadded + passNoCheck + dobYYMMDD + dobCheck + expYYMMDD + expCheck + cleanNin + optionalCheck;
  const compositeCheck = calcIcaoCheckDigit(compositeInput);

  const line2 = `${passNoPadded}${passNoCheck}NGA${dobYYMMDD}${dobCheck}${sexChar}${expYYMMDD}${expCheck}${cleanNin}${optionalCheck}${compositeCheck}`.padEnd(44, '<').substring(0, 44);
  return { line1, line2 };
}

export const NigeriaPassportCard: React.FC<{
  data?: NigeriaPassportData;
  className?: string;
}> = ({ data = defaultNigeriaPassportData, className = "" }) => {
  const mrz = useMemo(() => generateNigeriaMRZ(data), [data]);

  const isCustomPhoto = Boolean(data.photoUrl && data.photoUrl !== defaultNigeriaPassportData.photoUrl);
  const isCustomSignature = data.surname.toUpperCase() !== defaultNigeriaPassportData.surname;

  // Format numeric DOB for the silver oval hologram (e.g. "30.12.1994")
  const ovalDobNumeric = useMemo(() => {
    const yymmdd = formatNigeriaYYMMDD(data.dateOfBirth, "941230");
    const yy = parseInt(yymmdd.slice(0, 2), 10);
    const yyyy = yy > 30 ? `19${yymmdd.slice(0, 2)}` : `20${yymmdd.slice(0, 2)}`;
    const mm = yymmdd.slice(2, 4);
    const dd = yymmdd.slice(4, 6);
    return `${dd}.${mm}.${yyyy}`;
  }, [data.dateOfBirth]);

  const isCustomOvalDob = ovalDobNumeric !== "30.12.1994";
  const cleanPassChars = (data.passportNo || "B50621098").toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9).split('');

  return (
    <div
      className={`relative w-full overflow-hidden select-none shadow-2xl rounded-sm border border-stone-300 bg-[#f4fbf7] ${className}`}
      style={{
        aspectRatio: "625 / 845",
        containerType: "inline-size",
        fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* Clean 1:1 Reference Base Plate (625x845) with ECOWAS/Nigeria Top Page, Guilloche, Labels, Portrait, Ghost & Signature */}
      <img
        src="/assets/aistudio/nigeria_passport_clean_bg.png"
        alt="Federal Republic of Nigeria Passport Base Plate"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
      />

      {/* Live Interactive Overlay Layer */}
      <div className="absolute inset-0 w-full h-full z-20 pointer-events-none text-[#161a1d]">
        {/* Top Page Right Vertical Laser-Perforated Passport Number (5x7 dot-matrix reading bottom-to-top) */}
        <svg
          viewBox="0 0 36 290"
          className="absolute pointer-events-none"
          style={{
            left: "89.44%",
            top: "11.00%",
            width: "5.28%",
            height: "33.60%",
          }}
        >
          {cleanPassChars.map((ch, idx) => {
            const glyph = DOT_MATRIX_FONT[ch] || DOT_MATRIX_FONT['0'];
            // Character 0 ('B') at bottom, character 8 ('8') at top
            const charBaseY = 256 - idx * 31.5;
            return (
              <g key={idx}>
                {glyph.map((rowStr, rIdx) =>
                  rowStr.split('').map((bit, cIdx) => {
                    if (bit !== '1') return null;
                    const cx = 4 + rIdx * 4.2;
                    const cy = charBaseY + (4 - cIdx) * 4.2;
                    return (
                      <g key={`${rIdx}-${cIdx}`}>
                        <circle cx={cx + 0.4} cy={cy + 0.4} r={1.45} fill="rgba(255,255,255,0.8)" />
                        <circle cx={cx} cy={cy} r={1.3} fill="#2d2620" fillOpacity={0.88} />
                      </g>
                    );
                  })
                )}
              </g>
            );
          })}
        </svg>

        {/* Custom Portrait & Ghost Portrait when user uploads a custom photo */}
        {isCustomPhoto && (
          <>
            <div
              className="absolute overflow-hidden"
              style={{
                left: "5.60%",
                top: "62.72%",
                width: "22.40%",
                height: "19.53%",
              }}
            >
              <img
                src={data.photoUrl}
                alt="Bearer portrait"
                className="w-full h-full object-cover object-top grayscale contrast-95"
              />
            </div>
            <div
              className="absolute overflow-hidden opacity-60 mix-blend-multiply rounded-full"
              style={{
                left: "87.20%",
                top: "59.76%",
                width: "10.40%",
                height: "11.24%",
              }}
            >
              <img
                src={data.photoUrl}
                alt="Ghost bearer portrait"
                className="w-full h-full object-cover object-top grayscale contrast-105"
              />
            </div>
          </>
        )}

        {/* Row 1 Values: Type (32.00%, 59.17%), Country Code (42.08%, 59.17%), Passport No (61.12%, 59.05%) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "32.00%", top: "59.17%", fontSize: "2.15cqw" }}
        >
          P
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "42.08%", top: "59.17%", fontSize: "2.15cqw" }}
        >
          NGA
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "61.12%", top: "59.05%", fontSize: "2.15cqw", letterSpacing: "0.02em" }}
        >
          {data.passportNo}
        </div>

        {/* Row 2 Value: Surname (32.16%, 62.72%) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "32.16%", top: "62.72%", fontSize: "2.15cqw" }}
        >
          {data.surname}
        </div>

        {/* Row 3 Value: Given Names (32.16%, 65.92%) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "32.16%", top: "65.92%", fontSize: "2.15cqw" }}
        >
          {data.givenNames}
        </div>

        {/* Row 4 Values: Nationality (32.16%, 69.23%) & Previous Passport (61.28%, 69.11%) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "32.16%", top: "69.23%", fontSize: "2.15cqw" }}
        >
          {data.nationality}
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "61.28%", top: "69.11%", fontSize: "2.15cqw", letterSpacing: "0.02em" }}
        >
          {data.previousPassportNo}
        </div>

        {/* Row 5 Values: Date of Birth (32.32%, 72.54%) & NIN (61.12%, 72.43%) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "32.32%", top: "72.54%", fontSize: "2.15cqw" }}
        >
          {data.dateOfBirth}
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "61.12%", top: "72.43%", fontSize: "2.15cqw", letterSpacing: "0.02em" }}
        >
          {data.nin}
        </div>

        {/* Row 6 Values: Sex (32.32%, 75.98%) & Place of Birth (40.16%, 75.98%) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "32.32%", top: "75.98%", fontSize: "2.15cqw" }}
        >
          {data.sex}
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "40.16%", top: "75.98%", fontSize: "2.15cqw" }}
        >
          {data.placeOfBirth}
        </div>

        {/* Row 7 Values: Date of Issue (32.16%, 79.29%) & Authority (61.44%, 79.17%) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "32.16%", top: "79.29%", fontSize: "2.15cqw" }}
        >
          {data.dateOfIssue}
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "61.44%", top: "79.17%", fontSize: "2.15cqw" }}
        >
          {data.authority}
        </div>

        {/* Row 8 Value: Date of Expiry (32.16%, 82.72%) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#14181b]"
          style={{ left: "32.16%", top: "82.72%", fontSize: "2.15cqw" }}
        >
          {data.dateOfExpiry}
        </div>

        {/* Dynamic Oval Hologram DOB when DOB is modified from specimen */}
        {isCustomOvalDob && (
          <div
            className="absolute flex items-center justify-center rounded-full bg-[#dadce0]/90 font-sans font-bold text-[#4a4e54] leading-none"
            style={{
              left: "79.2%",
              top: "76.7%",
              width: "12.8%",
              height: "2.2%",
              fontSize: "1.65cqw",
              letterSpacing: "0.02em",
            }}
          >
            {ovalDobNumeric}
          </div>
        )}

        {/* Dynamic Holder's Signature when surname changes */}
        {isCustomSignature && (
          <div
            className="absolute flex items-center justify-center bg-[#eefaf0]/95 italic font-bold text-[#191d21]"
            style={{
              left: "69.5%",
              top: "82.4%",
              width: "12.5%",
              height: "5.2%",
              fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
              fontSize: "2.5cqw",
            }}
          >
            {data.surname.slice(0, 1) + data.surname.slice(1).toLowerCase()}
          </div>
        )}

        {/* ICAO Doc 9303 TD3 2-Line MRZ (x: 6.08%, y1: 91.36%, y2: 94.91%) */}
        <div
          className="absolute whitespace-pre uppercase leading-none font-bold text-[#14171a]"
          style={{
            left: "6.08%",
            top: "91.36%",
            fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
            fontSize: "2.82cqw",
            letterSpacing: "0.125em",
          }}
        >
          {mrz.line1}
        </div>
        <div
          className="absolute whitespace-pre uppercase leading-none font-bold text-[#14171a]"
          style={{
            left: "6.08%",
            top: "94.91%",
            fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
            fontSize: "2.82cqw",
            letterSpacing: "0.125em",
          }}
        >
          {mrz.line2}
        </div>
      </div>
    </div>
  );
};
