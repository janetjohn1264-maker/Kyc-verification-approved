/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { CheckCircle2, ChevronDown, Dices, FileText, LayoutDashboard, LogOut, Menu, RefreshCw, RotateCcw, Save, Settings, ShieldCheck, Upload, UserRound, X } from "lucide-react"
import { BangladeshPassportCard, BangladeshPassportData, defaultBangladeshPassportData, generateBangladeshMRZ } from "./BangladeshPassportCard"
import { GhanaPassportCard, GhanaPassportData, defaultGhanaPassportData, generateGhanaMRZ } from "./GhanaPassportCard"
import { CanadaPassportCard, CanadaPassportData, defaultCanadaPassportData, generateCanadaMRZ } from "./CanadaPassportCard"
import { EthiopiaPassportCard, EthiopiaPassportData, defaultEthiopiaPassportData, generateEthiopiaMRZ } from "./EthiopiaPassportCard"
import { NigeriaPassportCard, NigeriaPassportData, defaultNigeriaPassportData, generateNigeriaMRZ } from "./NigeriaPassportCard"
import { RwandaIdCard, RwandaIdData, defaultRwandaIdData, rwandaRandomSpecimens } from "./RwandaIdCard"

const defaultContent = {
  title: "South Africa Passport Verification",
  subtitle: "Securely verify identity documents in a few simple steps.",
  button: "Start verification",
  accent: "#15803d",
}

const nigeriaRandomSpecimens: NigeriaPassportData[] = [
  defaultNigeriaPassportData,
  {
    passportNo: "B61849203",
    surname: "ADEYEMI",
    givenNames: "OLUWASEUN BABATUNDE",
    nationality: "NIGERIAN",
    dateOfBirth: "14 MAY / MAI 91",
    previousPassportNo: "A20491827",
    nin: "51928374602",
    sex: "M",
    placeOfBirth: "IBADAN",
    dateOfIssue: "12 MAR / MAR 24",
    authority: "IKOYI LAGOS",
    dateOfExpiry: "11 MAR / MAR 34",
    photoUrl: "/assets/aistudio/nigeria_passport_portrait.png",
  },
  {
    passportNo: "B73920145",
    surname: "OKONKWO",
    givenNames: "CHIDINMA NGOZI",
    nationality: "NIGERIAN",
    dateOfBirth: "08 NOV / NOV 96",
    previousPassportNo: "A31827364",
    nin: "73849201563",
    sex: "F",
    placeOfBirth: "ENUGU",
    dateOfIssue: "04 SEP / SEP 23",
    authority: "ABUJA HQRS",
    dateOfExpiry: "03 SEP / SEP 33",
    photoUrl: "/assets/aistudio/nigeria_passport_portrait.png",
  },
]

const ethiopiaRandomSpecimens: EthiopiaPassportData[] = [
  defaultEthiopiaPassportData,
  {
    passportNo: "EP7819204",
    surnameAmharic: "ተስፋዬ",
    surname: "TESFAYE",
    givenNameAmharic: "ዳዊት አበበ",
    givenNames: "DAWIT ABEBE",
    nationality: "ETHIOPIAN",
    personalNo: "",
    dateOfBirth: "19 AUG 98",
    sex: "M",
    placeOfBirth: "ADDIS ABABA",
    dateOfIssue: "10 JAN 23",
    dateOfExpiry: "09 JAN 28",
    issuingAuthority: "MAIN DEPARTMENT FOR IMMIGRATION AND NATIONALITY AFFAIRS",
    photoUrl: "/assets/aistudio/ethiopia_passport_portrait.png",
  },
  {
    passportNo: "EP8391045",
    surnameAmharic: "በቀለ",
    surname: "BEKELE",
    givenNameAmharic: "ሄለን ታደሰ",
    givenNames: "HELEN TADESSE",
    nationality: "ETHIOPIAN",
    personalNo: "",
    dateOfBirth: "24 FEB 01",
    sex: "F",
    placeOfBirth: "BAHIR DAR",
    dateOfIssue: "05 JUN 22",
    dateOfExpiry: "04 JUN 27",
    issuingAuthority: "MAIN DEPARTMENT FOR IMMIGRATION AND NATIONALITY AFFAIRS",
    photoUrl: "/assets/aistudio/ethiopia_passport_portrait.png",
  },
  {
    passportNo: "EP9104827",
    surnameAmharic: "አለሙ",
    surname: "ALEMU",
    givenNameAmharic: "ዮሐንስ ግርማ",
    givenNames: "YOHANNES GIRMA",
    nationality: "ETHIOPIAN",
    personalNo: "",
    dateOfBirth: "12 OCT 95",
    sex: "M",
    placeOfBirth: "DIRE DAWA",
    dateOfIssue: "18 NOV 23",
    dateOfExpiry: "17 NOV 28",
    issuingAuthority: "MAIN DEPARTMENT FOR IMMIGRATION AND NATIONALITY AFFAIRS",
    photoUrl: "/assets/aistudio/ethiopia_passport_portrait.png",
  },
]

const canadaRandomSpecimens: CanadaPassportData[] = [
  defaultCanadaPassportData,
  {
    passportNo: "ZF482910",
    surname: "TREMBLAY",
    givenNames: "SOPHIE MARIE",
    nationality: "CANADIENNE",
    dateOfBirth: "14 AUG / AOÛT 1992",
    sex: "F/F",
    placeOfBirth: "MONTREAL",
    dateOfIssue: "10 MAR / MAR 2021",
    dateOfExpiry: "09 MAR / MAR 2031",
    authority: "MONTREAL",
    barcodeCode: "ECR81920",
    signatureText: "Sophie Tremblay",
    photoUrl: "/assets/aistudio/canada_passport_portrait.png",
  },
  {
    passportNo: "ZG910482",
    surname: "MACDONALD",
    givenNames: "LIAM ALEXANDER",
    nationality: "CANADIENNE",
    dateOfBirth: "22 NOV / NOV 1985",
    sex: "M/M",
    placeOfBirth: "TORONTO",
    dateOfIssue: "18 JUL / JUIL 2022",
    dateOfExpiry: "17 JUL / JUIL 2032",
    authority: "TORONTO",
    barcodeCode: "ECR50391",
    signatureText: "Liam MacDonald",
    photoUrl: "/assets/aistudio/canada_passport_portrait.png",
  },
]

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

interface OtherDocumentData {
  documentNo: string
  personalNo: string
  surname: string
  givenNames: string
  nationality: string
  dateOfBirth: string
  sex: string
  placeOfBirth: string
  dateOfIssue: string
  dateOfExpiry: string
  authority: string
  photoUrl?: string
}

