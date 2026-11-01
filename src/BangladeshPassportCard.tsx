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

  // Check if current data strictly matches default reference specimen
  const isDefaultSpecimen = useMemo(() => {
    return (
      data.passportNo === defaultBangladeshPassportData.passportNo &&
      data.surname === defaultBangladeshPassportData.surname &&
      data.givenNames === defaultBangladeshPassportData.givenNames &&
      data.personalNo === defaultBangladeshPassportData.personalNo &&
      data.dateOfBirth === defaultBangladeshPassportData.dateOfBirth &&
      data.dateOfIssue === defaultBangladeshPassportData.dateOfIssue &&
      data.dateOfExpiry === defaultBangladeshPassportData.dateOfExpiry &&
      data.placeOfBirth === defaultBangladeshPassportData.placeOfBirth &&
      data.emergencyName === defaultBangladeshPassportData.emergencyName &&
      data.emergencyPhone === defaultBangladeshPassportData.emergencyPhone &&
      (!data.photoUrl || data.photoUrl === defaultBangladeshPassportData.photoUrl)
    );
  }, [data]);

  // Formatted date string for ghost portrait watermark (e.g. 23.05.97)
  const dobWatermark = useMemo(() => {
    const parts = data.dateOfBirth.trim().split(/\s+/);
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

  return (
    <div
      className={`relative w-full overflow-hidden select-none shadow-2xl rounded-sm border border-stone-300 bg-stone-100 ${className}`}
      style={{
        aspectRatio: "623 / 863",
        fontFamily: "'Courier New', Courier, monospace, system-ui",
      }}
    >
      {/* Background Layer: authentic high-res clean scanned guilloche */}
      <img
        src="/assets/aistudio/bgd_passport_clean_bg.png"
        alt="Bangladesh Passport Background"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* If strictly default reference specimen, display the exact unaltered reference layer with 100% pixel fidelity */}
      {isDefaultSpecimen && (
        <img
          src="/assets/aistudio/bgd_passport_reference.png"
          alt="Authentic Bangladesh Passport Reference Specimen"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />
      )}

      {/* Dynamic Overlays: Active when fields are edited or randomized */}
      {!isDefaultSpecimen && (
        <div className="absolute inset-0 w-full h-full z-20 pointer-events-none text-neutral-900">
          {/* ========================================================= */}
          {/* TOP PAGE: PERSONAL DATA AND EMERGENCY CONTACT             */}
          {/* Reference bounding area: y: 0% .. 50%                     */}
          {/* ========================================================= */}

          {/* Left Vertical Laser Perforation */}
          <div
            className="absolute tracking-[0.22em] text-[10px] font-mono font-bold text-neutral-800 opacity-80"
            style={{
              left: "4.8%",
              top: "13.2%",
              transformOrigin: "left top",
              transform: "rotate(90deg)",
              letterSpacing: "0.42em",
            }}
          >
            {data.passportNo}
          </div>

          {/* Right Vertical Barcode Text */}
          <div
            className="absolute tracking-[0.35em] text-[9.5px] font-mono font-bold text-neutral-800 opacity-90"
            style={{
              left: "81.8%",
              top: "15.0%",
              transformOrigin: "left top",
              transform: "rotate(90deg)",
            }}
          >
            {data.passportNo.split('').join(' ')}
          </div>

          {/* Top Page Text Fields */}
          {/* Name */}
          <div
            className="absolute text-[10px] font-bold font-mono tracking-wide text-neutral-900"
            style={{ left: "30.4%", top: "8.7%" }}
          >
            {data.givenNames} {data.surname}
          </div>

          {/* Father's Name */}
          <div
            className="absolute text-[10px] font-bold font-mono tracking-wide text-neutral-900"
            style={{ left: "30.4%", top: "11.0%" }}
          >
            {data.fatherName}
          </div>

          {/* Mother's Name */}
          <div
            className="absolute text-[10px] font-bold font-mono tracking-wide text-neutral-900"
            style={{ left: "30.4%", top: "13.2%" }}
          >
            {data.motherName}
          </div>

          {/* Spouse's Name */}
          <div
            className="absolute text-[10px] font-bold font-mono tracking-wide text-neutral-900"
            style={{ left: "30.4%", top: "15.4%" }}
          >
            {data.spouseName || ""}
          </div>

          {/* Permanent Address Line 1 */}
          <div
            className="absolute text-[9.5px] font-bold font-mono tracking-tight text-neutral-900 max-w-[46%]"
            style={{ left: "30.4%", top: "17.4%" }}
          >
            {data.permanentAddress1}
          </div>

          {/* Permanent Address Line 2 */}
          <div
            className="absolute text-[9.5px] font-bold font-mono tracking-tight text-neutral-900"
            style={{ left: "30.4%", top: "19.3%" }}
          >
            {data.permanentAddress2}
          </div>

          {/* Emergency Contact Name */}
          <div
            className="absolute text-[10px] font-bold font-mono tracking-wide text-neutral-900"
            style={{ left: "30.4%", top: "23.9%" }}
          >
            {data.emergencyName}
          </div>

          {/* Emergency Contact Relationship */}
          <div
            className="absolute text-[10px] font-bold font-mono tracking-wide text-neutral-900"
            style={{ left: "30.4%", top: "26.1%" }}
          >
            {data.emergencyRelationship}
          </div>

          {/* Emergency Contact Address Line 1 */}
          <div
            className="absolute text-[9.5px] font-bold font-mono tracking-tight text-neutral-900 max-w-[46%]"
            style={{ left: "30.4%", top: "28.3%" }}
          >
            {data.emergencyAddress1}
          </div>

          {/* Emergency Contact Address Line 2 */}
          <div
            className="absolute text-[9.5px] font-bold font-mono tracking-tight text-neutral-900"
            style={{ left: "30.4%", top: "30.2%" }}
          >
            {data.emergencyAddress2}
          </div>

          {/* Emergency Contact Telephone No */}
          <div
            className="absolute text-[10px] font-bold font-mono tracking-wide text-neutral-900"
            style={{ left: "30.8%", top: "32.3%" }}
          >
            {data.emergencyPhone}
          </div>

          {/* ========================================================= */}
          {/* BOTTOM PAGE: BIO-DATA & MRZ                               */}
          {/* Reference bounding area: y: 50% .. 100%                   */}
          {/* ========================================================= */}

          {/* Bearer Portrait Photo (x: 29/623 = 4.65%, y: 540/863 = 62.57%, w: 146/623 = 23.44%, h: 187/863 = 21.67%) */}
          <div
            className="absolute overflow-hidden rounded-xs shadow-inner bg-slate-200"
            style={{
              left: "4.65%",
              top: "62.57%",
              width: "23.44%",
              height: "21.67%",
            }}
          >
            <img
              src={data.photoUrl || "/assets/aistudio/bgd_passport_portrait.png"}
              alt="Bearer portrait"
              className="w-full h-full object-cover object-center filter contrast-105"
            />
          </div>

          {/* Ghost Portrait with DOB watermark overlay */}
          <div
            className="absolute overflow-hidden rounded-xs opacity-65 grayscale contrast-125 mix-blend-multiply"
            style={{
              left: "86.6%",
              top: "70.0%",
              width: "9.0%",
              height: "10.8%",
            }}
          >
            <img
              src={data.photoUrl || "/assets/aistudio/bgd_passport_portrait.png"}
              alt="Ghost bearer portrait"
              className="w-full h-full object-cover object-top"
            />
            {/* Watermark date across lower chest */}
            <div
              className="absolute bottom-1 inset-x-0 text-center font-mono font-black text-[8px] tracking-wider text-black opacity-80"
              style={{ textShadow: "0 0 2px rgba(255,255,255,0.8)" }}
            >
              {dobWatermark}
            </div>
          </div>

          {/* Row 1: Type / Country Code / Passport Number */}
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "31.8%", top: "58.7%" }}
          >
            P
          </div>
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "42.3%", top: "58.7%" }}
          >
            {data.nationality === "BANGLADESHI" ? "BGD" : "BGD"}
          </div>
          <div
            className="absolute text-[11px] font-mono font-extrabold tracking-wider text-neutral-950"
            style={{ left: "62.4%", top: "58.7%" }}
          >
            {data.passportNo}
          </div>

          {/* Row 2: Surname */}
          <div
            className="absolute text-[11px] font-mono font-extrabold tracking-wider text-neutral-950"
            style={{ left: "31.8%", top: "62.2%" }}
          >
            {data.surname}
          </div>

          {/* Row 3: Given Name */}
          <div
            className="absolute text-[11px] font-mono font-extrabold tracking-wider text-neutral-950"
            style={{ left: "31.8%", top: "65.5%" }}
          >
            {data.givenNames}
          </div>

          {/* Row 4: Nationality / Personal No. */}
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "31.8%", top: "68.9%" }}
          >
            {data.nationality}
          </div>
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "53.8%", top: "68.9%" }}
          >
            {data.personalNo}
          </div>

          {/* Row 5: Date of Birth / Previous Passport No. */}
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "31.8%", top: "72.4%" }}
          >
            {data.dateOfBirth}
          </div>
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "53.8%", top: "72.4%" }}
          >
            {data.previousPassportNo}
          </div>

          {/* Row 6: Sex / Place of Birth / Booklet Serial No */}
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "32.0%", top: "75.8%" }}
          >
            {data.sex}
          </div>
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "42.8%", top: "75.8%" }}
          >
            {data.placeOfBirth}
          </div>
          <div
            className="absolute text-[10px] font-mono font-bold tracking-wider text-neutral-800"
            style={{ left: "74.8%", top: "75.8%" }}
          >
            {data.bookletSerial}
          </div>

          {/* Row 7: Date of Issue / Issuing Authority */}
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "31.8%", top: "79.2%" }}
          >
            {data.dateOfIssue}
          </div>
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "53.8%", top: "79.2%" }}
          >
            {data.issuingAuthority}
          </div>

          {/* Row 8: Date of Expiry / Holder's Signature */}
          <div
            className="absolute text-[10.5px] font-mono font-bold tracking-wider text-neutral-950"
            style={{ left: "31.8%", top: "82.6%" }}
          >
            {data.dateOfExpiry}
          </div>
          <div
            className="absolute font-serif italic text-neutral-800 font-semibold"
            style={{
              left: "66.5%",
              top: "82.6%",
              transform: "rotate(-5deg)",
              fontFamily: "'Brush Script MT', 'Segoe Script', cursive, sans-serif",
              fontSize: "14px",
            }}
          >
            {data.surname.slice(0, 1) + data.givenNames.slice(0, 1).toLowerCase() + data.surname.slice(1).toLowerCase()}
          </div>

          {/* ========================================================= */}
          {/* ICAO Doc 9303 TD3 2-Line MRZ (44 monospace characters each) */}
          {/* ========================================================= */}
          <div
            className="absolute left-[4.2%] right-[4.2%] text-neutral-950 font-mono tracking-[0.27em] text-[11px] leading-[1.6] font-bold select-all whitespace-pre"
            style={{
              top: "89.8%",
              fontFamily: "'OCRB', 'Courier New', Courier, monospace",
            }}
          >
            <div>{mrz.line1}</div>
            <div className="mt-[6px]">{mrz.line2}</div>
          </div>
        </div>
      )}
    </div>
  );
};
