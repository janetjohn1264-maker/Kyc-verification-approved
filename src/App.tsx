/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useRef } from "react"
import { CheckCircle2, ChevronDown, FileText, LayoutDashboard, LogOut, Menu, RefreshCw, RotateCcw, Save, Settings, ShieldCheck, Upload, UserRound, X } from "lucide-react"
import { BangladeshPassportCard, BangladeshPassportData, defaultBangladeshPassportData, generateBangladeshMRZ } from "./BangladeshPassportCard"
import { GhanaPassportCard, GhanaPassportData, defaultGhanaPassportData, generateGhanaMRZ } from "./GhanaPassportCard"

const defaultContent = {
  title: "Ghana Passport Verification",
  subtitle: "Securely verify identity documents in a few simple steps.",
  button: "Start verification",
  accent: "#b45309", // Ghana warm gold/amber accent
}

const ghanaRandomSpecimens: GhanaPassportData[] = [
  defaultGhanaPassportData,
  {
    passportNo: "G3948215",
    surname: "MENSAH",
    givenNames: "KWAME KOFI",
    nationality: "GHANAIAN",
    dateOfBirth: "14 AUG 1995",
    sex: "M",
    placeOfBirth: "KUMASI",
    dateOfIssue: "10 MAR 2021",
    placeOfIssue: "ACCRA",
    dateOfExpiry: "09 MAR 2031",
    authority: "PASSPORT OFFICE",
    photoUrl: "/assets/aistudio/ghana_passport_portrait.png",
  },
  {
    passportNo: "G5182940",
    surname: "ASANTE",
    givenNames: "ABENA SERWAA",
    nationality: "GHANAIAN",
    dateOfBirth: "22 NOV 1998",
    sex: "F",
    placeOfBirth: "ACCRA",
    dateOfIssue: "18 JUL 2022",
    placeOfIssue: "ACCRA",
    dateOfExpiry: "17 JUL 2032",
    authority: "PASSPORT OFFICE",
    photoUrl: "/assets/aistudio/ghana_passport_portrait.png",
  },
]

const bangladeshRandomSpecimens: BangladeshPassportData[] = [
  {
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
  },
  {
    passportNo: "B09184521",
    surname: "RAHMAN",
    givenNames: "TARIQUL",
    nationality: "BANGLADESHI",
    personalNo: "8201948271",
    dateOfBirth: "14 AUG 1992",
    previousPassportNo: "BE0192834",
    sex: "M",
    placeOfBirth: "CHITTAGONG",
    dateOfIssue: "12 APR 2022",
    issuingAuthority: "DIP/CHITTAGONG",
    dateOfExpiry: "11 APR 2032",
    bookletSerial: "419082",
    fatherName: "ABDUL RAHMAN",
    motherName: "FATEMA KHATUN",
    spouseName: "NUSRAT JAHAN",
    permanentAddress1: "VILL: NASIRABAD, PO: CHITTAGONG,",
    permanentAddress2: "PANCHLAISH - 4000, CHITTAGONG",
    emergencyName: "NUSRAT JAHAN",
    emergencyRelationship: "SPOUSE",
    emergencyAddress1: "VILL: NASIRABAD, PO: CHITTAGONG, PANCHLAISH",
    emergencyAddress2: "- 4000, CHITTAGONG",
    emergencyPhone: "+8801712984512",
    photoUrl: "/assets/aistudio/bgd_passport_portrait.png",
  },
  {
    passportNo: "A15839204",
    surname: "KHATUN",
    givenNames: "NUSRAT JAHAN",
    nationality: "BANGLADESHI",
    personalNo: "9102837465",
    dateOfBirth: "05 OCT 1995",
    previousPassportNo: "BK0847291",
    sex: "F",
    placeOfBirth: "SYLHET",
    dateOfIssue: "20 SEP 2023",
    issuingAuthority: "DIP/SYLHET",
    dateOfExpiry: "19 SEP 2033",
    bookletSerial: "632019",
    fatherName: "KABIR AHMED",
    motherName: "SALMA BEGUM",
    spouseName: "",
    permanentAddress1: "HOUSE # 12, ROAD # 4, SHAHJALAL UPASHAHAR,",
    permanentAddress2: "SYLHET - 3100, SYLHET",
    emergencyName: "KABIR AHMED",
    emergencyRelationship: "FATHER",
    emergencyAddress1: "HOUSE # 12, ROAD # 4, SHAHJALAL UPASHAHAR",
    emergencyAddress2: "SYLHET - 3100, SYLHET",
    emergencyPhone: "+8801819234857",
    photoUrl: "/assets/aistudio/bgd_passport_portrait.png",
  }
]