const otherCountryRandomSpecimens: Record<string, OtherDocumentData[]> = {
  UGA: [
    {
      documentNo: "CA050221301",
      personalNo: "CM650231018R1D",
      surname: "KATO",
      givenNames: "CHRISTOPHER MUGANGA",
      nationality: "UGA",
      dateOfBirth: "20.05.1965",
      sex: "M",
      placeOfBirth: "KAMPALA",
      dateOfIssue: "18.09.2025",
      dateOfExpiry: "17.09.2035",
      authority: "NIRA UGANDA",
    },
    {
      documentNo: "CA081940215",
      personalNo: "CF920418029K2E",
      surname: "NAMUKASA",
      givenNames: "GRACE NAKATO",
      nationality: "UGA",
      dateOfBirth: "14.08.1992",
      sex: "F",
      placeOfBirth: "ENTEBBE",
      dateOfIssue: "10.03.2024",
      dateOfExpiry: "09.03.2034",
      authority: "NIRA UGANDA",
    },
    {
      documentNo: "CA093817462",
      personalNo: "CM881105044M9A",
      surname: "OKELLO",
      givenNames: "DENIS OTIM",
      nationality: "UGA",
      dateOfBirth: "05.11.1988",
      sex: "M",
      placeOfBirth: "GULU",
      dateOfIssue: "22.06.2023",
      dateOfExpiry: "21.06.2033",
      authority: "NIRA UGANDA",
    },
  ],
  KEN: [
    {
      documentNo: "BK569259",
      personalNo: "3466792",
      surname: "RUKU",
      givenNames: "GEORGE MWANGI",
      nationality: "KENYAN",
      dateOfBirth: "12 JUN 1993",
      sex: "M",
      placeOfBirth: "THIKA, KEN",
      dateOfIssue: "01 MAR 2024",
      dateOfExpiry: "28 FEB 2034",
      authority: "GOVERNMENT OF KENYA",
    },
    {
      documentNo: "AK819204",
      personalNo: "4829103",
      surname: "WANJIKU",
      givenNames: "FAITH NJERI",
      nationality: "KENYAN",
      dateOfBirth: "24 SEP 1996",
      sex: "F",
      placeOfBirth: "NAIROBI, KEN",
      dateOfIssue: "15 JUL 2023",
      dateOfExpiry: "14 JUL 2033",
      authority: "GOVERNMENT OF KENYA",
    },
    {
      documentNo: "BK904182",
      personalNo: "2910485",
      surname: "ODHIAMBO",
      givenNames: "BRIAN OTIENO",
      nationality: "KENYAN",
      dateOfBirth: "08 FEB 1990",
      sex: "M",
      placeOfBirth: "KISUMU, KEN",
      dateOfIssue: "19 NOV 2022",
      dateOfExpiry: "18 NOV 2032",
      authority: "GOVERNMENT OF KENYA",
    },
  ],
  SEN: [
    {
      documentNo: "1 02 19910828 00011 3",
      personalNo: "SN19910828001",
      surname: "BODIAN",
      givenNames: "OUSSEYNOU",
      nationality: "SENEGALAISE",
      dateOfBirth: "28/08/1991",
      sex: "M",
      placeOfBirth: "GUIDEL BAMBADINKA",
      dateOfIssue: "16/05/2019",
      dateOfExpiry: "15/05/2029",
      authority: "COMM. DE PIKINE",
    },
    {
      documentNo: "2 01 19950412 00482 7",
      personalNo: "SN19950412048",
      surname: "NDIAYE",
      givenNames: "FATOU BINTOU",
      nationality: "SENEGALAISE",
      dateOfBirth: "12/04/1995",
      sex: "F",
      placeOfBirth: "DAKAR PLATEAU",
      dateOfIssue: "08/10/2022",
      dateOfExpiry: "07/10/2032",
      authority: "PREF. DE DAKAR",
    },
    {
      documentNo: "1 04 19891103 00918 5",
      personalNo: "SN19891103091",
      surname: "DIOP",
      givenNames: "MAMADOU LAMINE",
      nationality: "SENEGALAISE",
      dateOfBirth: "03/11/1989",
      sex: "M",
      placeOfBirth: "SAINT-LOUIS",
      dateOfIssue: "21/01/2021",
      dateOfExpiry: "20/01/2031",
      authority: "COMM. DE SAINT-LOUIS",
    },
  ],
  DRC: [
    {
      documentNo: "DEMO-044743",
      personalNo: "CD910802004",
      surname: "MINAFFET",
      givenNames: "ESTHER NADINE",
      nationality: "CONGOLAISE",
      dateOfBirth: "02/08/1991",
      sex: "F",
      placeOfBirth: "KINSHASA",
      dateOfIssue: "14/06/2022",
      dateOfExpiry: "13/06/2027",
      authority: "MIN. DES AFFAIRES ETRANGERES",
    },
    {
      documentNo: "OP0819420",
      personalNo: "CD870319018",
      surname: "KABONGO",
      givenNames: "PATRICK MUTOMBO",
      nationality: "CONGOLAISE",
      dateOfBirth: "19/03/1987",
      sex: "M",
      placeOfBirth: "LUBUMBASHI",
      dateOfIssue: "05/09/2023",
      dateOfExpiry: "04/09/2028",
      authority: "MIN. DES AFFAIRES ETRANGERES",
    },
    {
      documentNo: "OP0954108",
      personalNo: "CD941210052",
      surname: "MBALA",
      givenNames: "CHANTAL KASONGO",
      nationality: "CONGOLAISE",
      dateOfBirth: "10/12/1994",
      sex: "F",
      placeOfBirth: "GOMA",
      dateOfIssue: "11/02/2024",
      dateOfExpiry: "10/02/2029",
      authority: "MIN. DES AFFAIRES ETRANGERES",
    },
  ],
  RSA: [
    {
      documentNo: "M00328723",
      personalNo: "6309075016088",
      surname: "GAGIANO",
      givenNames: "DIRK JOHAN",
      nationality: "SOUTH AFRICAN / SUD-AFRICAIN",
      dateOfBirth: "07 SEP 1963",
      sex: "M",
      placeOfBirth: "ZAF",
      dateOfIssue: "03 FEB 2020",
      dateOfExpiry: "02 FEB 2030",
      authority: "DEPT OF HOME AFFAIRS",
    },
    {
      documentNo: "A04928174",
      personalNo: "8503225419082",
      surname: "MOKOENA",
      givenNames: "SIPHO MANDLA",
      nationality: "SOUTH AFRICAN / SUD-AFRICAIN",
      dateOfBirth: "22 MAR 1985",
      sex: "M",
      placeOfBirth: "ZAF",
      dateOfIssue: "14 AUG 2019",
      dateOfExpiry: "13 AUG 2029",
      authority: "DEPT OF HOME AFFAIRS",
    },
    {
      documentNo: "M08371925",
      personalNo: "9211090384086",
      surname: "NAIDOO",
      givenNames: "PRIYA DEVI",
      nationality: "SOUTH AFRICAN / SUD-AFRICAIN",
      dateOfBirth: "09 NOV 1992",
      sex: "F",
      placeOfBirth: "ZAF",
      dateOfIssue: "05 FEB 2021",
      dateOfExpiry: "04 FEB 2031",
      authority: "DEPT OF HOME AFFAIRS",
    },
  ],
  PNG: [
    {
      documentNo: "1330003246",
      personalNo: "PNG20001010",
      surname: "MAREW",
      givenNames: "THEODORE",
      nationality: "PAPUA NEW GUINEAN",
      dateOfBirth: "10-10-2000",
      sex: "M",
      placeOfBirth: "PORT MORESBY",
      dateOfIssue: "17-02-2021",
      dateOfExpiry: "17-02-2031",
      authority: "PNG CIVIL & IDENTITY REGISTRY",
    },
    {
      documentNo: "1330084912",
      personalNo: "PNG19940622",
      surname: "KUMAN",
      givenNames: "MARIA THERESA",
      nationality: "PAPUA NEW GUINEAN",
      dateOfBirth: "22-06-1994",
      sex: "F",
      placeOfBirth: "LAE",
      dateOfIssue: "09-07-2022",
      dateOfExpiry: "09-07-2032",
      authority: "PNG CIVIL & IDENTITY REGISTRY",
    },
    {
      documentNo: "1330159204",
      personalNo: "PNG19880314",
      surname: "SOMARE",
      givenNames: "PETER MICHAEL",
      nationality: "PAPUA NEW GUINEAN",
      dateOfBirth: "14-03-1988",
      sex: "M",
      placeOfBirth: "WEWAK",
      dateOfIssue: "25-11-2023",
      dateOfExpiry: "25-11-2033",
      authority: "PNG CIVIL & IDENTITY REGISTRY",
    },
  ],
}

