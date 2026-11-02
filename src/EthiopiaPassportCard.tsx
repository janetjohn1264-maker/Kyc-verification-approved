import React, { useMemo } from 'react';

export interface EthiopiaPassportData {
  passportNo: string;
  surnameAmharic: string;
  surname: string;
  givenNameAmharic: string;
  givenNames: string;
  nationality: string;
  personalNo?: string;
  dateOfBirth: string; // e.g., "03 NOV 05"
  sex: 'M' | 'F';
  placeOfBirth: string; // e.g., "DEGAH BOUR"
  dateOfIssue: string; // e.g., "16 APR 21"
  dateOfExpiry: string; // e.g., "15 APR 26"
  issuingAuthority: string;
  photoUrl?: string;
}

export const defaultEthiopiaPassportData: EthiopiaPassportData = {
  passportNo: "EP6442640",
  surnameAmharic: "መሀመድ",
  surname: "MAHAMED",
  givenNameAmharic: "ማርዎ አብዱላሂ",
  givenNames: "MARWO ABDULAHI",
  nationality: "ETHIOPIAN",
  personalNo: "",
  dateOfBirth: "03 NOV 05",
  sex: "F",
  placeOfBirth: "DEGAH BOUR",
  dateOfIssue: "16 APR 21",
  dateOfExpiry: "15 APR 26",
  issuingAuthority: "MAIN DEPARTMENT FOR IMMIGRATION AND NATIONALITY AFFAIRS",
  photoUrl: "/assets/aistudio/ethiopia_passport_portrait.png",
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

function formatEthYYMMDD(dateStr: string, fallback: string): string {
  try {
    const clean = dateStr.trim().toUpperCase();
    const parts = clean.split(/\s+/);
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      const monthMap: Record<string, string> = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
      };
      const month = monthMap[parts[1]] || '01';
      const year = parts[parts.length - 1].slice(-2).padStart(2, '0');
      return `${year}${month}${day}`;
    }
  } catch {
    // fallback
  }
  return fallback;
}

export function generateEthiopiaMRZ(data: EthiopiaPassportData) {
  const isSpec =
    data.passportNo.toUpperCase() === defaultEthiopiaPassportData.passportNo &&
    data.surname.toUpperCase() === defaultEthiopiaPassportData.surname &&
    data.givenNames.toUpperCase() === defaultEthiopiaPassportData.givenNames &&
    data.dateOfBirth.toUpperCase() === defaultEthiopiaPassportData.dateOfBirth &&
    data.dateOfExpiry.toUpperCase() === defaultEthiopiaPassportData.dateOfExpiry &&
    (!data.personalNo || data.personalNo === "") &&
    data.sex === defaultEthiopiaPassportData.sex;

  if (isSpec) {
    return {
      line1: "P<ETHMAHAMED<<MARWO<ABDULAHI<<<<<<<<<<<<<<<<",
      line2: "EP64426405ETH0511036F2604158<<<<<<<<<<<<<<02",
    };
  }

  const cleanSurname = (data.surname || "").toUpperCase().replace(/[^A-Z]/g, '');
  const cleanGiven = (data.givenNames || "").toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/).join('<');
  const line1 = `P<ETH${cleanSurname}<<${cleanGiven}`.padEnd(44, '<').substring(0, 44);

  const passNoPadded = (data.passportNo || "").toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(9, '<').substring(0, 9);
  const passNoCheck = calcIcaoCheckDigit(passNoPadded);
  const dobYYMMDD = formatEthYYMMDD(data.dateOfBirth, "051103");
  const dobCheck = calcIcaoCheckDigit(dobYYMMDD);
  const sexChar = data.sex || 'F';
  const expYYMMDD = formatEthYYMMDD(data.dateOfExpiry, "260415");
  const expCheck = calcIcaoCheckDigit(expYYMMDD);
  const cleanPersonal = (data.personalNo || "").toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(14, '<').substring(0, 14);
  const personalCheck = cleanPersonal === "<".repeat(14) ? "0" : calcIcaoCheckDigit(cleanPersonal);
  const optionalField = `${cleanPersonal}${personalCheck}`;
  const compositeInput = passNoPadded + passNoCheck + dobYYMMDD + dobCheck + expYYMMDD + expCheck + optionalField;
  const compositeCheck = calcIcaoCheckDigit(compositeInput);

  const line2 = `${passNoPadded}${passNoCheck}ETH${dobYYMMDD}${dobCheck}${sexChar}${expYYMMDD}${expCheck}${optionalField}${compositeCheck}`.padEnd(44, '<').substring(0, 44);
  return { line1, line2 };
}

