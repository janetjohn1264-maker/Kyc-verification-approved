/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, FileText, LayoutDashboard, LogOut, Menu, Save, Settings, ShieldCheck, Upload, UserRound, X } from "lucide-react"

const defaultContent = {
  title: "DR Congo Passport Verification",
  subtitle: "Securely verify identity documents in a few simple steps.",
  button: "Start verification",
  accent: "#2563eb",
}

function App() {
  const [content, setContent] = useState(defaultContent)
  const [saved, setSaved] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [detectedText, setDetectedText] = useState<string[] | null>(null)
  const [country, setCountry] = useState("DRC")

  const update = (key: keyof typeof defaultContent, value: string) => {
    setDetectedText(null)
    setSaved(false)
    setContent((current) => ({ ...current, [key]: value }))
  }

  const previewStyle = useMemo(() => ({ "--accent": content.accent } as React.CSSProperties), [content.accent])
  const isSouthAfrica = country === "RSA"
  const specimenImage = isSouthAfrica ? "/assets/aistudio/south_africa_identity_card_reference.jpeg" : "/assets/aistudio/drc_passport_reference.jpg"
  const specimenAlt = isSouthAfrica ? "Static Republic of South Africa identity card reference specimen" : "Static Democratic Republic of the Congo passport reference specimen"
  const specimenLabel = isSouthAfrica ? "South Africa identity card reference specimen" : "Passport reference specimen"

  const randomizeSpecimen = () => {
    setDetectedText(isSouthAfrica
      ? ["REPUBLIC OF SOUTH AFRICA", "IDENTITY CARD", "SURNAME: MASHEGO", "FORENAMES: REBECCA", "DATE OF BIRTH: 19/03/1984", "ID NUMBER: 930802 0123 08 7", "NATIONALITY: ZAF"]
      : ["REPUBLIC OF DEMOCRATIC CONGO", "PASSPORT / PASSEPORT", "SURNAME: MINAFFET", "GIVEN NAMES: ESTHER NADINE", "NATIONALITY: CONGOLAISE", "DATE OF BIRTH: 02/08/1991", "PASSPORT NO: DEMO-044743"])
    document.getElementById("passport-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })
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
          <section className="page-heading"><div><p className="eyebrow">VERIFICATION FLOW</p><h1>Passport verification</h1><p className="heading-copy">Edit your verification screen and see changes instantly in the live preview.</p></div><div className="heading-actions"><button className="randomize-button" onClick={randomizeSpecimen}><FileText size={17} /> Randomize</button><button className={`save-button ${saved ? "saved" : ""}`} onClick={() => setSaved(true)}><Save size={17} /> {saved ? "Changes saved" : "Save changes"}</button></div></section>

          <div className="editor-layout" id="passport-editor">
            <section className="editor-panel" aria-label="Editor controls">
              <div className="panel-header"><div><h2>Screen content</h2><p>Customize the content shown to applicants.</p></div><span className="live-pill"><span /> Live</span></div>
              <div className="form-stack">
                <label>Country / document<select value={country} onChange={(event) => { setCountry(event.target.value); setDetectedText(null) }}><option value="DRC">Democratic Republic of the Congo — Passport</option><option value="RSA">Republic of South Africa — Identity card</option></select></label>
                <label>Screen title<input value={content.title} onChange={(event) => update("title", event.target.value)} /></label>
                <label>Description<textarea rows={3} value={content.subtitle} onChange={(event) => update("subtitle", event.target.value)} /></label>
                <label>Primary button label<input value={content.button} onChange={(event) => update("button", event.target.value)} /></label>
                <label>Accent color<div className="color-input"><input type="color" value={content.accent} onChange={(event) => update("accent", event.target.value)} /><input value={content.accent} onChange={(event) => update("accent", event.target.value)} aria-label="Accent color hex value" /></div></label>
              </div>
              <div className="upload-section"><div className="section-label">Passport sample <span>Optional</span></div><div className="upload-box"><div className="upload-icon"><Upload size={17} /></div><div><strong>Upload a sample document</strong><span>PNG, JPG or PDF up to 10 MB</span></div><button>Browse</button></div></div>
              <div className="editor-note"><CheckCircle2 size={17} /><span>Your changes are reflected in the preview automatically.</span></div>
            </section>

            <section className="preview-column"><div className="preview-heading"><div><h2>Live preview</h2><p>This is what applicants will see.</p></div><div className="device-toggle"><button className="selected">Desktop</button><button>Mobile</button></div></div><div className="preview-frame"><div className="preview-browser"><span /><span /><span /><small>verify.kyc.app/passport</small></div><div className="preview-page" style={previewStyle}><div className="preview-nav"><div className="preview-logo"><div className="logo-shield"><ShieldCheck size={14} /></div><strong>KYC Verify</strong></div><span>Need help?</span></div><div className="verification-card"><div className="card-icon"><FileText size={24} /></div><div className="step-label">STEP 1 OF 3</div><h3>{content.title}</h3><p>{content.subtitle}</p><div className="document-placeholder static-passport"><img className="passport-reference-image" src={specimenImage} alt={specimenAlt} /><div className="placeholder-copy"><strong>{specimenLabel}</strong><span>This static reference is preserved exactly as provided.</span></div></div>{detectedText && <section className="detected-text" aria-live="polite"><div className="detected-text-heading"><strong>Detected specimen text</strong><span>OCR preview</span></div><div className="detected-text-list">{detectedText.map((line) => <span key={line}>{line}</span>)}</div></section>}<button className="preview-primary" style={{ backgroundColor: content.accent }}>{content.button}<span aria-hidden="true">→</span></button><div className="secure-note"><ShieldCheck size={14} /> Your information is encrypted and secure</div></div><div className="preview-footer">KYC Verify <span>Privacy</span><span>Terms</span></div></div></div></section>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
