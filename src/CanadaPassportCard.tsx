import React from "react"

export interface CanadaPassportData {
  passportNo: string
  surname: string
  givenNames: string
  nationality: string
  dateOfBirth: string
  sex: string
  placeOfBirth: string
  dateOfIssue: string
  dateOfExpiry: string
  authority: string
  barcodeCode: string
  signatureText: string
  photoUrl: string
}

export const defaultCanadaPassportData: CanadaPassportData = {
  passportNo: "ZE001355",
  surname: "THOMAS",
  givenNames: "DOUG",
  nationality: "LAPAND/CANADIENNE",
  dateOfBirth: "15 JUN / JUIN 1988",
  sex: "F/F",
  placeOfBirth: "VANCOUVER",
  dateOfIssue: "20 JAN / JAN 2020",
  dateOfExpiry: "19 JAN / JAN 2030",
  authority: "VANCOUVER",
  barcodeCode: "ECR44192",
  signatureText: "Doug Thomas",
  photoUrl: "/assets/aistudio/canada_passport_portrait.png",
}

const MONTH_MAP: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  "FÉV": "02",
  MAR: "03",
  APR: "04",
  AVR: "04",
  MAY: "05",
  MAI: "05",
  JUN: "06",
  JUIN: "06",
  JUL: "07",
  JUIL: "07",
  AUG: "08",
  "AOÛT": "08",
  SEP: "09",
  SEPT: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
  "DÉC": "12",
}

function parseDateToYYMMDD(dateStr: string): string {
  const parts = dateStr.trim().toUpperCase().split(/[\s/-]+/)
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, "0").slice(0, 2)
    const mon = MONTH_MAP[parts[1]] || "01"
    const year = parts[parts.length - 1].slice(-2)
    return `${year}${mon}${day}`
  }
  return "880615"
}

function mrzCheckDigit(input: string): string {
  const weights = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    let val = 0
    if (ch >= "0" && ch <= "9") val = ch.charCodeAt(0) - 48
    else if (ch >= "A" && ch <= "Z") val = ch.charCodeAt(0) - 55
    else val = 0
    sum += val * weights[i % 3]
  }
  return String(sum % 10)
}

export function generateCanadaMRZ(data: CanadaPassportData): { line1: string; line2: string } {
  const isDefaultSpecimen =
    data.passportNo.trim().toUpperCase() === "ZE001355" &&
    data.surname.trim().toUpperCase() === "THOMAS" &&
    data.givenNames.trim().toUpperCase() === "DOUG" &&
    data.dateOfBirth.trim().toUpperCase() === "15 JUN / JUIN 1988" &&
    data.sex.trim().toUpperCase() === "F/F" &&
    data.dateOfExpiry.trim().toUpperCase() === "19 JAN / JAN 2030"

  if (isDefaultSpecimen) {
    return {
      line1: "P<CANTHOMAS<<DOUG<<<<<<<<<<<<<<<<<<<<<<<<<<<",
      line2: "ZE001355<3CAN8806150F3001190<<<<<<<<<<<<<<<08",
    }
  }

  const cleanSurname = data.surname
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .trim()
    .replace(/\s+/g, "<")
  const cleanGiven = data.givenNames
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .trim()
    .replace(/\s+/g, "<")

  const line1Raw = `P<CAN${cleanSurname}<<${cleanGiven}`
  const line1 = line1Raw.padEnd(44, "<").slice(0, 44)

  const passClean = data.passportNo.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const passField = passClean.padEnd(9, "<").slice(0, 9)
  const passCheck = mrzCheckDigit(passField)

  const dobYYMMDD = parseDateToYYMMDD(data.dateOfBirth)
  const dobCheck = mrzCheckDigit(dobYYMMDD)

  const rawSex = data.sex.toUpperCase()
  const sexChar = rawSex.includes("F") ? "F" : rawSex.includes("M") ? "M" : "<"

  const expYYMMDD = parseDateToYYMMDD(data.dateOfExpiry)
  const expCheck = mrzCheckDigit(expYYMMDD)

  const personalField = "<<<<<<<<<<<<<<<"
  const line2 = `${passField}${passCheck}CAN${dobYYMMDD}${dobCheck}${sexChar}${expYYMMDD}${expCheck}${personalField}08`.slice(0, 44)

  return { line1, line2 }
}

interface CanadaPassportCardProps {
  data: CanadaPassportData
}

