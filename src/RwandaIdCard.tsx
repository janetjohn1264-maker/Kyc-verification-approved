import React from "react"

export interface RwandaIdData {
  idNumber: string
  surname: string
  givenNames: string
  dateOfBirth: string
  sex: "Gabo / M" | "Gore / F"
  placeOfIssue: string
  signatureText?: string
  issueNumber?: string
  photoUrl?: string
  cardSide?: "front" | "back" | "both"
}

export const defaultRwandaIdData: RwandaIdData = {
  idNumber: "1 1998 8 0014393 0 17",
  surname: "HITAYEZU",
  givenNames: "Jean Claude",
  dateOfBirth: "01/01/1998",
  sex: "Gabo / M",
  placeOfIssue: "Gakenke / Gashenyi",
  signatureText: "Hitayezu J.C.",
  issueNumber: "0164",
  photoUrl: "/assets/aistudio/rwanda_id_portrait.png",
  cardSide: "front",
}

export const rwandaRandomSpecimens: RwandaIdData[] = [
  defaultRwandaIdData,
  {
    idNumber: "2 1995 7 0048291 0 24",
    surname: "UWASE",
    givenNames: "Marie Claire",
    dateOfBirth: "14/05/1995",
    sex: "Gore / F",
    placeOfIssue: "Nyarugenge / Kigali",
    signatureText: "M.C. Uwase",
    issueNumber: "0287",
    photoUrl: "/assets/aistudio/rwanda_id_portrait.png",
    cardSide: "front",
  },
  {
    idNumber: "1 1992 8 0039184 0 12",
    surname: "MUGISHA",
    givenNames: "Emmanuel",
    dateOfBirth: "22/11/1992",
    sex: "Gabo / M",
    placeOfIssue: "Musanze / Muhoza",
    signatureText: "E. Mugisha",
    issueNumber: "0412",
    photoUrl: "/assets/aistudio/rwanda_id_portrait.png",
    cardSide: "front",
  },
  {
    idNumber: "2 1999 7 0021945 0 08",
    surname: "INGABIRE",
    givenNames: "Nadine",
    dateOfBirth: "08/09/1999",
    sex: "Gore / F",
    placeOfIssue: "Huye / Ngoma",
    signatureText: "N. Ingabire",
    issueNumber: "0195",
    photoUrl: "/assets/aistudio/rwanda_id_portrait.png",
    cardSide: "front",
  },
]

interface RwandaIdCardProps {
  data: RwandaIdData
  onSideChange?: (side: "front" | "back" | "both") => void
}

