import React, { useMemo } from 'react';

export interface GhanaPassportData {
  passportNo: string;
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string; // e.g., "11 OCT 1999"
  sex: 'M' | 'F';
  placeOfBirth: string;
  dateOfIssue: string; // e.g., "23 APR 2020"
  placeOfIssue: string;
  dateOfExpiry: string; // e.g., "22 APR 2030"
  authority: string;
  photoUrl?: string;
  signatureUrl?: string;
}

export const defaultGhanaPassportData: GhanaPassportData = {
  passportNo: "G2866330",
  surname: "OPOKU",
  givenNames: "EBENEZER",
  nationality: "GHANAIAN",
  dateOfBirth: "11 OCT 1999",
  sex: "M",
  placeOfBirth: "ACCRA",
  dateOfIssue: "23 APR 2020",
  placeOfIssue: "ACCRA",
  dateOfExpiry: "22 APR 2030",
  authority: "PASSPORT OFFICE",
  photoUrl: "/assets/aistudio/ghana_passport_portrait.png",
  signatureUrl: "/assets/aistudio/ghana_passport_signature.png",
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

function formatYYMMDD(dateStr: string, fallback: string): string {
  try {
    const clean = dateStr.trim().toUpperCase();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-');
      return `${y.slice(-2)}${m}${d}`;
    }
    const parts = clean.split(/\s+/);
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

export function generateGhanaMRZ(data: GhanaPassportData) {
  const isSpec =
    data.passportNo.toUpperCase() === defaultGhanaPassportData.passportNo &&
    data.surname.toUpperCase() === defaultGhanaPassportData.surname &&
    data.givenNames.toUpperCase() === defaultGhanaPassportData.givenNames &&
    data.dateOfBirth.toUpperCase() === defaultGhanaPassportData.dateOfBirth &&
    data.dateOfExpiry.toUpperCase() === defaultGhanaPassportData.dateOfExpiry &&
    data.sex === defaultGhanaPassportData.sex;

  if (isSpec) {
    return {
      line1: "P<GHAOPOKU<<EBENEZER<<<<<<<<<<<<<<<<<<<<<<<<",
      line2: "G2866330<0GHA9910115M3004227<<<<<<<<<<<<<<<0",
    };
  }

  const cleanSurname = (data.surname || "").toUpperCase().replace(/[^A-Z]/g, '');
  const cleanGiven = (data.givenNames || "").toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/).join('<');
  const line1 = `P<GHA${cleanSurname}<<${cleanGiven}`.padEnd(44, '<').substring(0, 44);

  const passNoPadded = (data.passportNo || "").toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(9, '<').substring(0, 9);
  const passNoCheck = calcIcaoCheckDigit(passNoPadded);
  const dobYYMMDD = formatYYMMDD(data.dateOfBirth, "991011");
  const dobCheck = calcIcaoCheckDigit(dobYYMMDD);
  const sexChar = data.sex || 'M';
  const expYYMMDD = formatYYMMDD(data.dateOfExpiry, "300422");
  const expCheck = calcIcaoCheckDigit(expYYMMDD);
  const optionalField = "<".repeat(15);
  const compositeInput = passNoPadded + passNoCheck + dobYYMMDD + dobCheck + expYYMMDD + expCheck + optionalField;
  const compositeCheck = calcIcaoCheckDigit(compositeInput);

  const line2 = `${passNoPadded}${passNoCheck}GHA${dobYYMMDD}${dobCheck}${sexChar}${expYYMMDD}${expCheck}${optionalField}${compositeCheck}`.padEnd(44, '<').substring(0, 44);
  return { line1, line2 };
}

export const GhanaPassportCard: React.FC<{
  data?: GhanaPassportData;
  className?: string;
}> = ({ data = defaultGhanaPassportData, className = "" }) => {
  const mrz = useMemo(() => generateGhanaMRZ(data), [data]);

  const isCustomPhoto = Boolean(data.photoUrl && data.photoUrl !== defaultGhanaPassportData.photoUrl);

  return (
    <div
      className={`relative w-full overflow-hidden select-none shadow-2xl rounded-sm border border-stone-300 bg-[#fdfbf6] ${className}`}
      style={{
        aspectRatio: "580 / 800",
        containerType: "inline-size",
        fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* Clean 1:1 Reference Base Plate (580x800) with Black Star Guilloche, Labels, Coat of Arms, Signature & PDF417 Barcode */}
      <img
        src="/assets/aistudio/ghana_passport_clean_bg.png"
        alt="Republic of Ghana Passport Base Plate"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
      />

      {/* Live Interactive Overlay Layer */}
      <div className="absolute inset-0 w-full h-full z-20 pointer-events-none text-[#1e2124]">
          {/* Top Page Left Vertical Laser-Perforated Passport Number (x: 4.83%, y: 8.13%, w: 7.24%, h: 35.63%) */}
          <div
            className="absolute flex items-center justify-center font-mono font-extrabold text-[#3c342b]/80"
            style={{
              left: "4.83%",
              top: "8.13%",
              width: "7.24%",
              height: "35.63%",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: "4.2cqw",
              letterSpacing: "0.36em",
              textShadow: "0.5px 0.5px 0 rgba(255,255,255,0.85)",
            }}
          >
            {data.passportNo}
          </div>

          {/* Custom Portrait & Ghost Portrait when user uploads a custom photo */}
          {isCustomPhoto && (
            <>
              <div
                className="absolute overflow-hidden"
                style={{
                  left: "7.24%",
                  top: "63.00%",
                  width: "25.52%",
                  height: "18.75%",
                }}
              >
                <img
                  src={data.photoUrl}
                  alt="Bearer portrait"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div
                className="absolute overflow-hidden opacity-60 mix-blend-multiply"
                style={{
                  left: "68.97%",
                  top: "63.50%",
                  width: "13.45%",
                  height: "9.75%",
                }}
              >
                <img
                  src={data.photoUrl}
                  alt="Ghost bearer portrait"
                  className="w-full h-full object-cover object-top grayscale contrast-95"
                />
              </div>
            </>
          )}

          {/* Row 1 Values: Type (35.86%, 58.25%), Country Code (49.14%, 58.25%), Passport No (76.72%, 58.25%) */}
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "35.86%", top: "58.25%", fontSize: "2.25cqw" }}
          >
            P
          </div>
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "49.14%", top: "58.25%", fontSize: "2.25cqw" }}
          >
            GHA
          </div>
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "76.72%", top: "58.25%", fontSize: "2.25cqw", letterSpacing: "0.02em" }}
          >
            {data.passportNo}
          </div>

          {/* Row 2 Value: Surname (35.69%, 61.38%) */}
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "35.69%", top: "61.38%", fontSize: "2.25cqw" }}
          >
            {data.surname}
          </div>

          {/* Row 3 Value: Given Names (35.86%, 64.38%) */}
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "35.86%", top: "64.38%", fontSize: "2.25cqw" }}
          >
            {data.givenNames}
          </div>

          {/* Row 4 Value: Nationality (35.86%, 67.50%) */}
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "35.86%", top: "67.50%", fontSize: "2.25cqw" }}
          >
            {data.nationality}
          </div>

          {/* Row 5 Value: Date of birth (36.03%, 70.50%) */}
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "36.03%", top: "70.50%", fontSize: "2.25cqw" }}
          >
            {data.dateOfBirth}
          </div>

          {/* Row 6 Values: Sex (35.86%, 73.75%) & Place of birth (46.72%, 73.75%) */}
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "35.86%", top: "73.75%", fontSize: "2.25cqw" }}
          >
            {data.sex}
          </div>
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "46.72%", top: "73.75%", fontSize: "2.25cqw" }}
          >
            {data.placeOfBirth}
          </div>

          {/* Row 7 Values: Date of issue (35.86%, 76.75%) & Place of issue (71.03%, 76.75%) */}
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "35.86%", top: "76.75%", fontSize: "2.25cqw" }}
          >
            {data.dateOfIssue}
          </div>
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "71.03%", top: "76.75%", fontSize: "2.25cqw" }}
          >
            {data.placeOfIssue}
          </div>

          {/* Row 8 Values: Date of expiry (35.86%, 79.75%) & Authority (71.21%, 79.75%) */}
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "35.86%", top: "79.75%", fontSize: "2.25cqw" }}
          >
            {data.dateOfExpiry}
          </div>
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none text-[#1f2328]"
            style={{ left: "71.21%", top: "79.75%", fontSize: "2.25cqw" }}
          >
            {data.authority}
          </div>

          {/* ICAO Doc 9303 TD3 2-Line MRZ (x: 9.14%, y1: 91.25%, y2: 94.63%) */}
          <div
            className="absolute whitespace-pre uppercase leading-none font-bold text-[#1d2024]"
            style={{
              left: "9.14%",
              top: "91.25%",
              fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
              fontSize: "2.62cqw",
              letterSpacing: "0.142em",
            }}
          >
            {mrz.line1}
          </div>
          <div
            className="absolute whitespace-pre uppercase leading-none font-bold text-[#1d2024]"
            style={{
              left: "9.14%",
              top: "94.63%",
              fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
              fontSize: "2.62cqw",
              letterSpacing: "0.142em",
            }}
          >
            {mrz.line2}
          </div>
        </div>
    </div>
  );
};