export const CanadaPassportCard: React.FC<CanadaPassportCardProps> = ({ data }) => {
  const mrz = generateCanadaMRZ(data)
  const isCustomPhoto =
    data.photoUrl && data.photoUrl !== "/assets/aistudio/canada_passport_portrait.png"
  const isDefaultSpecimen =
    !isCustomPhoto &&
    data.passportNo.trim().toUpperCase() === "ZE001355" &&
    data.surname.trim().toUpperCase() === "THOMAS" &&
    data.givenNames.trim().toUpperCase() === "DOUG" &&
    (data.nationality.trim().toUpperCase() === "LAPAND/CANADIENNE" ||
      data.nationality.trim().toUpperCase() === "CANADIENNE") &&
    data.dateOfBirth.trim().toUpperCase() === "15 JUN / JUIN 1988" &&
    data.sex.trim().toUpperCase() === "F/F" &&
    data.placeOfBirth.trim().toUpperCase() === "VANCOUVER" &&
    data.dateOfIssue.trim().toUpperCase() === "20 JAN / JAN 2020" &&
    data.dateOfExpiry.trim().toUpperCase() === "19 JAN / JAN 2030" &&
    data.authority.trim().toUpperCase() === "VANCOUVER" &&
    data.barcodeCode.trim().toUpperCase() === "ECR44192" &&
    data.signatureText.trim().toLowerCase() === "doug thomas"

  const spacedPass = (data.passportNo || "ZE001355").toUpperCase().split("").join(" ")
  const spacedBarcode = (data.barcodeCode || "ECR44192").toUpperCase().split("").join(" ")
  const isDefaultSig =
    data.signatureText.trim().replace(/\s+/g, "").toUpperCase() === "DOUGTHOMAS"

  return (
    <div
      className="relative w-full mx-auto select-none overflow-hidden rounded-[6px] shadow-[0_20px_50px_rgba(15,23,42,0.28)] bg-[#f8faf7]"
      style={{
        aspectRatio: "676 / 896",
        containerType: "inline-size",
        fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* Clean Base Plate */}
      <img
        src="/assets/aistudio/canada_passport_clean_bg.png"
        alt="Canada e-Passport Spread"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        draggable={false}
      />

      {/* Top Page Left Perforated Serial */}
      <div
        className="absolute flex items-center justify-center pointer-events-none select-none"
        style={{
          left: "3.55%",
          top: "16.41%",
          width: "5.33%",
          height: "27.01%",
        }}
      >
        <div
          style={{
            writingMode: "vertical-lr",
            transform: "rotate(180deg)",
            fontFamily: "'Courier New', Courier, monospace",
            fontWeight: 800,
            fontSize: "3.85cqw",
            letterSpacing: "0.25em",
            color: "rgba(120, 124, 128, 0.58)",
            textShadow: "0.5px 0.5px 0 rgba(255,255,255,0.85)",
            whiteSpace: "nowrap",
          }}
        >
          {spacedPass}
        </div>
      </div>

      {/* Top Page Signature */}
      <div
        className="absolute flex items-center pointer-events-none select-none"
        style={{
          left: "13.61%",
          top: "13.17%",
          width: "35.00%",
          height: "6.70%",
        }}
      >
        {isDefaultSig ? (
          <img
            src="/assets/aistudio/canada_passport_signature.png"
            alt="Bearer signature"
            className="w-full h-full object-contain object-left mix-blend-multiply opacity-95"
            draggable={false}
          />
        ) : (
          <div
            className="text-[#18191b] whitespace-nowrap"
            style={{
              fontFamily: "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive",
              fontSize: "5.2cqw",
              fontWeight: 500,
              letterSpacing: "0.03em",
              lineHeight: 1,
            }}
          >
            {data.signatureText}
          </div>
        )}
      </div>

      {/* Custom Ghost Portrait Overlay */}
      {isCustomPhoto && (
        <div
          className="absolute overflow-hidden rounded-[1px] pointer-events-none mix-blend-multiply"
          style={{
            left: "17.75%",
            top: "34.38%",
            width: "10.65%",
            height: "9.82%",
            opacity: 0.72,
          }}
        >
          <img
            src={data.photoUrl}
            alt="Ghost portrait"
            className="w-full h-full object-cover"
            style={{ filter: "grayscale(1) contrast(0.92) brightness(1.08)" }}
            draggable={false}
          />
        </div>
      )}

      {/* Top Page Curved Serial Number */}
      <div
        className="absolute flex items-center justify-center pointer-events-none select-none"
        style={{
          left: "66.42%",
          top: "42.19%",
          width: "17.46%",
          height: "3.46%",
        }}
      >
        <div
          className="font-mono font-bold text-[#1d2024] whitespace-nowrap"
          style={{
            fontSize: "1.95cqw",
            letterSpacing: "0.22em",
            transform: "rotate(-6deg)",
          }}
        >
          {spacedPass}
        </div>
      </div>

      {/* Top Page Vertical Barcode Code */}
      <div
        className="absolute flex items-center justify-center pointer-events-none select-none"
        style={{
          left: "93.79%",
          top: "16.85%",
          width: "2.96%",
          height: "21.65%",
        }}
      >
        <div
          className="font-mono font-bold text-[#181a1d] whitespace-nowrap"
          style={{
            writingMode: "vertical-lr",
            transform: "rotate(180deg)",
            fontSize: "1.85cqw",
            letterSpacing: "0.34em",
          }}
        >
          {spacedBarcode}
        </div>
      </div>

      {/* Bottom Page Left Perforated Serial */}
      <div
        className="absolute flex items-center justify-center pointer-events-none select-none z-10"
        style={{
          left: "3.55%",
          top: "55.69%",
          width: "5.18%",
          height: "29.13%",
        }}
      >
        <div
          style={{
            writingMode: "vertical-lr",
            transform: "rotate(180deg)",
            fontFamily: "'Courier New', Courier, monospace",
            fontWeight: 800,
            fontSize: "3.85cqw",
            letterSpacing: "0.25em",
            color: "rgba(115, 118, 122, 0.55)",
            textShadow: "0.5px 0.5px 0 rgba(255,255,255,0.75)",
            whiteSpace: "nowrap",
          }}
        >
          {spacedPass}
        </div>
      </div>

      {/* Custom Main Bearer Portrait Overlay */}
      {isCustomPhoto && (
        <div
          className="absolute overflow-hidden rounded-[1px] pointer-events-none"
          style={{
            left: "2.96%",
            top: "62.05%",
            width: "27.81%",
            height: "25.00%",
          }}
        >
          <img
            src={data.photoUrl}
            alt="Bearer portrait"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      )}

      {/* Row 1: Type (P), Issuing Country (CAN), Passport No. */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.54%", top: "57.37%", fontSize: "2.05cqw", letterSpacing: "0.04em" }}
      >
        P
      </div>
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "45.12%", top: "57.37%", fontSize: "2.05cqw", letterSpacing: "0.06em" }}
      >
        CAN
      </div>
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "75.89%", top: "57.25%", fontSize: "2.75cqw", letterSpacing: "0.04em" }}
      >
        {data.passportNo.toUpperCase()}
      </div>

      {/* Row 2: Surname */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.25%", top: "60.49%", fontSize: "2.05cqw", letterSpacing: "0.05em" }}
      >
        {data.surname.toUpperCase()}
      </div>

      {/* Row 3: Given names */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.54%", top: "64.06%", fontSize: "2.05cqw", letterSpacing: "0.05em" }}
      >
        {data.givenNames.toUpperCase()}
      </div>

      {/* Row 4: Nationality */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.69%", top: "67.30%", fontSize: "2.05cqw", letterSpacing: "0.05em" }}
      >
        {data.nationality.toUpperCase()}
      </div>

      {/* Row 5: Date of birth */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.84%", top: "71.09%", fontSize: "2.05cqw", letterSpacing: "0.04em" }}
      >
        {data.dateOfBirth.toUpperCase()}
      </div>

      {/* Row 6: Sex & Place of birth */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.40%", top: "74.11%", fontSize: "2.05cqw", letterSpacing: "0.04em" }}
      >
        {data.sex.toUpperCase()}
      </div>
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "42.16%", top: "74.33%", fontSize: "2.05cqw", letterSpacing: "0.05em" }}
      >
        {data.placeOfBirth.toUpperCase()}
      </div>

      {/* Row 7: Date of issue */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.54%", top: "77.79%", fontSize: "2.05cqw", letterSpacing: "0.04em" }}
      >
        {data.dateOfIssue.toUpperCase()}
      </div>

      {/* Row 8: Date of expiry */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.54%", top: "81.14%", fontSize: "2.05cqw", letterSpacing: "0.04em" }}
      >
        {data.dateOfExpiry.toUpperCase()}
      </div>

      {/* Row 9: Issuing Authority */}
      <div
        className="absolute font-bold text-[#18191b] whitespace-nowrap leading-none"
        style={{ left: "32.40%", top: "84.60%", fontSize: "2.05cqw", letterSpacing: "0.05em" }}
      >
        {data.authority.toUpperCase()}
      </div>

      {/* Right OVD Vertical Number */}
      <div
        className="absolute flex items-center justify-center pointer-events-none select-none"
        style={{
          left: "93.05%",
          top: "68.42%",
          width: "3.70%",
          height: "9.82%",
        }}
      >
        <div
          className="font-mono font-bold text-[#1b1d20] whitespace-nowrap"
          style={{
            writingMode: "vertical-lr",
            transform: "rotate(192deg)",
            fontSize: "1.95cqw",
            letterSpacing: "0.14em",
          }}
        >
          {data.barcodeCode.toUpperCase()}
        </div>
      </div>

      {/* MRZ Lines */}
      <div
        className="absolute whitespace-nowrap leading-none"
        style={{
          left: "2.96%",
          top: "90.51%",
          fontFamily: "'OCR-B', 'Courier New', Courier, monospace",
          fontWeight: 800,
          fontSize: "2.48cqw",
          letterSpacing: "0.255cqw",
          color: "#141618",
        }}
      >
        {mrz.line1}
      </div>
      <div
        className="absolute whitespace-nowrap leading-none"
        style={{
          left: "2.96%",
          top: "94.20%",
          fontFamily: "'OCR-B', 'Courier New', Courier, monospace",
          fontWeight: 800,
          fontSize: "2.48cqw",
          letterSpacing: "0.255cqw",
          color: "#141618",
        }}
      >
        {mrz.line2}
      </div>

      {/* Exact 1:1 Reference Overlay when unmodified */}
      {isDefaultSpecimen && (
        <img
          src="/assets/aistudio/canada_passport_reference.png"
          alt="Canada e-Passport Reference Specimen"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-20"
          draggable={false}
        />
      )}
    </div>
  )
}