export const RwandaIdCard: React.FC<RwandaIdCardProps> = ({ data, onSideChange }) => {
  const currentSide = data.cardSide || "front"

  // Check if current data exactly matches the default specimen
  const isDefaultSpecimen =
    data.idNumber.trim() === defaultRwandaIdData.idNumber &&
    data.surname.trim().toUpperCase() === defaultRwandaIdData.surname &&
    data.givenNames.trim() === defaultRwandaIdData.givenNames &&
    data.dateOfBirth.trim() === defaultRwandaIdData.dateOfBirth &&
    data.sex === defaultRwandaIdData.sex &&
    data.placeOfIssue.trim() === defaultRwandaIdData.placeOfIssue &&
    (!data.photoUrl || data.photoUrl === defaultRwandaIdData.photoUrl)

  const isCustomPhoto = Boolean(data.photoUrl && data.photoUrl !== defaultRwandaIdData.photoUrl)

  const fitCqw = (text: string, baseCqw: number, maxChars: number, minCqw = baseCqw * 0.58) => {
    const len = (text || "").trim().length
    if (len <= maxChars) return `${baseCqw}cqw`
    return `${Math.max(minCqw, +(baseCqw * (maxChars / len)).toFixed(2))}cqw`
  }

  const fullNameText = `${data.surname} ${data.givenNames}`.trim()
  const sigDisplay = data.signatureText || `${data.surname} ${data.givenNames.slice(0, 1)}.`

  const renderFrontCard = () => (
    <div
      id="rwanda-id-front"
      className="relative w-full mx-auto select-none overflow-hidden rounded-[12px] shadow-[0_12px_32px_rgba(15,23,42,0.18)] border border-slate-200/80 bg-[#f7faf8]"
      style={{
        aspectRatio: "688 / 434",
        containerType: "inline-size",
        fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* Base Plate: authentic reference when unmodified, or clean in-painted plate for live edits */}
      <img
        src={
          isDefaultSpecimen
            ? "/assets/aistudio/rwanda_id_front_reference.png"
            : "/assets/aistudio/rwanda_id_clean_front_bg.png"
        }
        alt="Rwanda National ID Card Front - Indangamuntu"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        draggable={false}
      />

      {/* When custom photo is provided, overlay it inside the oval halo */}
      {isCustomPhoto && (
        <div
          className="absolute overflow-hidden pointer-events-none"
          style={{
            left: "8.8%",
            top: "19.2%",
            width: "32.2%",
            height: "60.8%",
            borderRadius: "50%",
            boxShadow: "0 0 10px rgba(254, 252, 232, 0.8), inset 0 0 6px rgba(0, 0, 0, 0.15)",
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

      {/* Dynamic text overlays (shown when customized or actively edited) */}
      {!isDefaultSpecimen && (
        <>
          {/* Bearer Full Name: Amazina / Names */}
          <div
            className="absolute flex items-center pointer-events-none select-none overflow-hidden"
            style={{
              left: "40.2%",
              top: "43.2%",
              width: "52.0%",
              height: "6.2%",
            }}
          >
            <span
              className="font-bold text-[#080808] whitespace-nowrap tracking-[0.015em] overflow-hidden text-ellipsis max-w-full"
              style={{
                fontSize: fitCqw(fullNameText, 2.75, 24),
                lineHeight: 1,
              }}
            >
              <strong className="uppercase">{data.surname}</strong> {data.givenNames}
            </span>
          </div>

          {/* Date of Birth: Itariki yavutseho / Date of Birth */}
          <div
            className="absolute flex items-center pointer-events-none select-none overflow-hidden"
            style={{
              left: "40.2%",
              top: "56.5%",
              width: "35.0%",
              height: "6.0%",
            }}
          >
            <span
              className="font-bold text-[#080808] whitespace-nowrap tracking-[0.02em] overflow-hidden max-w-full"
              style={{
                fontSize: fitCqw(data.dateOfBirth, 2.75, 16),
                lineHeight: 1,
              }}
            >
              {data.dateOfBirth}
            </span>
          </div>

          {/* Sex: Igitsina / Sex */}
          <div
            className="absolute flex items-center pointer-events-none select-none overflow-hidden"
            style={{
              left: "40.2%",
              top: "69.5%",
              width: "15.5%",
              height: "6.0%",
            }}
          >
            <span
              className="font-bold text-[#080808] whitespace-nowrap overflow-hidden max-w-full"
              style={{
                fontSize: fitCqw(data.sex, 2.65, 10),
                lineHeight: 1,
              }}
            >
              {data.sex}
            </span>
          </div>

          {/* Place of Issue: Aho Yatangiwe / Place of Issue */}
          <div
            className="absolute flex items-center pointer-events-none select-none overflow-hidden"
            style={{
              left: "57.6%",
              top: "69.5%",
              width: "24.5%",
              height: "6.0%",
            }}
          >
            <span
              className="font-bold text-[#080808] whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
              style={{
                fontSize: fitCqw(data.placeOfIssue, 2.65, 18),
                lineHeight: 1,
              }}
            >
              {data.placeOfIssue}
            </span>
          </div>

          {/* Signature script */}
          <div
            className="absolute flex items-center pointer-events-none select-none overflow-hidden"
            style={{
              left: "40.2%",
              top: "79.0%",
              width: "38.0%",
              height: "6.5%",
            }}
          >
            <span
              className="text-[#101010] whitespace-nowrap opacity-90 overflow-hidden text-ellipsis max-w-full"
              style={{
                fontFamily: "'Brush Script MT', 'Snell Roundhand', 'Segoe Script', cursive",
                fontSize: fitCqw(sigDisplay, 3.6, 18),
                fontWeight: 600,
                transform: "rotate(-2deg)",
              }}
            >
              {sigDisplay}
            </span>
          </div>

          {/* Ghost Portrait in bottom-right corner */}
          <div
            className="absolute overflow-hidden pointer-events-none rounded-[2px]"
            style={{
              left: "83.0%",
              top: "73.2%",
              width: "9.8%",
              height: "22.2%",
              opacity: 0.65,
              filter: "contrast(1.1) brightness(0.95)",
            }}
          >
            <img
              src={data.photoUrl || defaultRwandaIdData.photoUrl}
              alt="Bearer ghost portrait"
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>

          {/* Bottom National ID Number: Indangamuntu / National ID No. */}
          <div
            className="absolute flex items-center pointer-events-none select-none overflow-hidden"
            style={{
              left: "44.8%",
              top: "91.2%",
              width: "37.5%",
              height: "6.5%",
            }}
          >
            <span
              className="font-bold text-[#050505] whitespace-nowrap tracking-[0.08em] overflow-hidden max-w-full"
              style={{
                fontSize: fitCqw(data.idNumber, 3.25, 22),
                letterSpacing: "0.06em",
              }}
            >
              {data.idNumber}
            </span>
          </div>
        </>
      )}
    </div>
  )

  const renderBackCard = () => (
    <div
      id="rwanda-id-back"
      className="relative w-full mx-auto select-none overflow-hidden rounded-[12px] shadow-[0_12px_32px_rgba(15,23,42,0.18)] border border-slate-200/80 bg-[#f7faf8]"
      style={{
        aspectRatio: "688 / 434",
        containerType: "inline-size",
        fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* Base Back Reference Card */}
      <img
        src="/assets/aistudio/rwanda_id_back_reference.png"
        alt="Rwanda National ID Card Back - Indangamuntu"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        draggable={false}
      />

      {/* Back Ghost portrait (updates when custom photo provided) */}
      {isCustomPhoto && (
        <div
          className="absolute overflow-hidden pointer-events-none rounded-[2px]"
          style={{
            left: "82.5%",
            top: "41.0%",
            width: "9.8%",
            height: "21.5%",
            opacity: 0.85,
            filter: "contrast(1.08) brightness(0.98)",
          }}
        >
          <img
            src={data.photoUrl}
            alt="Back ghost portrait"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      )}

      {/* Vertical Issue Number beside Barcode */}
      {data.issueNumber && data.issueNumber !== "0164" && (
        <div
          className="absolute flex items-center justify-center pointer-events-none select-none"
          style={{
            left: "1.8%",
            top: "61.5%",
            width: "3.5%",
            height: "31.0%",
            backgroundColor: "#edf6f3",
          }}
        >
          <span
            className="font-mono font-bold text-[#1a2333] tracking-[0.18em]"
            style={{
              writingMode: "vertical-lr",
              transform: "rotate(180deg)",
              fontSize: "2.4cqw",
            }}
          >
            {data.issueNumber}
          </span>
        </div>
      )}
    </div>
  )

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Card Side Switcher (Front / Back / Both) */}
      <div className="flex items-center justify-center p-1 bg-slate-100 rounded-lg border border-slate-200 shadow-xs text-xs font-semibold">
        <button
          type="button"
          onClick={() => onSideChange?.("front")}
          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
            currentSide === "front"
              ? "bg-white text-emerald-700 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Front Side
        </button>
        <button
          type="button"
          onClick={() => onSideChange?.("back")}
          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
            currentSide === "back"
              ? "bg-white text-emerald-700 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Back Side
        </button>
        <button
          type="button"
          onClick={() => onSideChange?.("both")}
          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
            currentSide === "both"
              ? "bg-white text-emerald-700 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Both Sides
        </button>
      </div>

      {/* Render selected view */}
      {currentSide === "front" && renderFrontCard()}
      {currentSide === "back" && renderBackCard()}
      {currentSide === "both" && (
        <div className="w-full flex flex-col gap-4">
          <div className="w-full">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left px-1">
              Front Side (Indangamuntu)
            </div>
            {renderFrontCard()}
          </div>
          <div className="w-full">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left px-1">
              Back Side (Inyuma)
            </div>
            {renderBackCard()}
          </div>
        </div>
      )}
    </div>
  )
}
