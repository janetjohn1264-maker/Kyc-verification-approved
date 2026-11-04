import React, { useMemo } from 'react';

export interface NepalPassportData {
  passportNo: string;
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string; // e.g., "22 MAY 1993"
  citizenshipNo: string; // e.g., "161053-301"
  sex: 'M' | 'F';
  placeOfBirth: string; // e.g., "SAPTARI"
  dateOfIssue: string; // e.g., "19 NOV 2021"
  issuingAuthority: string; // e.g., "MOFA, DEPARTMENT OF PASSPORT"
  dateOfExpiry: string; // e.g., "18 NOV 2031"
  photoUrl?: string;
  signatureUrl?: string;
}

export const defaultNepalPassportData: NepalPassportData = {
  passportNo: "12524139",
  surname: "YADAV",
  givenNames: "MITHLESH KUMAR",
  nationality: "NEPALESE",
  dateOfBirth: "22 MAY 1993",
  citizenshipNo: "161053-301",
  sex: "M",
  placeOfBirth: "SAPTARI",
  dateOfIssue: "19 NOV 2021",
  issuingAuthority: "MOFA, DEPARTMENT OF PASSPORT",
  dateOfExpiry: "18 NOV 2031",
  photoUrl: "/assets/aistudio/nepal_passport_portrait.png",
  signatureUrl: "/assets/aistudio/nepal_passport_signature.png",
};

export const nepalRandomSpecimens: NepalPassportData[] = [
  defaultNepalPassportData,
  {
    passportNo: "14829304",
    surname: "SHRESTHA",
    givenNames: "DIPENDRA PRASAD",
    nationality: "NEPALESE",
    dateOfBirth: "14 AUG 1995",
    citizenshipNo: "271048-412",
    sex: "M",
    placeOfBirth: "KATHMANDU",
    dateOfIssue: "10 MAR 2022",
    issuingAuthority: "MOFA, DEPARTMENT OF PASSPORT",
    dateOfExpiry: "09 MAR 2032",
    photoUrl: "/assets/aistudio/nepal_passport_portrait.png",
    signatureUrl: "/assets/aistudio/nepal_passport_signature.png",
  },
  {
    passportNo: "16392018",
    surname: "GURUNG",
    givenNames: "SUNITA KUMARI",
    nationality: "NEPALESE",
    dateOfBirth: "05 NOV 1998",
    citizenshipNo: "331092-118",
    sex: "F",
    placeOfBirth: "POKHARA",
    dateOfIssue: "18 JUL 2023",
    issuingAuthority: "MOFA, DEPARTMENT OF PASSPORT",
    dateOfExpiry: "17 JUL 2033",
    photoUrl: "/assets/aistudio/nepal_passport_portrait.png",
    signatureUrl: "/assets/aistudio/nepal_passport_signature.png",
  },
  {
    passportNo: "19204815",
    surname: "THAPA",
    givenNames: "RAMESH BAHADUR",
    nationality: "NEPALESE",
    dateOfBirth: "29 JAN 1991",
    citizenshipNo: "191034-509",
    sex: "M",
    placeOfBirth: "CHITWAN",
    dateOfIssue: "04 SEP 2021",
    issuingAuthority: "MOFA, DEPARTMENT OF PASSPORT",
    dateOfExpiry: "03 SEP 2031",
    photoUrl: "/assets/aistudio/nepal_passport_portrait.png",
    signatureUrl: "/assets/aistudio/nepal_passport_signature.png",
  },
];

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
      const month = monthMap[parts[1].toUpperCase()] || '05';
      const year = parts[2].slice(-2);
      return `${year}${month}${day}`;
    }
  } catch {
    // fallback
  }
  return fallback;
}

export function generateNepalMRZ(data: NepalPassportData) {
  const isSpec =
    data.passportNo.toUpperCase() === defaultNepalPassportData.passportNo &&
    data.surname.toUpperCase() === defaultNepalPassportData.surname &&
    data.givenNames.toUpperCase() === defaultNepalPassportData.givenNames &&
    data.dateOfBirth.toUpperCase() === defaultNepalPassportData.dateOfBirth &&
    data.citizenshipNo.toUpperCase() === defaultNepalPassportData.citizenshipNo &&
    data.dateOfExpiry.toUpperCase() === defaultNepalPassportData.dateOfExpiry &&
    data.sex === defaultNepalPassportData.sex;

  if (isSpec) {
    return {
      line1: "P<NPLYADAV<<MITHLESH<KUMAR<<<<<<<<<<<<<<<<<<",
      line2: "12524139<3NPL9305225M3111183161053301<<<<<60",
    };
  }

  const cleanSurname = (data.surname || "").toUpperCase().replace(/[^A-Z]/g, '');
  const cleanGiven = (data.givenNames || "").toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/).join('<');
  const line1 = `P<NPL${cleanSurname}<<${cleanGiven}`.padEnd(44, '<').substring(0, 44);

  const passNoPadded = (data.passportNo || "").toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(9, '<').substring(0, 9);
  const passNoCheck = calcIcaoCheckDigit(passNoPadded);
  const dobYYMMDD = formatYYMMDD(data.dateOfBirth, "930522");
  const dobCheck = calcIcaoCheckDigit(dobYYMMDD);
  const sexChar = data.sex || 'M';
  const expYYMMDD = formatYYMMDD(data.dateOfExpiry, "311118");
  const expCheck = calcIcaoCheckDigit(expYYMMDD);

  const citClean = (data.citizenshipNo || "").toUpperCase().replace(/[^A-Z0-9]/g, '');
  const optionalData14 = citClean.padEnd(14, '<').substring(0, 14);
  const optionalCheck = calcIcaoCheckDigit(optionalData14);
  const compositeInput = passNoPadded + passNoCheck + dobYYMMDD + dobCheck + expYYMMDD + expCheck + optionalData14 + optionalCheck;
  const compositeCheck = calcIcaoCheckDigit(compositeInput);

  const line2 = `${passNoPadded}${passNoCheck}NPL${dobYYMMDD}${dobCheck}${sexChar}${expYYMMDD}${expCheck}${optionalData14}${optionalCheck}${compositeCheck}`.padEnd(44, '<').substring(0, 44);
  return { line1, line2 };
}