function App() {
  const [content, setContent] = useState(defaultContent)
  const [saved, setSaved] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [detectedText, setDetectedText] = useState<string[] | null>(null)
  const [country, setCountry] = useState("GHA")
  const [ghanaData, setGhanaData] = useState<GhanaPassportData>(defaultGhanaPassportData)
  const [bangladeshData, setBangladeshData] = useState<BangladeshPassportData>(defaultBangladeshPassportData)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const update = (key: keyof typeof defaultContent, value: string) => {
    setDetectedText(null)
    setSaved(false)
    setContent((current) => ({ ...current, [key]: value }))
  }

  const updateGhana = <K extends keyof GhanaPassportData>(key: K, value: GhanaPassportData[K]) => {
    setSaved(false)
    setDetectedText(null)
    setGhanaData((prev) => ({ ...prev, [key]: value }))
  }

  const updateBangladesh = <K extends keyof BangladeshPassportData>(key: K, value: BangladeshPassportData[K]) => {
    setSaved(false)
    setDetectedText(null)
    setBangladeshData((prev) => ({ ...prev, [key]: value }))
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      if (country === "GHA") {
        updateGhana("photoUrl", url)
      } else {
        updateBangladesh("photoUrl", url)
      }
    }
  }

  const previewStyle = useMemo(() => ({ "--accent": content.accent } as React.CSSProperties), [content.accent])
  const isGhana = country === "GHA"
  const isBangladesh = country === "BGD"
  const isSouthAfrica = country === "RSA"
  const isPapuaNewGuinea = country === "PNG"
  const isSenegal = country === "SEN"
  const isKenya = country === "KEN"
  const isUganda = country === "UGA"

  const specimenImage = isGhana
    ? "/assets/aistudio/ghana_passport_reference.png"
    : isBangladesh
    ? "/assets/aistudio/bgd_passport_reference.png"
    : isUganda
    ? "/assets/aistudio/uganda_nid_rectified_ref.png"
    : isKenya
    ? "/assets/aistudio/kenya_passport_reference.jpg"
    : isSenegal
    ? "/assets/aistudio/senegal_cedeao_rectified_ref.png"
    : isSouthAfrica
    ? "/assets/aistudio/south_africa_identity_card_reference.jpeg"
    : isPapuaNewGuinea
    ? "/assets/aistudio/png_national_id_reference.jpg"
    : "/assets/aistudio/drc_passport_reference.jpg"

  const specimenAlt = isGhana
    ? "Republic of Ghana biometric e-Passport reference specimen"
    : isBangladesh
    ? "People's Republic of Bangladesh e-Passport reference specimen"
    : isUganda
    ? "Static Republic of Uganda national identity card reference specimen"
    : isKenya
    ? "Static Republic of Kenya biometric e-Passport reference specimen"
    : isSenegal
    ? "Static Republic of Senegal ECOWAS identity card reference specimen"
    : isSouthAfrica
    ? "Static Republic of South Africa identity card reference specimen"
    : isPapuaNewGuinea
    ? "Static Independent State of Papua New Guinea national identity card reference specimen"
    : "Static Democratic Republic of the Congo passport reference specimen"

  const specimenLabel = isGhana
    ? "Republic of Ghana e-Passport (2-Page Spread) reference specimen"
    : isBangladesh
    ? "Bangladesh e-Passport (2-Page Spread) reference specimen"
    : isUganda
    ? "Uganda National ID Card reference specimen"
    : isKenya
    ? "Kenya e-Passport 2-page reference specimen"
    : isSenegal
    ? "Senegal CEDEAO identity card reference specimen"
    : isSouthAfrica
    ? "South Africa identity card reference specimen"
    : isPapuaNewGuinea
    ? "Papua New Guinea national ID reference specimen"
    : "Passport reference specimen"

  const randomizeSpecimen = () => {
    if (isGhana) {
      const randomIdx = Math.floor(Math.random() * ghanaRandomSpecimens.length)
      const chosen = ghanaRandomSpecimens[randomIdx]
      setGhanaData(chosen)
      const mrz = generateGhanaMRZ(chosen)
      setDetectedText([
        "REPUBLIC OF GHANA / PASSPORT · PASSEPORT",
        `TYPE: P | COUNTRY CODE: GHA | PASSPORT NO: ${chosen.passportNo}`,
        `SURNAME: ${chosen.surname}`,
        `GIVEN NAMES: ${chosen.givenNames}`,
        `NATIONALITY: ${chosen.nationality}`,
        `DATE OF BIRTH: ${chosen.dateOfBirth}`,
        `SEX: ${chosen.sex} | PLACE OF BIRTH: ${chosen.placeOfBirth}`,
        `DATE OF ISSUE: ${chosen.dateOfIssue} | PLACE OF ISSUE: ${chosen.placeOfIssue}`,
        `DATE OF EXPIRY: ${chosen.dateOfExpiry} | AUTHORITY: ${chosen.authority}`,
        `MRZ L1: ${mrz.line1}`,
        `MRZ L2: ${mrz.line2}`,
      ])
    } else if (isBangladesh) {
      const randomIdx = Math.floor(Math.random() * bangladeshRandomSpecimens.length)
      const chosen = bangladeshRandomSpecimens[randomIdx]
      setBangladeshData(chosen)
      const mrz = generateBangladeshMRZ(chosen)
      setDetectedText([
        "গণপ্রজাতন্ত্রী বাংলাদেশ / PEOPLE'S REPUBLIC OF BANGLADESH",
        `PASSPORT NO: ${chosen.passportNo}`,
        `SURNAME: ${chosen.surname}`,
        `GIVEN NAME: ${chosen.givenNames}`,
        `NATIONALITY: ${chosen.nationality}`,
        `PERSONAL NO: ${chosen.personalNo}`,
        `DATE OF BIRTH: ${chosen.dateOfBirth}`,
        `SEX: ${chosen.sex} | PLACE OF BIRTH: ${chosen.placeOfBirth}`,
        `DATE OF ISSUE: ${chosen.dateOfIssue}`,
        `DATE OF EXPIRY: ${chosen.dateOfExpiry}`,
        `MRZ L1: ${mrz.line1}`,
        `MRZ L2: ${mrz.line2}`,
      ])
    } else if (isUganda) {
      setDetectedText(["REPUBLIC OF UGANDA", "NATIONAL ID CARD", "SURNAME: KATO", "GIVEN NAME: CHRISTOPHER MUGANGA", "NATIONALITY: UGA", "SEX: M", "DATE OF BIRTH: 20.05.1965", "NIN: CM650231018R1D", "DATE OF ISSUE: 18.09.2025", "DATE OF EXPIRY: 17.09.2035", "CARD NO: CA050221301"])
    } else if (isKenya) {
      setDetectedText(["REPUBLIC OF KENYA / JAMHURI YA KENYA / REPUBLIQUE DE KENYA", "PASSPORT / PASI / PASSEPORT", "TYPE: P", "COUNTRY CODE: KEN", "PASSPORT NO: BK569259", "SURNAME: RUKU", "GIVEN NAMES: GEORGE MWANGI", "NATIONALITY: KENYAN", "DATE OF BIRTH: 12 JUN 1993", "PERSONAL NO: 3466792", "SEX: M", "PLACE OF BIRTH: THIKA, KEN", "DATE OF ISSUE: 01 MAR 2024", "DATE OF EXPIRY: 28 FEB 2034", "ISSUING AUTHORITY: GOVERNMENT OF KENYA", "PLACE OF RESIDENCE: RUIRU, RUIRU", "HEIGHT: 5'6\" (1.68 m)", "COLOUR OF EYES: BLACK"])
    } else if (isSenegal) {
      setDetectedText(["REPUBLIQUE DU SENEGAL", "CARTE D'IDENTITE CEDEAO", "N° DE LA CARTE D'IDENTITE: 1 02 19910828 00011 3", "PRENOMS: OUSSEYNOU", "NOM: BODIAN", "DATE DE NAISSANCE: 28/08/1991", "SEXE: M", "TAILLE: 190 cm", "LIEU DE NAISSANCE: GUIDEL BAMBADINKA", "DATE DE DELIVRANCE: 16/05/2019", "DATE D'EXPIRATION: 15/05/2029", "CENTRE D'ENREGISTREMENT: COMM. DE PIKINE", "ADRESSE DU DOMOMICILE: GUINAW RAILS"])
    } else if (isPapuaNewGuinea) {
      setDetectedText(["INDEPENDENT STATE OF PAPUA NEW GUINEA", "NATIONAL IDENTITY CARD", "SURNAME: MAREW", "GIVEN NAMES: THEODORE", "DATE OF BIRTH: 10-10-2000", "GENDER: Male", "NID No: 1330003246", "DATE OF ISSUE: 17-02-2021", "DATE OF EXPIRY: 17-02-2031"])
    } else {
      setDetectedText(isSouthAfrica
        ? ["REPUBLIC OF SOUTH AFRICA", "IDENTITY CARD", "SURNAME: MASHEGO", "FORENAMES: REBECCA", "DATE OF BIRTH: 19/03/1984", "ID NUMBER: 930802 0123 08 7", "NATIONALITY: ZAF"]
        : ["REPUBLIC OF DEMOCRATIC CONGO", "PASSPORT / PASSEPORT", "SURNAME: MINAFFET", "GIVEN NAMES: ESTHER NADINE", "NATIONALITY: CONGOLAISE", "DATE OF BIRTH: 02/08/1991", "PASSPORT NO: DEMO-044743"])
    }
    document.getElementById("passport-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const resetGhanaToDefault = () => {
    setGhanaData(defaultGhanaPassportData)
    setDetectedText(null)
  }

  const resetBangladeshToDefault = () => {
    setBangladeshData(defaultBangladeshPassportData)
    setDetectedText(null)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row"><div className="brand-mark"><ShieldCheck size={18} /></div><span>KYC Verify</span><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
        <div className="workspace"><div className="workspace-avatar">JD</div><div><strong>Janet&apos;s workspace</strong><span>Personal workspace</span></div><ChevronDown size={16} /></div>
        <nav aria-label="Main navigation">
          <a href="#dashboard"><LayoutDashboard size={18} /> Dashboard</a>
          <a className="active" href="#passport"><FileText size={18} /> Passport verification</a>
          <a href="#settings"><Settings size={18} /> Settings</a>
        </nav>
        <div className="sidebar-footer"><div className="help-card"><strong>Need help?</strong><span>Visit our support center</span><a href="#support">Get support <span aria-hidden="true">→</span></a></div><button className="logout"><LogOut size={17} /> Log out</button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Passport verification</strong></div><div className="topbar-actions"><span className="status-dot">Live</span><button className="avatar-button" aria-label="Open account menu">JD</button></div></header>
        <div className="page-wrap">
          <section className="page-heading"><div><p className="eyebrow">VERIFICATION FLOW</p><h1>Passport verification</h1><p className="heading-copy">Edit your verification screen and document fields, updated instantly in the live preview.</p></div><div className="heading-actions"><button className="randomize-button" onClick={randomizeSpecimen}><RefreshCw size={15} /> Randomize</button><button className={`save-button ${saved ? "saved" : ""}`} onClick={() => setSaved(true)}><Save size={17} /> {saved ? "Changes saved" : "Save changes"}</button></div></section>

          <div className="editor-layout" id="passport-editor">
            <section className="editor-panel" aria-label="Editor controls">
              <div className="panel-header"><div><h2>Document & Content</h2><p>Customize the screen content and passport fields.</p></div><span className="live-pill"><span /> Live</span></div>
              <div className="form-stack">
                <label>Country / document
                  <select
                    value={country}
                    onChange={(event) => {
                      const newCountry = event.target.value
                      setCountry(newCountry)
                      setDetectedText(null)
                      if (newCountry === "GHA") {
                        setContent((c) => ({ ...c, title: "Ghana Passport Verification", accent: "#b45309" }))
                      } else if (newCountry === "BGD") {
                        setContent((c) => ({ ...c, title: "Bangladesh Passport Verification", accent: "#166534" }))
                      } else if (newCountry === "UGA") {
                        setContent((c) => ({ ...c, title: "Uganda National ID Verification", accent: "#b91c1c" }))
                      } else if (newCountry === "KEN") {
                        setContent((c) => ({ ...c, title: "Kenya Passport Verification", accent: "#15803d" }))
                      } else if (newCountry === "SEN") {
                        setContent((c) => ({ ...c, title: "Senegal ID Card Verification", accent: "#15803d" }))
                      } else if (newCountry === "RSA") {
                        setContent((c) => ({ ...c, title: "South Africa ID Verification", accent: "#0284c7" }))
                      } else if (newCountry === "PNG") {
                        setContent((c) => ({ ...c, title: "Papua New Guinea ID Verification", accent: "#b91c1c" }))
                      } else {
                        setContent((c) => ({ ...c, title: "DR Congo Passport Verification", accent: "#2563eb" }))
                      }
                    }}
                  >
                    <option value="GHA">Republic of Ghana — Biometric e-Passport</option>
                    <option value="BGD">People&apos;s Republic of Bangladesh — Biometric e-Passport</option>
                    <option value="UGA">Republic of Uganda — National ID Card</option>
                    <option value="KEN">Republic of Kenya — Biometric e-Passport</option>
                    <option value="SEN">Republic of Senegal — National Identity Card (CEDEAO)</option>
                    <option value="DRC">Democratic Republic of the Congo — Passport</option>
                    <option value="RSA">Republic of South Africa — Identity card</option>
                    <option value="PNG">Independent State of Papua New Guinea — National ID Card</option>
                  </select>
                </label>
                <label>Screen title<input value={content.title} onChange={(event) => update("title", event.target.value)} /></label>
                <label>Description<textarea rows={2} value={content.subtitle} onChange={(event) => update("subtitle", event.target.value)} /></label>
                <label>Primary button label<input value={content.button} onChange={(event) => update("button", event.target.value)} /></label>
                <label>Accent color<div className="color-input"><input type="color" value={content.accent} onChange={(event) => update("accent", event.target.value)} /><input value={content.accent} onChange={(event) => update("accent", event.target.value)} aria-label="Accent color hex value" /></div></label>
              </div>

              {/* Ghana-specific interactive fields */}
              {isGhana && (
                <div className="mt-6 pt-5 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Passport Data Fields</span>
                    <button
                      type="button"
                      onClick={resetGhanaToDefault}
                      className="text-[11px] flex items-center gap-1 text-slate-500 hover:text-amber-700 font-semibold"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Surname / Nom
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={ghanaData.surname}
                        onChange={(e) => updateGhana("surname", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Given Names / Prénoms
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={ghanaData.givenNames}
                        onChange={(e) => updateGhana("givenNames", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Passport No / No de passeport
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={ghanaData.passportNo}
                        onChange={(e) => updateGhana("passportNo", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Nationality / Nationalité
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ghanaData.nationality}
                        onChange={(e) => updateGhana("nationality", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Birth
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ghanaData.dateOfBirth}
                        onChange={(e) => updateGhana("dateOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Sex / Sexe
                      <select
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ghanaData.sex}
                        onChange={(e) => updateGhana("sex", e.target.value as 'M' | 'F')}
                      >
                        <option value="M">M - Male</option>
                        <option value="F">F - Female</option>
                      </select>
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Place of Birth
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ghanaData.placeOfBirth}
                        onChange={(e) => updateGhana("placeOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Place of Issue
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ghanaData.placeOfIssue}
                        onChange={(e) => updateGhana("placeOfIssue", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Issue
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ghanaData.dateOfIssue}
                        onChange={(e) => updateGhana("dateOfIssue", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Expiry
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ghanaData.dateOfExpiry}
                        onChange={(e) => updateGhana("dateOfExpiry", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                      Authority / Autorité
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ghanaData.authority}
                        onChange={(e) => updateGhana("authority", e.target.value.toUpperCase())}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Bangladesh-specific interactive fields */}
              {isBangladesh && (
                <div className="mt-6 pt-5 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Passport Data Fields</span>
                    <button
                      type="button"
                      onClick={resetBangladeshToDefault}
                      className="text-[11px] flex items-center gap-1 text-slate-500 hover:text-emerald-700 font-semibold"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Passport No
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={bangladeshData.passportNo}
                        onChange={(e) => updateBangladesh("passportNo", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Personal No
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.personalNo}
                        onChange={(e) => updateBangladesh("personalNo", e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Surname
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={bangladeshData.surname}
                        onChange={(e) => updateBangladesh("surname", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Given Name
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={bangladeshData.givenNames}
                        onChange={(e) => updateBangladesh("givenNames", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Birth
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.dateOfBirth}
                        onChange={(e) => updateBangladesh("dateOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Sex
                      <select
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.sex}
                        onChange={(e) => updateBangladesh("sex", e.target.value as 'M' | 'F' | 'X')}
                      >
                        <option value="M">M - Male</option>
                        <option value="F">F - Female</option>
                        <option value="X">X - Unspecified</option>
                      </select>
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Issue
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.dateOfIssue}
                        onChange={(e) => updateBangladesh("dateOfIssue", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Expiry
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.dateOfExpiry}
                        onChange={(e) => updateBangladesh("dateOfExpiry", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Place of Birth
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.placeOfBirth}
                        onChange={(e) => updateBangladesh("placeOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Issuing Authority
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.issuingAuthority}
                        onChange={(e) => updateBangladesh("issuingAuthority", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                      Emergency Contact Name & Phone
                      <div className="flex gap-2">
                        <input
                          className="flex-1 p-2 border rounded border-slate-300 text-xs font-mono"
                          placeholder="Contact Name"
                          value={bangladeshData.emergencyName}
                          onChange={(e) => updateBangladesh("emergencyName", e.target.value.toUpperCase())}
                        />
                        <input
                          className="w-36 p-2 border rounded border-slate-300 text-xs font-mono"
                          placeholder="Phone No"
                          value={bangladeshData.emergencyPhone}
                          onChange={(e) => updateBangladesh("emergencyPhone", e.target.value)}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="upload-section">
                <div className="section-label">Bearer photo / document sample <span>Optional</span></div>
                <div className="upload-box">
                  <div className="upload-icon"><Upload size={17} /></div>
                  <div><strong>Upload custom bearer photo</strong><span>PNG or JPG up to 10 MB</span></div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <button type="button" onClick={() => fileInputRef.current?.click()}>Browse</button>
                </div>
              </div>
              <div className="editor-note"><CheckCircle2 size={17} /><span>Your changes are reflected in the preview automatically.</span></div>
            </section>

            <section className="preview-column">
              <div className="preview-heading"><div><h2>Live preview</h2><p>This is what applicants will see.</p></div><div className="device-toggle"><button className="selected">Desktop</button><button>Mobile</button></div></div>
              <div className="preview-frame">
                <div className="preview-browser"><span /><span /><span /><small>verify.kyc.app/passport</small></div>
                <div className="preview-page" style={previewStyle}>
                  <div className="preview-nav"><div className="preview-logo"><div className="logo-shield"><ShieldCheck size={14} /></div><strong>KYC Verify</strong></div><span>Need help?</span></div>
                  <div className="verification-card">
                    <div className="card-icon"><FileText size={24} /></div>
                    <div className="step-label">STEP 1 OF 3</div>
                    <h3>{content.title}</h3>
                    <p>{content.subtitle}</p>

                    {/* Passport Card View */}
                    <div className="document-placeholder static-passport">
                      {isGhana ? (
                        <div className="w-full max-w-[340px] mx-auto my-1">
                          <GhanaPassportCard data={ghanaData} />
                        </div>
                      ) : isBangladesh ? (
                        <div className="w-full max-w-[340px] mx-auto my-1">
                          <BangladeshPassportCard data={bangladeshData} />
                        </div>
                      ) : (
                        <img className="passport-reference-image" src={specimenImage} alt={specimenAlt} />
                      )}
                      <div className="placeholder-copy">
                        <strong>{specimenLabel}</strong>
                        <span>
                          {isGhana || isBangladesh
                            ? "Authentic 2-page e-Passport spread with live interactive field and MRZ updates."
                            : "This static reference is preserved exactly as provided."}
                        </span>
                      </div>
                    </div>

                    {detectedText && (
                      <section className="detected-text" aria-live="polite">
                        <div className="detected-text-heading"><strong>Detected specimen text</strong><span>OCR preview</span></div>
                        <div className="detected-text-list">{detectedText.map((line) => <span key={line}>{line}</span>)}</div>
                      </section>
                    )}

                    <button className="preview-primary" style={{ backgroundColor: content.accent }}>{content.button}<span aria-hidden="true">→</span></button>
                    <div className="secure-note"><ShieldCheck size={14} /> Your information is encrypted and secure</div>
                  </div>
                  <div className="preview-footer">KYC Verify <span>Privacy</span><span>Terms</span></div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