const defaultOtherCountryData: Record<string, OtherDocumentData> = {
  UGA: otherCountryRandomSpecimens.UGA[0],
  KEN: otherCountryRandomSpecimens.KEN[0],
  SEN: otherCountryRandomSpecimens.SEN[0],
  DRC: otherCountryRandomSpecimens.DRC[0],
  RSA: otherCountryRandomSpecimens.RSA[0],
  PNG: otherCountryRandomSpecimens.PNG[0],
}

function App() {
  const [content, setContent] = useState(defaultContent)
  const [saved, setSaved] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [detectedText, setDetectedText] = useState<string[] | null>(null)
  const [country, setCountry] = useState("RSA")
  const [rwandaData, setRwandaData] = useState<RwandaIdData>(defaultRwandaIdData)
  const [nigeriaData, setNigeriaData] = useState<NigeriaPassportData>(defaultNigeriaPassportData)
  const [ethiopiaData, setEthiopiaData] = useState<EthiopiaPassportData>(defaultEthiopiaPassportData)
  const [canadaData, setCanadaData] = useState<CanadaPassportData>(defaultCanadaPassportData)
  const [ghanaData, setGhanaData] = useState<GhanaPassportData>(defaultGhanaPassportData)
  const [bangladeshData, setBangladeshData] = useState<BangladeshPassportData>(defaultBangladeshPassportData)
  const [otherData, setOtherData] = useState<Record<string, OtherDocumentData>>(defaultOtherCountryData)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isPreviewBlurred, setIsPreviewBlurred] = useState(false)
  const [securityNotice, setSecurityNotice] = useState<string | null>(null)
  const [watermarkTick, setWatermarkTick] = useState(0)
  const [visitorSessionId] = useState(() => {
    try {
      const existing = localStorage.getItem("ogads_visitor_session_v1")
      if (existing) return existing
      const created = `vs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem("ogads_visitor_session_v1", created)
      return created
    } catch {
      return "vs_ephemeral_session"
    }
  })
  const recentAttemptsRef = useRef<number[]>([])

  const reportSecurityEvent = useCallback(
    (eventType: string, details: string) => {
      const now = Date.now()
      recentAttemptsRef.current = recentAttemptsRef.current.filter((t) => now - t < 60000)
      recentAttemptsRef.current.push(now)
      const attemptCount = recentAttemptsRef.current.length
      const suspicious = attemptCount >= 3
      setSecurityNotice(
        suspicious
          ? `Repeated protected-content access detected (${attemptCount} events). Security event recorded.`
          : details
      )
      fetch("/api/ogads/security-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: visitorSessionId,
          eventType,
          documentKey: country,
          countryView: `${country.toLowerCase()}-react-preview`,
          attemptCount,
          suspicious,
          details,
        }),
      }).catch(() => {})
    },
    [country, visitorSessionId]
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setWatermarkTick((t) => t + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden || document.visibilityState !== "visible") {
        setIsPreviewBlurred(true)
      } else if (document.hasFocus()) {
        setIsPreviewBlurred(false)
      }
    }
    const handleBlur = () => setIsPreviewBlurred(true)
    const handleFocus = () => setIsPreviewBlurred(false)
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key || ""
      const lower = key.toLowerCase()
      if (
        key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && ["3", "4", "5", "6", "s"].includes(lower)) ||
        (e.ctrlKey && e.shiftKey && lower === "s")
      ) {
        e.preventDefault()
        setIsPreviewBlurred(true)
        reportSecurityEvent("screenshot_shortcut_detected", "Screenshot keyboard shortcut detected")
      } else if ((e.ctrlKey || e.metaKey) && lower === "p") {
        e.preventDefault()
        setIsPreviewBlurred(true)
        reportSecurityEvent("print_shortcut_blocked", "Print shortcut blocked on KYC specimen")
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [reportSecurityEvent])

  const watermarkTimestamp = useMemo(() => {
    void watermarkTick
    return new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC"
  }, [watermarkTick])

  const shortSessionId = visitorSessionId.slice(0, 18)

  const update = (key: keyof typeof defaultContent, value: string) => {
    setDetectedText(null)
    setSaved(false)
    setContent((current) => ({ ...current, [key]: value }))
  }

  const updateRwanda = <K extends keyof RwandaIdData>(key: K, value: RwandaIdData[K]) => {
    setSaved(false)
    setDetectedText(null)
    setRwandaData((prev) => ({ ...prev, [key]: value }))
  }

  const updateNigeria = <K extends keyof NigeriaPassportData>(key: K, value: NigeriaPassportData[K]) => {
    setSaved(false)
    setDetectedText(null)
    setNigeriaData((prev) => ({ ...prev, [key]: value }))
  }

  const updateEthiopia = <K extends keyof EthiopiaPassportData>(key: K, value: EthiopiaPassportData[K]) => {
    setSaved(false)
    setDetectedText(null)
    setEthiopiaData((prev) => ({ ...prev, [key]: value }))
  }

  const updateCanada = <K extends keyof CanadaPassportData>(key: K, value: CanadaPassportData[K]) => {
    setSaved(false)
    setDetectedText(null)
    setCanadaData((prev) => ({ ...prev, [key]: value }))
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

  const updateOtherCountry = <K extends keyof OtherDocumentData>(key: K, value: OtherDocumentData[K]) => {
    setSaved(false)
    setDetectedText(null)
    setOtherData((prev) => ({
      ...prev,
      [country]: {
        ...(prev[country] || defaultOtherCountryData[country] || defaultOtherCountryData.UGA),
        [key]: value,
      },
    }))
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      if (country === "RWA") {
        updateRwanda("photoUrl", url)
      } else if (country === "NGA") {
        updateNigeria("photoUrl", url)
      } else if (country === "ETH") {
        updateEthiopia("photoUrl", url)
      } else if (country === "CAN") {
        updateCanada("photoUrl", url)
      } else if (country === "GHA") {
        updateGhana("photoUrl", url)
      } else if (country === "BGD") {
        updateBangladesh("photoUrl", url)
      } else {
        updateOtherCountry("photoUrl", url)
      }
    }
  }

  const previewStyle = useMemo(() => ({ "--accent": content.accent } as React.CSSProperties), [content.accent])
  const isRwanda = country === "RWA"
  const isNigeria = country === "NGA"
  const isEthiopia = country === "ETH"
  const isCanada = country === "CAN"
  const isGhana = country === "GHA"
  const isBangladesh = country === "BGD"
  const isSouthAfrica = country === "RSA"
  const isPapuaNewGuinea = country === "PNG"
  const isSenegal = country === "SEN"
  const isKenya = country === "KEN"
  const isUganda = country === "UGA"

  const specimenImage = isRwanda
    ? "/assets/aistudio/rwanda_id_front_reference.png"
    : isNigeria
    ? "/assets/aistudio/nigeria_passport_reference.png"
    : isEthiopia
    ? "/assets/aistudio/ethiopia_passport_reference.png"
    : isCanada
    ? "/assets/aistudio/canada_passport_reference.png"
    : isGhana
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
    ? "/assets/aistudio/image_02a4a299.png"
    : isPapuaNewGuinea
    ? "/assets/aistudio/png_national_id_reference.jpg"
    : "/assets/aistudio/drc_passport_reference.jpg"

  const specimenAlt = isRwanda
    ? "Republic of Rwanda National Identity Card (Indangamuntu) reference specimen"
    : isNigeria
    ? "Federal Republic of Nigeria biometric e-Passport reference specimen"
    : isEthiopia
    ? "Federal Democratic Republic of Ethiopia biometric e-Passport reference specimen"
    : isCanada
    ? "Canada biometric e-Passport reference specimen"
    : isGhana
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
    ? "Republic of South Africa biometric e-Passport (2-Page Spread) reference specimen"
    : isPapuaNewGuinea
    ? "Static Independent State of Papua New Guinea national identity card reference specimen"
    : "Static Democratic Republic of the Congo passport reference specimen"

  const specimenLabel = isRwanda
    ? "Rwanda National ID Card (Indangamuntu) reference specimen"
    : isNigeria
    ? "Federal Republic of Nigeria e-Passport (2-Page Spread) reference specimen"
    : isEthiopia
    ? "Ethiopia e-Passport (2-Page Spread) reference specimen"
    : isCanada
    ? "Canada e-Passport (2-Page Spread) reference specimen"
    : isGhana
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
    ? "Republic of South Africa e-Passport (2-Page Spread) reference specimen"
    : isPapuaNewGuinea
    ? "Papua New Guinea national ID reference specimen"
    : "Passport reference specimen"

  const randomizeSpecimen = () => {
    if (isRwanda) {
      const pool = rwandaRandomSpecimens.filter((s) => s.idNumber !== rwandaData.idNumber)
      const chosen = pool[Math.floor(Math.random() * pool.length)] || rwandaRandomSpecimens[0]
      setRwandaData(chosen)
      setDetectedText([
        "REPUBULIKA Y'U RWANDA / REPUBLIC OF RWANDA",
        "INDANGAMUNTU / NATIONAL IDENTITY CARD",
        `INDANGAMUNTU / NATIONAL ID NO: ${chosen.idNumber}`,
        `AMAZINA / NAMES: ${chosen.surname} ${chosen.givenNames}`,
        `ITARIKI YAVUTSEHO / DATE OF BIRTH: ${chosen.dateOfBirth}`,
        `IGITSINA / SEX: ${chosen.sex}`,
        `AHO YATANGIWE / PLACE OF ISSUE: ${chosen.placeOfIssue}`,
        `UMUKONO WA NYIRAYO / SIGNATURE: ${chosen.signatureText || chosen.surname}`,
        `ISSUE NO: ${chosen.issueNumber || "0164"}`,
      ])
    } else if (isNigeria) {
      const pool = nigeriaRandomSpecimens.filter((s) => s.passportNo !== nigeriaData.passportNo)
      const chosen = pool[Math.floor(Math.random() * pool.length)] || nigeriaRandomSpecimens[0]
      setNigeriaData(chosen)
      const mrz = generateNigeriaMRZ(chosen)
      setDetectedText([
        "FEDERAL REPUBLIC OF NIGERIA / PASSPORT · PASSEPORT (NGA)",
        `TYPE: P | COUNTRY CODE: NGA | PASSPORT NO: ${chosen.passportNo}`,
        `SURNAME: ${chosen.surname}`,
        `GIVEN NAMES: ${chosen.givenNames}`,
        `NATIONALITY: ${chosen.nationality}`,
        `DATE OF BIRTH: ${chosen.dateOfBirth} | NIN: ${chosen.nin}`,
        `PREVIOUS PASSPORT: ${chosen.previousPassportNo}`,
        `SEX: ${chosen.sex} | PLACE OF BIRTH: ${chosen.placeOfBirth}`,
        `DATE OF ISSUE: ${chosen.dateOfIssue} | AUTHORITY: ${chosen.authority}`,
        `DATE OF EXPIRY: ${chosen.dateOfExpiry}`,
        `MRZ L1: ${mrz.line1}`,
        `MRZ L2: ${mrz.line2}`,
      ])
    } else if (isEthiopia) {
      const pool = ethiopiaRandomSpecimens.filter((s) => s.passportNo !== ethiopiaData.passportNo)
      const chosen = pool[Math.floor(Math.random() * pool.length)] || ethiopiaRandomSpecimens[0]
      setEthiopiaData(chosen)
      const mrz = generateEthiopiaMRZ(chosen)
      setDetectedText([
        "የኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ / FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIAN",
        `TYPE: P | COUNTRY CODE: ETH | PASSPORT NO: ${chosen.passportNo}`,
        `SURNAME: ${chosen.surnameAmharic}/${chosen.surname}`,
        `GIVEN NAME: ${chosen.givenNameAmharic}/${chosen.givenNames}`,
        `NATIONALITY: ${chosen.nationality} | SEX: ${chosen.sex}`,
        `DATE OF BIRTH: ${chosen.dateOfBirth} | PLACE OF BIRTH: ${chosen.placeOfBirth}`,
        `DATE OF ISSUE: ${chosen.dateOfIssue} | DATE OF EXPIRY: ${chosen.dateOfExpiry}`,
        `ISSUING AUTHORITY: ${chosen.issuingAuthority}`,
        `MRZ L1: ${mrz.line1}`,
        `MRZ L2: ${mrz.line2}`,
      ])
    } else if (isCanada) {
      const pool = canadaRandomSpecimens.filter((s) => s.passportNo !== canadaData.passportNo)
      const chosen = pool[Math.floor(Math.random() * pool.length)] || canadaRandomSpecimens[0]
      setCanadaData(chosen)
      const mrz = generateCanadaMRZ(chosen)
      setDetectedText([
        "CANADA / PASSPORT · PASSEPORT (CAN)",
        `TYPE: P | ISSUING COUNTRY: CAN | PASSPORT NO: ${chosen.passportNo}`,
        `SURNAME: ${chosen.surname}`,
        `GIVEN NAMES: ${chosen.givenNames}`,
        `NATIONALITY: ${chosen.nationality}`,
        `DATE OF BIRTH: ${chosen.dateOfBirth}`,
        `SEX: ${chosen.sex} | PLACE OF BIRTH: ${chosen.placeOfBirth}`,
        `DATE OF ISSUE: ${chosen.dateOfIssue}`,
        `DATE OF EXPIRY: ${chosen.dateOfExpiry} | AUTHORITY: ${chosen.authority}`,
        `MRZ L1: ${mrz.line1}`,
        `MRZ L2: ${mrz.line2}`,
      ])
    } else if (isGhana) {
      const pool = ghanaRandomSpecimens.filter((s) => s.passportNo !== ghanaData.passportNo)
      const chosen = pool[Math.floor(Math.random() * pool.length)] || ghanaRandomSpecimens[0]
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
      const pool = bangladeshRandomSpecimens.filter((s) => s.passportNo !== bangladeshData.passportNo)
      const chosen = pool[Math.floor(Math.random() * pool.length)] || bangladeshRandomSpecimens[0]
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
    } else {
      const list = otherCountryRandomSpecimens[country] || otherCountryRandomSpecimens.DRC
      const current = otherData[country] || list[0]
      const pool = list.filter((s) => s.documentNo !== current.documentNo)
      const chosen = pool[Math.floor(Math.random() * pool.length)] || list[0]
      setOtherData((prev) => ({ ...prev, [country]: chosen }))
      setDetectedText([
        `${specimenLabel.toUpperCase()} (${country})`,
        `DOCUMENT / PASSPORT NO: ${chosen.documentNo} | PERSONAL / NIN NO: ${chosen.personalNo}`,
        `SURNAME: ${chosen.surname}`,
        `GIVEN NAMES: ${chosen.givenNames}`,
        `NATIONALITY: ${chosen.nationality} | SEX: ${chosen.sex}`,
        `DATE OF BIRTH: ${chosen.dateOfBirth} | PLACE OF BIRTH: ${chosen.placeOfBirth}`,
        `DATE OF ISSUE: ${chosen.dateOfIssue} | DATE OF EXPIRY: ${chosen.dateOfExpiry}`,
        `ISSUING AUTHORITY: ${chosen.authority}`,
      ])
    }
  }

  const resetRwandaToDefault = () => {
    setRwandaData(defaultRwandaIdData)
    setDetectedText(null)
  }

  const resetNigeriaToDefault = () => {
    setNigeriaData(defaultNigeriaPassportData)
    setDetectedText(null)
  }

  const resetEthiopiaToDefault = () => {
    setEthiopiaData(defaultEthiopiaPassportData)
    setDetectedText(null)
  }

  const resetCanadaToDefault = () => {
    setCanadaData(defaultCanadaPassportData)
    setDetectedText(null)
  }

  const resetGhanaToDefault = () => {
    setGhanaData(defaultGhanaPassportData)
    setDetectedText(null)
  }

  const resetBangladeshToDefault = () => {
    setBangladeshData(defaultBangladeshPassportData)
    setDetectedText(null)
  }

  const resetOtherToDefault = () => {
    setOtherData((prev) => ({
      ...prev,
      [country]: defaultOtherCountryData[country] || defaultOtherCountryData.DRC,
    }))
    setDetectedText(null)
  }

  const resetCurrentCountry = () => {
    if (isRwanda) resetRwandaToDefault()
    else if (isNigeria) resetNigeriaToDefault()
    else if (isEthiopia) resetEthiopiaToDefault()
    else if (isCanada) resetCanadaToDefault()
    else if (isGhana) resetGhanaToDefault()
    else if (isBangladesh) resetBangladeshToDefault()
    else resetOtherToDefault()
  }

  const triggerCountryOgadsLocker = () => {
    const keyMap: Record<string, string> = {
      RWA: "rwanda-id-png",
      NGA: "nigeria-passport-png",
      ETH: "ethiopia-passport-png",
      GHA: "ghana-passport-png",
      CAN: "canada-passport-png",
      BGD: "bangladesh-passport-png",
      UGA: "uganda-refugee-png",
      KEN: "kenya-passport-png",
      SEN: "senegal-passport-png",
      DRC: "drcongo-passport-png",
      RSA: "southafrica-passport-png",
      PNG: "kenya-passport-png",
    }
    const targetKey = keyMap[country] || "kenya-passport-png"
    const w = window as unknown as {
      openOgadsContentLockerByKey?: (key: string) => void
      openOgadsContentLocker?: (key: string) => void
    }
    if (typeof w.openOgadsContentLockerByKey === "function") {
      w.openOgadsContentLockerByKey(targetKey)
    } else if (typeof w.openOgadsContentLocker === "function") {
      w.openOgadsContentLocker(targetKey)
    }
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
          <section className="page-heading"><div><p className="eyebrow">VERIFICATION FLOW</p><h1>Passport verification</h1><p className="heading-copy">Edit your verification screen and document fields, updated instantly in the live preview.</p></div><div className="heading-actions"><button className="randomize-button" onClick={randomizeSpecimen}><RefreshCw size={15} /> Randomize</button><button className={`save-button ${saved ? "saved" : ""}`} onClick={() => { setSaved(true); triggerCountryOgadsLocker(); }}><Save size={17} /> {saved ? "Unlock & Download" : "Save & Export"}</button></div></section>

          <div className="editor-layout" id="passport-editor">
            <section className="editor-panel" aria-label="Editor controls">
              <div className="panel-header">
                <div><h2>Document & Content</h2><p>Customize the screen content and passport fields.</p></div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={randomizeSpecimen}
                    className="text-xs flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black shadow-md shadow-indigo-700/20 cursor-pointer transition-all"
                  >
                    <Dices size={14} className="text-amber-300" />
                    <span>Randomize Card</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider">INSTANT FILL</span>
                  </button>
                  <span className="live-pill"><span /> Live</span>
                </div>
              </div>
              <div className="form-stack">
                <div>
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={randomizeSpecimen}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-700/25 hover:shadow-indigo-700/40 border-2 border-indigo-300/40 flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 text-lg group-hover:rotate-180 transition-transform duration-500 shadow-inner shrink-0">
                        <Dices size={20} />
                      </div>
                      <div className="text-left">
                        <div className="leading-none text-sm font-extrabold flex items-center gap-2">
                          <span>Randomize Card</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider shadow-xs">INSTANT FILL</span>
                        </div>
                        <div className="text-[11px] font-normal text-indigo-100 opacity-90 mt-0.5">Generate fictional sample fields for {country} document preview</div>
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">Country / document</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetCurrentCountry}
                        className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                      >
                        <RotateCcw size={11} /> Reset Sample
                      </button>
                    </div>
                  </div>
                  <select
                    className="w-full"
                    value={country}
                    onChange={(event) => {
                      const newCountry = event.target.value
                      setCountry(newCountry)
                      setDetectedText(null)
                      if (newCountry === "RWA") {
                        setContent((c) => ({ ...c, title: "Rwanda National ID Verification", accent: "#009eb0" }))
                      } else if (newCountry === "NGA") {
                        setContent((c) => ({ ...c, title: "Nigeria Passport Verification", accent: "#15803d" }))
                      } else if (newCountry === "ETH") {
                        setContent((c) => ({ ...c, title: "Ethiopia Passport Verification", accent: "#15803d" }))
                      } else if (newCountry === "CAN") {
                        setContent((c) => ({ ...c, title: "Canada Passport Verification", accent: "#b91c1c" }))
                      } else if (newCountry === "GHA") {
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
                        setContent((c) => ({ ...c, title: "South Africa Passport Verification", accent: "#15803d" }))
                      } else if (newCountry === "PNG") {
                        setContent((c) => ({ ...c, title: "Papua New Guinea ID Verification", accent: "#b91c1c" }))
                      } else {
                        setContent((c) => ({ ...c, title: "DR Congo Passport Verification", accent: "#2563eb" }))
                      }
                    }}
                  >
                    <option value="RWA">Republic of Rwanda — National Identity Card (Indangamuntu)</option>
                    <option value="NGA">Federal Republic of Nigeria — Biometric e-Passport</option>
                    <option value="ETH">Federal Democratic Republic of Ethiopia — Biometric e-Passport</option>
                    <option value="GHA">Republic of Ghana — Biometric e-Passport</option>
                    <option value="CAN">Canada — Biometric e-Passport</option>
                    <option value="BGD">People&apos;s Republic of Bangladesh — Biometric e-Passport</option>
                    <option value="UGA">Republic of Uganda — National ID Card</option>
                    <option value="KEN">Republic of Kenya — Biometric e-Passport</option>
                    <option value="SEN">Republic of Senegal — National Identity Card (CEDEAO)</option>
                    <option value="DRC">Democratic Republic of the Congo — Passport</option>
                    <option value="RSA">Republic of South Africa — Biometric e-Passport</option>
                    <option value="PNG">Independent State of Papua New Guinea — National ID Card</option>
                  </select>
                </div>
                <label>Screen title<input value={content.title} onChange={(event) => update("title", event.target.value)} /></label>
                <label>Description<textarea rows={2} value={content.subtitle} onChange={(event) => update("subtitle", event.target.value)} /></label>
                <label>Primary button label<input value={content.button} onChange={(event) => update("button", event.target.value)} /></label>
                <label>Accent color<div className="color-input"><input type="color" value={content.accent} onChange={(event) => update("accent", event.target.value)} /><input value={content.accent} onChange={(event) => update("accent", event.target.value)} aria-label="Accent color hex value" /></div></label>
              </div>

              {/* Rwanda-specific interactive fields */}
              {isRwanda && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rwanda National ID (Indangamuntu) Fields</span>
                    <button
                      type="button"
                      onClick={resetRwandaToDefault}
                      className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={randomizeSpecimen}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-700/25 hover:shadow-indigo-700/40 border-2 border-indigo-300/40 flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 text-lg group-hover:rotate-180 transition-transform duration-500 shadow-inner shrink-0">
                      <Dices size={20} />
                    </div>
                    <div className="text-left">
                      <div className="leading-none text-sm font-extrabold flex items-center gap-2">
                        <span>Randomize Card</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider shadow-xs">INSTANT FILL</span>
                      </div>
                      <div className="text-[11px] font-normal text-indigo-100 opacity-90 mt-0.5">Generate fictional Rwandan Indangamuntu sample data</div>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Surname (Ubushize)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={rwandaData.surname}
                        onChange={(e) => updateRwanda("surname", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Given Names (Amazina)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={rwandaData.givenNames}
                        onChange={(e) => updateRwanda("givenNames", e.target.value)}
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                      National ID No. (Indangamuntu)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={rwandaData.idNumber}
                        placeholder="1 1998 8 0014393 0 17"
                        onChange={(e) => updateRwanda("idNumber", e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Birth (Itariki yavutseho)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={rwandaData.dateOfBirth}
                        placeholder="DD/MM/YYYY"
                        onChange={(e) => updateRwanda("dateOfBirth", e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Sex (Igitsina)
                      <select
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={rwandaData.sex}
                        onChange={(e) => updateRwanda("sex", e.target.value as "Gabo / M" | "Gore / F")}
                      >
                        <option value="Gabo / M">Gabo / M (Male)</option>
                        <option value="Gore / F">Gore / F (Female)</option>
                      </select>
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                      Place of Issue (Aho Yatangiwe)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={rwandaData.placeOfIssue}
                        placeholder="District / Sector (e.g. Gakenke / Gashenyi)"
                        onChange={(e) => updateRwanda("placeOfIssue", e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Signature Script
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={rwandaData.signatureText || ""}
                        placeholder="Signature script"
                        onChange={(e) => updateRwanda("signatureText", e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Issue Number (Back Serial)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={rwandaData.issueNumber || "0164"}
                        placeholder="0164"
                        onChange={(e) => updateRwanda("issueNumber", e.target.value)}
                      />
                    </label>
                    <div className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                      <span>Card View Side</span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => updateRwanda("cardSide", "front")}
                          className={`p-2 rounded border text-xs font-semibold cursor-pointer ${
                            (rwandaData.cardSide || "front") === "front"
                              ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Front Side
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRwanda("cardSide", "back")}
                          className={`p-2 rounded border text-xs font-semibold cursor-pointer ${
                            rwandaData.cardSide === "back"
                              ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Back Side
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRwanda("cardSide", "both")}
                          className={`p-2 rounded border text-xs font-semibold cursor-pointer ${
                            rwandaData.cardSide === "both"
                              ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Both Sides
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nigeria-specific interactive fields */}
              {isNigeria && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Passport Data Fields</span>
                    <button
                      type="button"
                      onClick={resetNigeriaToDefault}
                      className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={randomizeSpecimen}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-700/25 hover:shadow-indigo-700/40 border-2 border-indigo-300/40 flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 text-lg group-hover:rotate-180 transition-transform duration-500 shadow-inner shrink-0">
                      <Dices size={20} />
                    </div>
                    <div className="text-left">
                      <div className="leading-none text-sm font-extrabold flex items-center gap-2">
                        <span>Randomize Card</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider shadow-xs">INSTANT FILL</span>
                      </div>
                      <div className="text-[11px] font-normal text-indigo-100 opacity-90 mt-0.5">Generate fictional Nigerian passport sample data &amp; MRZ</div>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Surname / Nom
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={nigeriaData.surname}
                        onChange={(e) => updateNigeria("surname", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Given Names / Prénoms
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={nigeriaData.givenNames}
                        onChange={(e) => updateNigeria("givenNames", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Passport No. / N° Passeport
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={nigeriaData.passportNo}
                        onChange={(e) => updateNigeria("passportNo", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Nationality / Nationalité
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.nationality}
                        onChange={(e) => updateNigeria("nationality", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Birth / Date de Naissance
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.dateOfBirth}
                        onChange={(e) => updateNigeria("dateOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Sex / Sexe
                      <select
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.sex}
                        onChange={(e) => updateNigeria("sex", e.target.value as 'M' | 'F')}
                      >
                        <option value="M">M - Male</option>
                        <option value="F">F - Female</option>
                      </select>
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Place of Birth / Lieu de Naissance
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.placeOfBirth}
                        onChange={(e) => updateNigeria("placeOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Previous Passport / Passeport Précédent
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.previousPassportNo}
                        onChange={(e) => updateNigeria("previousPassportNo", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      NIN
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.nin}
                        onChange={(e) => updateNigeria("nin", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Authority / Autorité
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.authority}
                        onChange={(e) => updateNigeria("authority", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Issue / Date de Délivrance
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.dateOfIssue}
                        onChange={(e) => updateNigeria("dateOfIssue", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Expiry / Date d&apos;Expiration
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={nigeriaData.dateOfExpiry}
                        onChange={(e) => updateNigeria("dateOfExpiry", e.target.value.toUpperCase())}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Ethiopia-specific interactive fields */}
              {isEthiopia && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Passport Data Fields</span>
                    <button
                      type="button"
                      onClick={resetEthiopiaToDefault}
                      className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={randomizeSpecimen}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-700/25 hover:shadow-indigo-700/40 border-2 border-indigo-300/40 flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 text-lg group-hover:rotate-180 transition-transform duration-500 shadow-inner shrink-0">
                      <Dices size={20} />
                    </div>
                    <div className="text-left">
                      <div className="leading-none text-sm font-extrabold flex items-center gap-2">
                        <span>Randomize Card</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider shadow-xs">INSTANT FILL</span>
                      </div>
                      <div className="text-[11px] font-normal text-indigo-100 opacity-90 mt-0.5">Generate fictional Ethiopian passport sample data &amp; MRZ</div>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Surname (English)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={ethiopiaData.surname}
                        onChange={(e) => updateEthiopia("surname", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Surname (Amharic / የአባት ስም)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.surnameAmharic}
                        onChange={(e) => updateEthiopia("surnameAmharic", e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Given Name (English)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={ethiopiaData.givenNames}
                        onChange={(e) => updateEthiopia("givenNames", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Given Name (Amharic / ስም)
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.givenNameAmharic}
                        onChange={(e) => updateEthiopia("givenNameAmharic", e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Passport No. / ፓስፖርት ቁ.
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={ethiopiaData.passportNo}
                        onChange={(e) => updateEthiopia("passportNo", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Nationality / ዜግነት
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.nationality}
                        onChange={(e) => updateEthiopia("nationality", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Birth / የትውልድ ቀን
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.dateOfBirth}
                        onChange={(e) => updateEthiopia("dateOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Sex / ፆታ
                      <select
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.sex}
                        onChange={(e) => updateEthiopia("sex", e.target.value as 'M' | 'F')}
                      >
                        <option value="F">F - Female</option>
                        <option value="M">M - Male</option>
                      </select>
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Place of Birth / የትውልድ ቦታ
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.placeOfBirth}
                        onChange={(e) => updateEthiopia("placeOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Issue / የተሰጠበት ቀን
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.dateOfIssue}
                        onChange={(e) => updateEthiopia("dateOfIssue", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Expiry / የሚያበቃበት ቀን
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.dateOfExpiry}
                        onChange={(e) => updateEthiopia("dateOfExpiry", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Personal No. / መለያ ቁ.
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        placeholder="Optional"
                        value={ethiopiaData.personalNo || ""}
                        onChange={(e) => updateEthiopia("personalNo", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                      Issuing Authority / የሰጠው ባለስልጣን
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={ethiopiaData.issuingAuthority}
                        onChange={(e) => updateEthiopia("issuingAuthority", e.target.value.toUpperCase())}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Canada-specific interactive fields */}
              {isCanada && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Passport Data Fields</span>
                    <button
                      type="button"
                      onClick={resetCanadaToDefault}
                      className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={randomizeSpecimen}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-700/25 hover:shadow-indigo-700/40 border-2 border-indigo-300/40 flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 text-lg group-hover:rotate-180 transition-transform duration-500 shadow-inner shrink-0">
                      <Dices size={20} />
                    </div>
                    <div className="text-left">
                      <div className="leading-none text-sm font-extrabold flex items-center gap-2">
                        <span>Randomize Card</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider shadow-xs">INSTANT FILL</span>
                      </div>
                      <div className="text-[11px] font-normal text-indigo-100 opacity-90 mt-0.5">Generate fictional Canadian passport sample data &amp; MRZ</div>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Surname / Nom
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={canadaData.surname}
                        onChange={(e) => updateCanada("surname", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Given names / Prénoms
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={canadaData.givenNames}
                        onChange={(e) => updateCanada("givenNames", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Passport No. / N° de passeport
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                        value={canadaData.passportNo}
                        onChange={(e) => updateCanada("passportNo", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Nationality / Nationalité
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.nationality}
                        onChange={(e) => updateCanada("nationality", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Birth
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.dateOfBirth}
                        onChange={(e) => updateCanada("dateOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Sex / Sexe
                      <select
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.sex}
                        onChange={(e) => updateCanada("sex", e.target.value)}
                      >
                        <option value="F/F">F/F (Female)</option>
                        <option value="M/M">M/M (Male)</option>
                        <option value="X/X">X/X (Unspecified)</option>
                      </select>
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Place of Birth
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.placeOfBirth}
                        onChange={(e) => updateCanada("placeOfBirth", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Issuing Authority
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.authority}
                        onChange={(e) => updateCanada("authority", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Issue
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.dateOfIssue}
                        onChange={(e) => updateCanada("dateOfIssue", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Date of Expiry
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.dateOfExpiry}
                        onChange={(e) => updateCanada("dateOfExpiry", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Barcode / OVD Code
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.barcodeCode}
                        onChange={(e) => updateCanada("barcodeCode", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Signature Name
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={canadaData.signatureText}
                        onChange={(e) => updateCanada("signatureText", e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Ghana-specific interactive fields */}
              {isGhana && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Passport Data Fields</span>
                    <button
                      type="button"
                      onClick={resetGhanaToDefault}
                      className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={randomizeSpecimen}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-700/25 hover:shadow-indigo-700/40 border-2 border-indigo-300/40 flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 text-lg group-hover:rotate-180 transition-transform duration-500 shadow-inner shrink-0">
                      <Dices size={20} />
                    </div>
                    <div className="text-left">
                      <div className="leading-none text-sm font-extrabold flex items-center gap-2">
                        <span>Randomize Card</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider shadow-xs">INSTANT FILL</span>
                      </div>
                      <div className="text-[11px] font-normal text-indigo-100 opacity-90 mt-0.5">Generate fictional Ghanaian passport sample data &amp; MRZ</div>
                    </div>
                  </button>
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
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Passport Data Fields</span>
                    <button
                      type="button"
                      onClick={resetBangladeshToDefault}
                      className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={randomizeSpecimen}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-700/25 hover:shadow-indigo-700/40 border-2 border-indigo-300/40 flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 text-lg group-hover:rotate-180 transition-transform duration-500 shadow-inner shrink-0">
                      <Dices size={20} />
                    </div>
                    <div className="text-left">
                      <div className="leading-none text-sm font-extrabold flex items-center gap-2">
                        <span>Randomize Card</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider shadow-xs">INSTANT FILL</span>
                      </div>
                      <div className="text-[11px] font-normal text-indigo-100 opacity-90 mt-0.5">Generate fictional Bangladeshi passport sample data &amp; MRZ</div>
                    </div>
                  </button>
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
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Previous Passport No.
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.previousPassportNo}
                        onChange={(e) => updateBangladesh("previousPassportNo", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Booklet Serial No.
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.bookletSerial}
                        onChange={(e) => updateBangladesh("bookletSerial", e.target.value)}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Father&apos;s Name
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.fatherName}
                        onChange={(e) => updateBangladesh("fatherName", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Mother&apos;s Name
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.motherName}
                        onChange={(e) => updateBangladesh("motherName", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Spouse&apos;s Name
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        placeholder="Optional"
                        value={bangladeshData.spouseName}
                        onChange={(e) => updateBangladesh("spouseName", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                      Emergency Relationship
                      <input
                        className="p-2 border rounded border-slate-300 text-xs font-mono"
                        value={bangladeshData.emergencyRelationship}
                        onChange={(e) => updateBangladesh("emergencyRelationship", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                      Permanent Address (Lines 1 & 2)
                      <div className="flex flex-col gap-1.5">
                        <input
                          className="p-2 border rounded border-slate-300 text-xs font-mono"
                          value={bangladeshData.permanentAddress1}
                          onChange={(e) => updateBangladesh("permanentAddress1", e.target.value.toUpperCase())}
                        />
                        <input
                          className="p-2 border rounded border-slate-300 text-xs font-mono"
                          value={bangladeshData.permanentAddress2}
                          onChange={(e) => updateBangladesh("permanentAddress2", e.target.value.toUpperCase())}
                        />
                      </div>
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
                    <label className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                      Emergency Address (Lines 1 & 2)
                      <div className="flex flex-col gap-1.5">
                        <input
                          className="p-2 border rounded border-slate-300 text-xs font-mono"
                          value={bangladeshData.emergencyAddress1}
                          onChange={(e) => updateBangladesh("emergencyAddress1", e.target.value.toUpperCase())}
                        />
                        <input
                          className="p-2 border rounded border-slate-300 text-xs font-mono"
                          value={bangladeshData.emergencyAddress2}
                          onChange={(e) => updateBangladesh("emergencyAddress2", e.target.value.toUpperCase())}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Interactive Document Data Fields + Randomize for all other countries (UGA, KEN, SEN, DRC, RSA, PNG) */}
              {!isNigeria && !isEthiopia && !isCanada && !isGhana && !isBangladesh && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Document Data Fields</span>
                    <button
                      type="button"
                      onClick={resetOtherToDefault}
                      className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset to Specimen
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={randomizeSpecimen}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-700/25 hover:shadow-indigo-700/40 border-2 border-indigo-300/40 flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300 text-lg group-hover:rotate-180 transition-transform duration-500 shadow-inner shrink-0">
                      <Dices size={20} />
                    </div>
                    <div className="text-left">
                      <div className="leading-none text-sm font-extrabold flex items-center gap-2">
                        <span>Randomize Card</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider shadow-xs">INSTANT FILL</span>
                      </div>
                      <div className="text-[11px] font-normal text-indigo-100 opacity-90 mt-0.5">Generate fictional {country} sample document data &amp; MRZ</div>
                    </div>
                  </button>
                  {(() => {
                    const currentDoc = otherData[country] || defaultOtherCountryData[country] || defaultOtherCountryData.UGA
                    return (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Surname
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                            value={currentDoc.surname}
                            onChange={(e) => updateOtherCountry("surname", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Given Names
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                            value={currentDoc.givenNames}
                            onChange={(e) => updateOtherCountry("givenNames", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Document / Passport No.
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono font-bold"
                            value={currentDoc.documentNo}
                            onChange={(e) => updateOtherCountry("documentNo", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Personal / NIN No.
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono"
                            value={currentDoc.personalNo}
                            onChange={(e) => updateOtherCountry("personalNo", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Nationality
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono"
                            value={currentDoc.nationality}
                            onChange={(e) => updateOtherCountry("nationality", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Sex
                          <select
                            className="p-2 border rounded border-slate-300 text-xs font-mono"
                            value={currentDoc.sex}
                            onChange={(e) => updateOtherCountry("sex", e.target.value)}
                          >
                            <option value="M">M - Male</option>
                            <option value="F">F - Female</option>
                          </select>
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Date of Birth
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono"
                            value={currentDoc.dateOfBirth}
                            onChange={(e) => updateOtherCountry("dateOfBirth", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Place of Birth
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono"
                            value={currentDoc.placeOfBirth}
                            onChange={(e) => updateOtherCountry("placeOfBirth", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Date of Issue
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono"
                            value={currentDoc.dateOfIssue}
                            onChange={(e) => updateOtherCountry("dateOfIssue", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-1 flex flex-col gap-1 text-slate-600 font-semibold">
                          Date of Expiry
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono"
                            value={currentDoc.dateOfExpiry}
                            onChange={(e) => updateOtherCountry("dateOfExpiry", e.target.value.toUpperCase())}
                          />
                        </label>
                        <label className="col-span-2 flex flex-col gap-1 text-slate-600 font-semibold">
                          Issuing Authority
                          <input
                            className="p-2 border rounded border-slate-300 text-xs font-mono"
                            value={currentDoc.authority}
                            onChange={(e) => updateOtherCountry("authority", e.target.value.toUpperCase())}
                          />
                        </label>
                      </div>
                    )
                  })()}
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
              <div className="preview-heading"><div><h2>Live preview</h2><p>This is what applicants will see.</p></div><div className="device-toggle"><button type="button" onClick={randomizeSpecimen} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 mr-1 cursor-pointer"><RefreshCw size={13} /> Randomize</button><button className="selected">Desktop</button><button>Mobile</button></div></div>
              <div
                className={`preview-frame ${isPreviewBlurred ? "kyc-react-blurred" : ""}`}
                onContextMenu={(e) => {
                  e.preventDefault()
                  reportSecurityEvent("contextmenu_blocked", "Right-click context menu disabled on KYC preview")
                }}
                onCopy={(e) => {
                  e.preventDefault()
                  reportSecurityEvent("copy_blocked", "Copying sensitive KYC verification data is disabled")
                }}
                onCut={(e) => {
                  e.preventDefault()
                  reportSecurityEvent("cut_blocked", "Cutting sensitive KYC verification data is disabled")
                }}
                onDragStart={(e) => {
                  e.preventDefault()
                  reportSecurityEvent("drag_blocked", "Dragging KYC specimen assets is disabled")
                }}
              >
                <div className="preview-browser"><span /><span /><span /><small>verify.kyc.app/passport</small></div>
                <div className="preview-page" style={previewStyle}>
                  <div className="preview-nav"><div className="preview-logo"><div className="logo-shield"><ShieldCheck size={14} /></div><strong>KYC Verify</strong></div><span>Need help?</span></div>
                  <div className="verification-card">
                    <div className="card-icon"><FileText size={24} /></div>
                    <div className="step-label">STEP 1 OF 3</div>
                    <h3>{content.title}</h3>
                    <p>{content.subtitle}</p>

                    {securityNotice && (
                      <div className="mt-2 mb-1 px-2.5 py-1.5 rounded bg-amber-950/90 border border-amber-500/40 text-amber-200 text-[10px] font-mono">
                        {securityNotice}
                      </div>
                    )}

                    {/* Passport Card View */}
                    <div className="document-placeholder static-passport relative overflow-hidden">
                      <div className="kyc-react-watermark-layer" aria-hidden="true">
                        {[0, 1, 2].map((idx) => (
                          <div
                            key={idx}
                            className="kyc-react-wm-item"
                            style={{
                              top: `${16 + idx * 30 + ((watermarkTick + idx) % 3)}%`,
                              left: `${8 + idx * 14 + ((watermarkTick * 2 + idx) % 5)}%`,
                              transform: `rotate(${-15 + ((watermarkTick + idx) % 3)}deg)`,
                            }}
                          >
                            {shortSessionId} • {watermarkTimestamp}
                          </div>
                        ))}
                      </div>
                      {isRwanda ? (
                        <div className="w-full max-w-[360px] mx-auto my-1">
                          <RwandaIdCard
                            data={rwandaData}
                            onSideChange={(side) => updateRwanda("cardSide", side)}
                          />
                        </div>
                      ) : isNigeria ? (
                        <div className="w-full max-w-[340px] mx-auto my-1">
                          <NigeriaPassportCard data={nigeriaData} />
                        </div>
                      ) : isEthiopia ? (
                        <div className="w-full max-w-[340px] mx-auto my-1">
                          <EthiopiaPassportCard data={ethiopiaData} />
                        </div>
                      ) : isCanada ? (
                        <div className="w-full max-w-[340px] mx-auto my-1">
                          <CanadaPassportCard data={canadaData} />
                        </div>
                      ) : isGhana ? (
                        <div className="w-full max-w-[340px] mx-auto my-1">
                          <GhanaPassportCard data={ghanaData} />
                        </div>
                      ) : isBangladesh ? (
                        <div className="w-full max-w-[340px] mx-auto my-1">
                          <BangladeshPassportCard data={bangladeshData} />
                        </div>
                      ) : (
                        <div className="relative w-full mx-auto">
                          <img className="passport-reference-image" src={specimenImage} alt={specimenAlt} />
                          {(() => {
                            const currentDoc = otherData[country] || defaultOtherCountryData[country] || defaultOtherCountryData.UGA
                            return (
                              <div className="mt-2 p-2.5 rounded bg-slate-900/95 text-white text-left font-mono text-[10px] leading-snug shadow-lg border border-slate-700">
                                <div className="flex items-center justify-between text-emerald-400 font-bold mb-1 border-b border-slate-700 pb-1">
                                  <span>LIVE SPECIMEN DATA ({country})</span>
                                  <span>NO: {currentDoc.documentNo}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                  <div><span className="text-slate-400">SURNAME:</span> {currentDoc.surname}</div>
                                  <div><span className="text-slate-400">GIVEN:</span> {currentDoc.givenNames}</div>
                                  <div><span className="text-slate-400">DOB:</span> {currentDoc.dateOfBirth}</div>
                                  <div><span className="text-slate-400">SEX / NAT:</span> {currentDoc.sex} / {currentDoc.nationality}</div>
                                  <div><span className="text-slate-400">NIN/ID:</span> {currentDoc.personalNo}</div>
                                  <div><span className="text-slate-400">EXPIRY:</span> {currentDoc.dateOfExpiry}</div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                      <div className="placeholder-copy">
                        <strong>{specimenLabel}</strong>
                        <span>
                          {isNigeria || isEthiopia || isCanada || isGhana || isBangladesh
                            ? "Authentic 2-page e-Passport spread with live interactive field and MRZ updates."
                            : "Interactive specimen reference with live field and randomize support."}
                        </span>
                        <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-slate-200/80 w-full">
                          <button
                            type="button"
                            onClick={randomizeSpecimen}
                            className="text-[11px] flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shadow-xs cursor-pointer"
                          >
                            <RefreshCw size={12} /> Randomize {country}
                          </button>
                          <button
                            type="button"
                            onClick={resetCurrentCountry}
                            className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                          >
                            <RotateCcw size={12} /> Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    {detectedText && (
                      <section className="detected-text" aria-live="polite">
                        <div className="detected-text-heading"><strong>Detected specimen text</strong><span>OCR preview</span></div>
                        <div className="detected-text-list">{detectedText.map((line) => <span key={line}>{line}</span>)}</div>
                      </section>
                    )}

                    <button type="button" onClick={triggerCountryOgadsLocker} className="preview-primary" style={{ backgroundColor: content.accent }}>{content.button}<span aria-hidden="true">→</span></button>
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