export const NepalPassportCard: React.FC<{
  data?: NepalPassportData;
  className?: string;
}> = ({ data = defaultNepalPassportData, className = "" }) => {
  const mrz = useMemo(() => generateNepalMRZ(data), [data]);

  const isCustomPhoto = Boolean(data.photoUrl && data.photoUrl !== defaultNepalPassportData.photoUrl);

  const isExactSpecimen =
    !isCustomPhoto &&
    data.passportNo.toUpperCase() === defaultNepalPassportData.passportNo &&
    data.surname.toUpperCase() === defaultNepalPassportData.surname &&
    data.givenNames.toUpperCase() === defaultNepalPassportData.givenNames &&
    data.nationality.toUpperCase() === defaultNepalPassportData.nationality &&
    data.dateOfBirth.toUpperCase() === defaultNepalPassportData.dateOfBirth &&
    data.citizenshipNo.toUpperCase() === defaultNepalPassportData.citizenshipNo &&
    data.sex === defaultNepalPassportData.sex &&
    data.placeOfBirth.toUpperCase() === defaultNepalPassportData.placeOfBirth &&
    data.dateOfIssue.toUpperCase() === defaultNepalPassportData.dateOfIssue &&
    data.issuingAuthority.toUpperCase() === defaultNepalPassportData.issuingAuthority &&
    data.dateOfExpiry.toUpperCase() === defaultNepalPassportData.dateOfExpiry;

  const fitCqw = (text: string, baseCqw: number, maxChars: number, minCqw = baseCqw * 0.56) => {
    const len = (text || "").trim().length;
    if (len <= maxChars) return `${baseCqw}cqw`;
    return `${Math.max(minCqw, +(baseCqw * (maxChars / len)).toFixed(2))}cqw`;
  };

  return (
    <div
      className={`relative w-full overflow-hidden select-none shadow-2xl rounded-sm border border-stone-300 bg-[#f7faf2] ${className}`}
      style={{
        aspectRatio: "688 / 966",
        containerType: "inline-size",
        fontFamily: "'Arial Narrow', 'Roboto Condensed', 'Arial', Helvetica, sans-serif",
      }}
    >
      {/* Clean 1:1 Reference Base Plate (688x966) with Nepal Coat of Arms, Kuala Lumpur Embassy Seal, Officer Signature, Iridescent Band & Bilingual Labels */}
      <img
        src="/assets/aistudio/nepal_passport_clean_bg.png"
        alt="Nepal Passport Base Plate"
        draggable={false}
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
      />

      {/* Live Interactive Overlay Layer */}
      <div className="absolute inset-0 w-full h-full z-20 pointer-events-none text-[#16191d]">
        {/* Top Page (Page 3) Left Vertical Laser-Perforated Passport Number (x: 4.07%, y: 10.04%, w: 6.69%, h: 28.78%) */}
        <div
          className="absolute flex items-center justify-center font-mono font-extrabold text-[#38332f]/80"
          style={{
            left: "4.07%",
            top: "10.04%",
            width: "6.69%",
            height: "28.78%",
            writingMode: "vertical-lr",
            transform: "rotate(180deg)",
            fontSize: "4.2cqw",
            letterSpacing: "0.26em",
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
                left: "3.78%",
                top: "62.32%",
                width: "27.62%",
                height: "23.29%",
              }}
            >
              <img
                src={data.photoUrl}
                alt="Bearer portrait"
                draggable={false}
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div
              className="absolute overflow-hidden opacity-65 mix-blend-multiply"
              style={{
                left: "83.72%",
                top: "61.49%",
                width: "11.05%",
                height: "9.21%",
              }}
            >
              <img
                src={data.photoUrl}
                alt="Ghost bearer portrait"
                draggable={false}
                className="w-full h-full object-cover object-top contrast-95"
              />
            </div>
          </>
        )}

        {/* Row 1 Values (y=547 -> 56.52%): Type (33.72%), Country Code (45.78%), Passport No. (67.44%) */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden"
          style={{ left: "33.72%", top: "56.52%", maxWidth: "10.0%", fontSize: "2.1cqw" }}
        >
          P
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden"
          style={{ left: "45.78%", top: "56.52%", maxWidth: "18.0%", fontSize: "2.1cqw" }}
        >
          NPL
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#14171a] overflow-hidden"
          style={{
            left: "67.44%",
            top: "56.42%",
            maxWidth: "26.0%",
            fontSize: fitCqw(data.passportNo, 2.38, 10),
            letterSpacing: "0.02em",
          }}
        >
          {data.passportNo}
        </div>

        {/* Row 2 Value (y=580 -> 59.94%): Surname (33.72%) */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden text-ellipsis"
          style={{ left: "33.72%", top: "59.94%", maxWidth: "48.0%", fontSize: fitCqw(data.surname, 2.05, 22) }}
        >
          {data.surname}
        </div>

        {/* Row 3 Value (y=612 -> 63.25%): Given Names (33.58%) */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden text-ellipsis"
          style={{ left: "33.58%", top: "63.25%", maxWidth: "48.0%", fontSize: fitCqw(data.givenNames, 2.05, 22) }}
        >
          {data.givenNames}
        </div>

        {/* Row 4 Value (y=649 -> 67.08%): Nationality (33.58%) */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden text-ellipsis"
          style={{ left: "33.58%", top: "67.08%", maxWidth: "48.0%", fontSize: fitCqw(data.nationality, 2.05, 20) }}
        >
          {data.nationality}
        </div>

        {/* Row 5 Values (y=684 -> 70.70%): Date of Birth (33.58%) & Citizenship No. (65.70%) */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden"
          style={{ left: "33.58%", top: "70.70%", maxWidth: "29.0%", fontSize: fitCqw(data.dateOfBirth, 2.05, 14) }}
        >
          {data.dateOfBirth}
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden"
          style={{ left: "65.70%", top: "70.70%", maxWidth: "30.0%", fontSize: fitCqw(data.citizenshipNo, 2.05, 15) }}
        >
          {data.citizenshipNo}
        </div>

        {/* Row 6 Values (y=720 -> 74.43%): Sex (33.58%) & Place of Birth (65.41%) */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden"
          style={{ left: "33.58%", top: "74.43%", maxWidth: "15.0%", fontSize: "2.05cqw" }}
        >
          {data.sex}
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden text-ellipsis"
          style={{ left: "65.41%", top: "74.43%", maxWidth: "30.0%", fontSize: fitCqw(data.placeOfBirth, 2.05, 15) }}
        >
          {data.placeOfBirth}
        </div>

        {/* Row 7 Values (y=755 -> 78.05%): Date of Issue (33.72%) & Issuing Authority (65.41%) */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden"
          style={{ left: "33.72%", top: "78.05%", maxWidth: "29.0%", fontSize: fitCqw(data.dateOfIssue, 2.05, 14) }}
        >
          {data.dateOfIssue}
        </div>
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden text-ellipsis"
          style={{ left: "65.41%", top: "78.26%", maxWidth: "31.5%", fontSize: fitCqw(data.issuingAuthority, 1.48, 28) }}
        >
          {data.issuingAuthority}
        </div>

        {/* Row 8 Value (y=788 -> 81.47%): Date of Expiry (33.72%) */}
        <div
          className="absolute font-bold uppercase whitespace-nowrap leading-none text-[#181b1f] overflow-hidden"
          style={{ left: "33.72%", top: "81.47%", maxWidth: "29.0%", fontSize: fitCqw(data.dateOfExpiry, 2.05, 14) }}
        >
          {data.dateOfExpiry}
        </div>

        {/* ICAO Doc 9303 TD3 2-Line MRZ (x=31 -> 4.51%, y1=873 -> 90.27%, y2=906 -> 93.69%) */}
        <div
          className="absolute whitespace-pre uppercase leading-none font-bold text-[#181b1f]"
          style={{
            left: "4.51%",
            top: "90.27%",
            maxWidth: "91.0%",
            fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
            fontSize: "2.36cqw",
            letterSpacing: "0.155em",
          }}
        >
          {mrz.line1}
        </div>
        <div
          className="absolute whitespace-pre uppercase leading-none font-bold text-[#181b1f]"
          style={{
            left: "4.51%",
            top: "93.69%",
            maxWidth: "91.0%",
            fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
            fontSize: "2.36cqw",
            letterSpacing: "0.155em",
          }}
        >
          {mrz.line2}
        </div>
      </div>

      {/* Exact 1:1 Reference Specimen Overlay when unmodified */}
      {isExactSpecimen && (
        <img
          src="/assets/aistudio/nepal_passport_reference.png"
          alt="Nepal Passport Exact Reference Specimen"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-30"
        />
      )}
    </div>
  );
};

export default NepalPassportCard;