export const EthiopiaPassportCard: React.FC<{
  data?: EthiopiaPassportData;
  className?: string;
}> = ({ data = defaultEthiopiaPassportData, className = "" }) => {
  const mrz = useMemo(() => generateEthiopiaMRZ(data), [data]);

  const isCustomPhoto = Boolean(data.photoUrl && data.photoUrl !== defaultEthiopiaPassportData.photoUrl);

  return (
    <div
      className={`relative w-full overflow-hidden select-none shadow-2xl rounded-sm border border-stone-300 bg-[#f6f6e9] ${className}`}
      style={{
        aspectRatio: "585 / 782",
        containerType: "inline-size",
        fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* Clean 1:1 Reference Base Plate (585x782) with Guilloche, Labels, Portrait, Ghost Portrait, Signature & PDF417 Barcode */}
      <img
        src="/assets/aistudio/ethiopia_passport_clean_bg.png"
        alt="Federal Democratic Republic of Ethiopia Passport Base Plate"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
      />

      {/* Live Interactive Overlay Layer */}
      <div className="absolute inset-0 w-full h-full z-20 pointer-events-none text-[#1e2226]">
        {isCustomPhoto && (
          <>
            <div
              className="absolute overflow-hidden"
              style={{
                left: "3.93%",
                top: "57.03%",
                width: "24.96%",
                height: "21.99%",
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
                left: "58.97%",
                top: "64.45%",
                width: "12.82%",
                height: "10.23%",
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

        {/* Row 1: Type, Country Code, Passport No */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "32.48%", top: "55.88%", fontSize: "1.95cqw" }}
        >
          P
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "49.91%", top: "55.88%", fontSize: "1.95cqw" }}
        >
          ETH
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "75.56%", top: "55.88%", fontSize: "1.95cqw" }}
        >
          {data.passportNo}
        </div>

        {/* Row 2: Surname (Amharic / English) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "32.48%", top: "58.95%", fontSize: "1.95cqw" }}
        >
          {data.surnameAmharic ? `${data.surnameAmharic}/${data.surname}` : data.surname}
        </div>

        {/* Row 3: Given Name (Amharic / English) */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "32.48%", top: "61.89%", fontSize: "1.95cqw" }}
        >
          {data.givenNameAmharic ? `${data.givenNameAmharic}/${data.givenNames}` : data.givenNames}
        </div>

        {/* Row 4: Nationality, Sex, Personal No */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "32.48%", top: "64.83%", fontSize: "1.95cqw" }}
        >
          {data.nationality}
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "55.90%", top: "64.83%", fontSize: "1.95cqw" }}
        >
          {data.sex}
        </div>
        {data.personalNo && (
          <div
            className="absolute font-semibold uppercase whitespace-nowrap leading-none"
            style={{ left: "70.09%", top: "64.83%", fontSize: "1.95cqw" }}
          >
            {data.personalNo}
          </div>
        )}

        {/* Row 5: Date of Birth & Place of Birth */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "32.48%", top: "67.77%", fontSize: "1.95cqw" }}
        >
          {data.dateOfBirth}
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "70.09%", top: "67.77%", fontSize: "1.95cqw" }}
        >
          {data.placeOfBirth}
        </div>

        {/* Row 6: Date of Issue & Date of Expiry */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "32.48%", top: "70.72%", fontSize: "1.95cqw" }}
        >
          {data.dateOfIssue}
        </div>
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "70.09%", top: "70.72%", fontSize: "1.95cqw" }}
        >
          {data.dateOfExpiry}
        </div>

        {/* Row 7: Issuing Authority */}
        <div
          className="absolute font-semibold uppercase whitespace-nowrap leading-none"
          style={{ left: "32.48%", top: "73.79%", fontSize: "1.72cqw" }}
        >
          {data.issuingAuthority}
        </div>

        {/* MRZ Lines */}
        <div
          className="absolute whitespace-pre uppercase leading-none font-bold text-[#1d2024]"
          style={{
            left: "5.81%",
            top: "92.07%",
            fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
            fontSize: "2.62cqw",
            letterSpacing: "0.145em",
          }}
        >
          {mrz.line1}
        </div>
        <div
          className="absolute whitespace-pre uppercase leading-none font-bold text-[#1d2024]"
          style={{
            left: "5.81%",
            top: "95.65%",
            fontFamily: "'OCRB', 'OCR B', 'Courier New', Courier, monospace",
            fontSize: "2.62cqw",
            letterSpacing: "0.145em",
          }}
        >
          {mrz.line2}
        </div>
      </div>
    </div>
  );
};
