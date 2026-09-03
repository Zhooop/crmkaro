"use client";

import { useState, useRef, useEffect } from "react";

export interface LandingPageProps {
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onDashboardClick?: () => void;
  isAuthenticated?: boolean;
}

/* =========================================================================
   PROFESSIONAL VECTOR SVG ICONS (ZERO EMOJIS)
   ========================================================================= */

function IconGoogle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
        fill="#EA4335"
      />
    </svg>
  );
}

function IconMeta({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8.6c1.6-2.5 3.5-3.6 5.5-3.6 3.5 0 6.5 2.8 6.5 7 0 4.2-3 7-6.5 7-2.3 0-4.2-1.3-5.5-3.5-1.3 2.2-3.2 3.5-5.5 3.5-3.5 0-6.5-2.8-6.5-7 0-4.2 3-7 6.5-7 2 0 3.9 1.1 5.5 3.6zm0 4.8c1.3 2.3 2.9 3.6 4.5 3.6 2.2 0 4-1.8 4-4.8 0-3-1.8-4.8-4-4.8-1.6 0-3.2 1.3-4.5 3.6v2.4zm0-2.4c-1.3-2.3-2.9-3.6-4.5-3.6-2.2 0-4 1.8-4 4.8 0 3 1.8 4.8 4 4.8 1.6 0 3.2-1.3 4.5-3.6v-2.4z"
        fill="#0668E1"
      />
    </svg>
  );
}

function IconWhatsApp({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.979-.275-.1-.476-.15-.677.15-.201.301-.777.979-.953 1.18-.175.201-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.895-.798-1.5-1.784-1.675-2.085-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.15-.175.201-.301.301-.501.101-.201.05-.376-.025-.527-.075-.15-.677-1.632-.928-2.235-.244-.588-.493-.508-.677-.518-.175-.008-.376-.01-.577-.01s-.527.075-.802.376c-.275.301-1.053 1.029-1.053 2.509s1.078 2.91 1.228 3.111c.15.201 2.122 3.241 5.141 4.545.718.31 1.279.496 1.716.635.722.23 1.379.197 1.898.12.579-.087 1.78-.727 2.031-1.429.251-.702.251-1.304.175-1.429-.075-.125-.276-.201-.577-.351z"
        fill="#25D366"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.05 21.95l4.908-1.288A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2a8.17 8.17 0 0 1-4.223-1.168l-.303-.18-2.91.764.777-2.836-.197-.314A8.183 8.183 0 0 1 3.8 12c0-4.529 3.671-8.2 8.2-8.2s8.2 3.671 8.2 8.2-3.671 8.2-8.2 8.2z"
        fill="#25D366"
      />
    </svg>
  );
}

function IconRazorpay({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.436 0l-11.91 14.156h6.467L9.845 24l12.591-14.935h-6.467L22.436 0z"
        fill="#0C2340"
      />
      <path
        d="M8.28 0L1.564 12.378h5.367L3.08 24l11.4-12.378H8.81L14.747 0H8.28z"
        fill="#0284C7"
      />
    </svg>
  );
}

function IconMail({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M22 6L12 13 2 6" />
    </svg>
  );
}

function IconPhonePe({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#5F259F" />
      <path
        d="M16.5 8.5H13V6H11v2.5H8v2h3v3.5c0 1.5 1 2.5 2.5 2.5h2v-2h-1.5c-.3 0-.5-.2-.5-.5v-3.5h3.5v-2z"
        fill="#ffffff"
      />
    </svg>
  );
}

function IconLead({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function IconCall({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconGraduation({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function IconReceipt({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  );
}

function IconPayroll({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconZap({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconBuilding({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="9" y1="6" x2="9" y2="6.01" />
      <line x1="15" y1="6" x2="15" y2="6.01" />
      <line x1="9" y1="10" x2="9" y2="10.01" />
      <line x1="15" y1="10" x2="15" y2="10.01" />
      <line x1="9" y1="14" x2="9" y2="14.01" />
      <line x1="15" y1="14" x2="15" y2="14.01" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}

function IconRocket({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6.05 11a22.35 22.35 0 0 1-3.95 2z" />
    </svg>
  );
}

function IconFactory({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20V8l-6 4V8l-6 4V4L2 8v12z" />
      <rect x="6" y="14" width="3" height="3" />
      <rect x="15" y="14" width="3" height="3" />
    </svg>
  );
}

/* =========================================================================
   SOLUTIONS DATA (PROFESSIONAL LABELS, ZERO EMOJIS)
   ========================================================================= */

const SOLUTIONS = [
  {
    id: "academy",
    tabLabel: "Coaching & Academies",
    title: "Complete Academic Fee & Batch Management",
    desc: "Designed specifically for Indian tuition centres, coaching institutes, and schools. Track 12-month academic sessions, manage student roll numbers, record daily attendance, and send fee receipts directly to parents on WhatsApp.",
    bullets: [
      "12-Month Academic Fee Cycle (April to March session)",
      "Instant WhatsApp PDF fee receipts with 1-click sharing",
      "Batch rosters & 1-click daily attendance marking",
      "Pending fees auto-calculation with zero manual math"
    ],
    image: "/landing/feature-batches-attendance.jpg",
    ctaLabel: "Start Academy Workspace Free"
  },
  {
    id: "studio",
    tabLabel: "Studios & Fitness Gyms",
    title: "Frictionless Memberships & Quick Collect",
    desc: "Collect monthly & quarterly membership fees in seconds. Accept UPI payments on the spot with QR codes, record instant cash collections, and trigger automatic renewal reminders.",
    bullets: [
      "UPI & Cash Quick Collect in under 10 seconds",
      "Member attendance & active subscription status",
      "Instant digital payment receipts with your custom logo",
      "Never chase renewals manually again"
    ],
    image: "/landing/feature-collect-fees.png",
    ctaLabel: "Start Studio Workspace Free"
  },
  {
    id: "crm",
    tabLabel: "Services & Agencies",
    title: "Visual Lead Pipeline & Follow-up Reminders",
    desc: "Turn every inquiry into a paying client. Manage leads across visual Kanban stages, schedule follow-up phone call reminders, record notes, and generate GST compliant invoices.",
    bullets: [
      "Visual drag-and-drop Lead Kanban Pipeline",
      "Daily follow-up reminders so no lead is forgotten",
      "Lead conversion analytics & source tracking",
      "GST & Non-GST tax invoicing with itemized billing"
    ],
    image: "/landing/feature-leads-crm.jpg",
    ctaLabel: "Start Lead CRM Free"
  },
  {
    id: "payroll",
    tabLabel: "Staff Salaries & HR",
    title: "Transparent Salaries & 1-Click Payslips",
    desc: "Manage teachers, instructors, and operational staff in one clean portal. Define base salaries, track monthly advances & deductions, and disburse payslips with complete transparency.",
    bullets: [
      "Monthly salary structures with custom allowances",
      "Advance salary & deduction tracking",
      "1-Click payroll runs with downloadable salary slips",
      "Audit-proof staff compensation records"
    ],
    image: "/landing/feature-staff-payroll.png",
    ctaLabel: "Start Staff Payroll Free"
  }
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    Icon: IconLead,
    title: "Capture Inquiries",
    desc: "Auto-sync prospective leads from Meta Ads, Google Ads, and walk-ins into CRM.",
    tag: "Instant Lead Sync"
  },
  {
    step: "02",
    Icon: IconCall,
    title: "Smart Follow-Up",
    desc: "1-Click call reminders and pipeline stages so zero inquiries are ever forgotten.",
    tag: "3x Higher Conversion"
  },
  {
    step: "03",
    Icon: IconGraduation,
    title: "1-Click Admission",
    desc: "Convert leads into active students or members with roll numbers and batch assignments.",
    tag: "Batch Enrollment"
  },
  {
    step: "04",
    Icon: IconReceipt,
    title: "Fees & WhatsApp Bill",
    desc: "Collect UPI/Cash with automatic branded PDF receipts sent directly to parents on WhatsApp.",
    tag: "WhatsApp Sharing"
  },
  {
    step: "05",
    Icon: IconPayroll,
    title: "Salaries & Profits",
    desc: "Auto-generate staff salary slips, track daily kharcha, and view real-time net business profit.",
    tag: "Audit-Proof Ledger"
  }
];

const FAQS = [
  {
    q: "Kya CRMKaro mere mobile phone par chalega ya laptop zaroori hai?",
    a: "CRMKaro 100% responsive hai aur aapke Android ya iPhone ke browser me ekdam app jaisa chalta hai. Aap fees collect karna, WhatsApp receipt bhejna aur daily attendance mark karna seedha apne mobile se kar sakte hain."
  },
  {
    q: "Kya mai student aur customer ko WhatsApp par direct receipt bhej sakta hoon?",
    a: "Haan! Quick Collect ya Invoice create hote hi 'Share on WhatsApp' button par click karte hi student ya customer ke WhatsApp par unke naam, payment details aur PDF receipt link ke sath formatted message chala jata hai."
  },
  {
    q: "Kya mai apna puraana Excel data CRMKaro me laa sakta hoon?",
    a: "Haan, aap 1-click me apne puraane students, contacts ya leads ka Excel/CSV upload karke sab kuch import kar sakte hain bina kisi manual typing ke."
  },
  {
    q: "Mera business data kitna safe aur private hai?",
    a: "Aapka data 100% encrypted aur PostgreSQL isolated architecture par chalte hue safe rehta hai. Har business ka data completely separated hota hai aur automatic daily cloud backups hote hain."
  },
  {
    q: "Kya trial period ke liye mujhe Credit Card dena hoga?",
    a: "Bilkul nahi! 14-day free trial shuru karne ke liye koi Credit Card ya payment info nahi chahiye. Bas signup karein aur 30 seconds me start karein."
  }
];

export function LandingPage({
  onLoginClick,
  onRegisterClick,
  onDashboardClick,
  isAuthenticated = false,
}: LandingPageProps) {
  const [selectedSolution, setSelectedSolution] = useState<string>("academy");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const circuitSectionRef = useRef<HTMLDivElement>(null);
  const [circuitProgress, setCircuitProgress] = useState<number>(0.15);
  const [seg1Progress, setSeg1Progress] = useState<number>(0.2);
  const [seg2Progress, setSeg2Progress] = useState<number>(0.2);
  const [seg3Progress, setSeg3Progress] = useState<number>(0.2);
  const [step4Active, setStep4Active] = useState<boolean>(false);
  const [selectedDemoCat, setSelectedDemoCat] = useState<string>("coaching");

  useEffect(() => {
    const handleScroll = () => {
      if (!circuitSectionRef.current) return;
      const vh = window.innerHeight;

      const card1 = circuitSectionRef.current.querySelector('.lp-row-left .lp-circuit-card');
      const card2 = circuitSectionRef.current.querySelector('.lp-row-right .lp-circuit-card');
      const card3 = circuitSectionRef.current.querySelector('.lp-circuit-box-wrapper');
      const card4 = circuitSectionRef.current.querySelector('.lp-circuit-card-engine');

      if (card1) {
        const r1 = card1.getBoundingClientRect();
        const p1 = Math.min(1, Math.max(0, (vh * 0.75 - r1.bottom) / (vh * 0.35)));
        setSeg1Progress(p1);
      }

      if (card2) {
        const r2 = card2.getBoundingClientRect();
        const p2 = Math.min(1, Math.max(0, (vh * 0.75 - r2.bottom) / (vh * 0.35)));
        setSeg2Progress(p2);
      }

      if (card3 && card4) {
        const r3 = card3.getBoundingClientRect();
        const r4 = card4.getBoundingClientRect();
        const p3 = Math.min(1, Math.max(0, (vh * 0.85 - r3.bottom) / (vh * 0.30)));
        setSeg3Progress(p3);
        setStep4Active(r4.top <= vh * 0.85);
      }

      const rect = circuitSectionRef.current.getBoundingClientRect();
      const totalDist = rect.height - vh * 0.3;
      const currentDist = vh * 0.75 - rect.top;
      const progress = Math.min(1, Math.max(0, currentDist / totalDist));
      setCircuitProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const activeSolution = SOLUTIONS.find((s) => s.id === selectedSolution) ?? SOLUTIONS[0]!;

  const handleLogin = () => {
    if (onLoginClick) onLoginClick();
    else if (typeof window !== "undefined") window.open("/login", "_blank", "noopener,noreferrer");
  };

  const handleRegister = () => {
    if (onRegisterClick) onRegisterClick();
    else if (typeof window !== "undefined") window.open("/login?mode=register", "_blank", "noopener,noreferrer");
  };

  const handleDashboard = () => {
    if (onDashboardClick) onDashboardClick();
    else if (typeof window !== "undefined") window.open("/", "_blank", "noopener,noreferrer");
  };

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    if (targetId === "#" || !targetId) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const element = document.querySelector(targetId);
    if (element) {
      const headerOffset = 90;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="lp-wrap">
      {/* AMBIENT LIGHTING MESH & FLOATING CLOUD LIGHTS */}
      <div className="lp-aurora-bg">
        <div className="lp-ambient-mesh" />
        <div className="lp-cloud lp-cloud-1" />
        <div className="lp-cloud lp-cloud-2" />
        <div className="lp-cloud lp-cloud-3" />
        <div className="lp-cloud lp-cloud-4" />
      </div>

      {/* FLOATING CAPSULE NAVBAR */}
      <header className="lp-nav-outer">
        <div className="lp-nav-capsule">
          <a href="#" className="lp-brand" onClick={(e) => handleSmoothScroll(e, "#")}>
            <div className="lp-brand-logo">
              <img
                src="/brand/crmkaro-mark.png"
                alt="CRMKaro Logo"
                width={32}
                height={32}
              />
            </div>
            <span className="lp-brand-name">CRMKaro</span>
          </a>

          <nav className="lp-nav-menu">
            <a
              href="#pricing"
              className="lp-nav-item"
              onClick={(e) => handleSmoothScroll(e, "#pricing")}
            >
              Plans & Pricing
            </a>
            <a
              href="#workflow-timeline"
              className="lp-nav-item"
              onClick={(e) => handleSmoothScroll(e, "#workflow-timeline")}
            >
              How it Works
            </a>
            <a
              href="#features"
              className="lp-nav-item"
              onClick={(e) => handleSmoothScroll(e, "#features")}
            >
              Features
            </a>
            <a
              href="#faq"
              className="lp-nav-item"
              onClick={(e) => handleSmoothScroll(e, "#faq")}
            >
              FAQ
            </a>
          </nav>

          <div className="lp-nav-actions">
            {isAuthenticated ? (
              <button onClick={handleDashboard} className="lp-btn-capsule-primary" type="button">
                Open Dashboard →
              </button>
            ) : (
              <>
                <button onClick={handleLogin} className="lp-btn-capsule-login" type="button">
                  Log in
                </button>
                <button onClick={handleRegister} className="lp-btn-capsule-primary" type="button">
                  Get It Free — It's Free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 3 MONTHS FREE MARQUEE TICKER (OUTSIDE CARD, BELOW HEADER) */}
      <div className="lp-marquee-outer">
        <div className="lp-marquee-banner">
          <div className="lp-marquee-track">
            <div className="lp-marquee-content">
              <span className="lp-marquee-badge">SPECIAL OFFER</span>
              <span>USE CRMKARO COMPLETELY FREE FOR 3 MONTHS</span>
              <span className="lp-marquee-dot">✦</span>
              <span>ZERO SETUP CHARGES</span>
              <span className="lp-marquee-dot">✦</span>
              <span>NO CREDIT CARD REQUIRED</span>
              <span className="lp-marquee-dot">✦</span>
              <span>100% ACCESS TO BATCHES, FEES, LEADS & SALARIES</span>
              <span className="lp-marquee-dot">✦</span>
              <span className="lp-marquee-badge">SPECIAL OFFER</span>
              <span>USE CRMKARO COMPLETELY FREE FOR 3 MONTHS</span>
              <span className="lp-marquee-dot">✦</span>
              <span>ZERO SETUP CHARGES</span>
              <span className="lp-marquee-dot">✦</span>
              <span>NO CREDIT CARD REQUIRED</span>
              <span className="lp-marquee-dot">✦</span>
              <span>100% ACCESS TO BATCHES, FEES, LEADS & SALARIES</span>
              <span className="lp-marquee-dot">✦</span>
            </div>
            <div className="lp-marquee-content" aria-hidden="true">
              <span className="lp-marquee-badge">SPECIAL OFFER</span>
              <span>USE CRMKARO COMPLETELY FREE FOR 3 MONTHS</span>
              <span className="lp-marquee-dot">✦</span>
              <span>ZERO SETUP CHARGES</span>
              <span className="lp-marquee-dot">✦</span>
              <span>NO CREDIT CARD REQUIRED</span>
              <span className="lp-marquee-dot">✦</span>
              <span>100% ACCESS TO BATCHES, FEES, LEADS & SALARIES</span>
              <span className="lp-marquee-dot">✦</span>
              <span className="lp-marquee-badge">SPECIAL OFFER</span>
              <span>USE CRMKARO COMPLETELY FREE FOR 3 MONTHS</span>
              <span className="lp-marquee-dot">✦</span>
              <span>ZERO SETUP CHARGES</span>
              <span className="lp-marquee-dot">✦</span>
              <span>NO CREDIT CARD REQUIRED</span>
              <span className="lp-marquee-dot">✦</span>
              <span>100% ACCESS TO BATCHES, FEES, LEADS & SALARIES</span>
              <span className="lp-marquee-dot">✦</span>
            </div>
          </div>
        </div>
      </div>

      {/* HERO SECTION: EDITORIAL TYPOGRAPHY & FLOATING FROSTED GLASS */}
      <section className="lp-hero-container">
        <div className="lp-hero-card">
          <div className="lp-hero-top-row">
            <div className="lp-pill-chip">
              <span style={{ fontSize: 9 }}>●</span>
              <span>India's #1 Business Operating System</span>
            </div>
            <div className="lp-social-stars">
              <span className="lp-stars-badge">★★★★★</span>
              <span>4.9 / 5 Rating by 500+ Business Owners</span>
            </div>
          </div>

          <div className="lp-hero-grid">
            {/* Left Column */}
            <div className="lp-hero-left">
              <h1>
                Run Your Entire Business.{" "}
                <span className="cyan-highlight">Collect Fees in 1-Click.</span>
              </h1>

              {/* 4 KEY POINTS ARRANGE IN CLEAN GRID */}
              <div className="lp-hero-feature-points">
                <div className="lp-hero-point-item">
                  <div className="lp-point-icon-badge">
                    <IconGraduation size={16} />
                  </div>
                  <div className="lp-point-text">
                    <strong>Make Groups, Batches & Classes</strong>
                    <span>Organize division rosters & daily attendance</span>
                  </div>
                </div>

                <div className="lp-hero-point-item">
                  <div className="lp-point-icon-badge">
                    <IconReceipt size={16} />
                  </div>
                  <div className="lp-point-text">
                    <strong>Collect Fees in 1-Click</strong>
                    <span>Track who's paid & who's pending with WhatsApp bills</span>
                  </div>
                </div>

                <div className="lp-hero-point-item">
                  <div className="lp-point-icon-badge">
                    <IconLead size={16} />
                  </div>
                  <div className="lp-point-text">
                    <strong>Collect Leads for Telecallers</strong>
                    <span>Auto-sync inquiries & schedule follow-up call logs</span>
                  </div>
                </div>

                <div className="lp-hero-point-item">
                  <div className="lp-point-icon-badge">
                    <IconPayroll size={16} />
                  </div>
                  <div className="lp-point-text">
                    <strong>Salary Management System</strong>
                    <span>Teacher payouts, kharcha ledger & salary slips</span>
                  </div>
                </div>
              </div>

              {/* Single Solid Primary CTA */}
              <div className="lp-hero-ctas-row">
                <button onClick={handleRegister} className="lp-btn-hero-solid" type="button">
                  Claim 3 Months Free Access →
                </button>
              </div>
            </div>

            {/* Right Visual Frame with True Frosted Glass Floaters */}
            <div className="lp-hero-visual-frame">
              {/* Floating Frosted Glass Card 1 (Top Right) */}
              <div className="lp-glass-float lp-glass-float-top">
                <div className="lp-glass-chip-content">
                  <div className="lp-chip-icon-box lp-chip-icon-green">
                    <span style={{ fontWeight: 900, fontSize: 16 }}>₹</span>
                  </div>
                  <div className="lp-chip-meta">
                    <strong>₹1,25,000 Collected Today</strong>
                    <span>18 Invoices Paid · UPI & Cash</span>
                  </div>
                </div>
              </div>

              {/* Central Main Visual */}
              <div className="lp-hero-main-img">
                <img
                  src="/landing/hero-manage-everything.png"
                  alt="CRMKaro All-in-One Dashboard"
                  width={900}
                  height={560}
                  loading="eager"
                />
              </div>

              {/* Floating Frosted Glass Card 2 (Bottom Left) */}
              <div className="lp-glass-float lp-glass-float-bottom">
                <div className="lp-glass-chip-content">
                  <div className="lp-chip-icon-box lp-chip-icon-blue">
                    <IconWhatsApp size={20} />
                  </div>
                  <div className="lp-chip-meta">
                    <strong>WhatsApp Receipt Sent</strong>
                    <span>Ananya Sharma · Fees ₹3,200</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING (MOVED DIRECTLY BELOW HERO SECTION) */}
      <section id="pricing" className="lp-solution-section" style={{ margin: "56px auto 36px" }}>
        <div className="lp-section-center-head">
          <span className="lp-orbit-tag">Special Launch Offer</span>
          <h2>Transparent, Affordable Plans For Indian Businesses</h2>
          <p>No hidden setup costs. 3 Months completely free on all plans.</p>
        </div>

        <div className="lp-pricing-grid">
          {/* Free Starter */}
          <div className="lp-pricing-card">
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Starter Free</h3>
            <p style={{ fontSize: 13.5, color: "#bfdbfe", margin: 0 }}>For solo tutors & small businesses getting started.</p>
            <div className="lp-price-deal-wrap">
              <span className="lp-price-struck">₹0</span>
              <span className="lp-price-val-zero">₹0</span>
              <span className="lp-price-free-pill">FREE FOR 3 MONTHS</span>
            </div>
            <div className="lp-price-sub">100% Free · No credit card required</div>
            <div style={{ margin: "24px 0", flex: 1, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Up to 50 active students/clients</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>1-Click Quick Collect</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>WhatsApp receipt sharing</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>1 batch & attendance roster</span>
              </div>
            </div>
            <button onClick={handleRegister} className="lp-btn-hero-ghost" style={{ width: "100%", justifyContent: "center" }} type="button">
              Start 3 Months Free →
            </button>
          </div>

          {/* Growth Plan (Featured) */}
          <div className="lp-pricing-card featured">
            <div className="lp-pricing-popular">Most Popular</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: "#38bdf8" }}>Growth Business</h3>
            <p style={{ fontSize: 13.5, color: "#bfdbfe", margin: 0 }}>For coaching centres, fitness studios & expanding SMBs.</p>
            <div className="lp-price-deal-wrap">
              <span className="lp-price-struck">₹499</span>
              <span className="lp-price-val-zero">₹0</span>
              <span className="lp-price-free-pill">FREE FOR 3 MONTHS</span>
            </div>
            <div className="lp-price-sub">₹0 for first 3 months, then ₹499/month</div>
            <div style={{ margin: "24px 0", flex: 1, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span><strong>Unlimited</strong> students & clients</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Unlimited WhatsApp receipts & invoices</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Unlimited batches & attendance alerts</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Staff salary management & payslips</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Visual Lead CRM & call reminders</span>
              </div>
            </div>
            <button onClick={handleRegister} className="lp-btn-hero-solid" style={{ width: "100%", justifyContent: "center" }} type="button">
              Claim 3 Months Free Growth →
            </button>
          </div>

          {/* Pro Enterprise */}
          <div className="lp-pricing-card">
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Pro Business</h3>
            <p style={{ fontSize: 13.5, color: "#bfdbfe", margin: 0 }}>For multi-branch academies and professional agencies.</p>
            <div className="lp-price-deal-wrap">
              <span className="lp-price-struck">₹999</span>
              <span className="lp-price-val-zero">₹0</span>
              <span className="lp-price-free-pill">FREE FOR 3 MONTHS</span>
            </div>
            <div className="lp-price-sub">₹0 for first 3 months, then ₹999/month</div>
            <div style={{ margin: "24px 0", flex: 1, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Multiple branches / workspaces</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Multi-staff role permissions</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Custom domain & branding</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Dedicated WhatsApp onboarding manager</span>
              </div>
            </div>
            <button onClick={handleRegister} className="lp-btn-hero-ghost" style={{ width: "100%", justifyContent: "center" }} type="button">
              Claim 3 Months Free Pro →
            </button>
          </div>
        </div>
      </section>

      {/* TRUST LOGOS BAR (CLEAN VECTOR ICONS) */}
      <section className="lp-trust-bar">
        <div className="lp-trust-title">Integrated with most trusted platforms</div>
        <div className="lp-logos-flex">
          <div className="lp-logo-badge">
            <IconZap size={16} />
            <span>UPI Instant Pay</span>
          </div>
          <div className="lp-logo-badge">
            <IconWhatsApp size={18} />
            <span>WhatsApp Business</span>
          </div>
          <div className="lp-logo-badge">
            <IconRazorpay size={18} />
            <span>Razorpay Gateway</span>
          </div>
          <div className="lp-logo-badge">
            <IconMeta size={18} />
            <span>Meta Lead Ads</span>
          </div>
          <div className="lp-logo-badge">
            <IconGoogle size={16} />
            <span>Google Ads</span>
          </div>
        </div>
      </section>

      {/* THE ORBITING WORKFLOW CORE (NO CIRCLE CUTTING, FULLY VISIBLE) */}
      <section id="workflow" className="lp-orbit-section">
        <div className="lp-orbit-card">
          {/* Orbital Arena with Non-Clipping Concentric SVG Rings */}
          <div className="lp-orbit-arena">
            {/* SVG Orbit Rings that fit perfectly and never cut off */}
            <div className="lp-orbit-svg-wrap">
              <svg width="100%" height="100%" viewBox="0 0 1000 500" fill="none">
                <ellipse
                  cx="500"
                  cy="250"
                  rx="485"
                  ry="235"
                  stroke="rgba(56, 189, 248, 0.28)"
                  strokeWidth="1.5"
                  strokeDasharray="6 6"
                />
                <ellipse
                  cx="500"
                  cy="250"
                  rx="340"
                  ry="165"
                  stroke="rgba(56, 189, 248, 0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                />
              </svg>
            </div>

            {/* Brand Nodes on Orbit Rings */}
            <div className="lp-orbit-brand-node lp-node-meta">
              <IconMeta size={18} />
              <span>Meta Ads</span>
            </div>
            <div className="lp-orbit-brand-node lp-node-google">
              <IconGoogle size={18} />
              <span>Google</span>
            </div>
            <div className="lp-orbit-brand-node lp-node-whatsapp">
              <IconWhatsApp size={18} />
              <span>WhatsApp</span>
            </div>
            <div className="lp-orbit-brand-node lp-node-razorpay">
              <IconRazorpay size={18} />
              <span>Razorpay</span>
            </div>
            <div className="lp-orbit-brand-node lp-node-email">
              <IconMail size={18} />
              <span>Gmail & SMS</span>
            </div>
            <div className="lp-orbit-brand-node lp-node-phonepe">
              <IconPhonePe size={18} />
              <span>UPI Pay</span>
            </div>

            {/* Center Content Inside the Orbit */}
            <div className="lp-orbit-center-box">
              <div className="lp-orbit-tag">Intelligent Workflow Engine</div>
              <h2 className="lp-orbit-title">All-in-One Tools to Stay Organized & Grow</h2>
              <p className="lp-orbit-desc">
                From small tuition batches to expanding fitness studios and agencies, manage your entire business lifecycle in one connected loop.
              </p>

              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={handleRegister} className="lp-btn-hero-solid" type="button">
                  Get Started Free →
                </button>
                <a href="#features" className="lp-btn-hero-ghost" onClick={(e) => handleSmoothScroll(e, "#features")}>
                  See Features ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SCROLL-DRIVEN CIRCUIT WORKFLOW TIMELINE (INSPIRED BY TIMELINE 2020) */}
      <section id="workflow-timeline" ref={circuitSectionRef} className="lp-circuit-timeline-section">
        <div className="lp-section-center-head">
          <span className="lp-orbit-tag">Interactive Onboarding Circuit</span>
          <h2>How CRMKaro Works Connected From Day 1</h2>
          <p>
            Scroll down to watch the operating circuit assemble in real time: from choosing your plan to full business autopilot.
          </p>

          {/* Real-time Progress Bar */}
          <div className="lp-circuit-progress-wrap">
            <div className="lp-circuit-progress-track">
              <div
                className="lp-circuit-progress-fill"
                style={{ width: `${Math.min(100, Math.max(8, Math.round(circuitProgress * 100)))}%` }}
              />
            </div>
            <div className="lp-circuit-progress-labels">
              <span className={circuitProgress >= 0.12 ? "lit" : ""}>01. Choose Plan</span>
              <span className={circuitProgress >= 0.35 ? "lit" : ""}>02. 30s Signup</span>
              <span className={circuitProgress >= 0.58 ? "lit" : ""}>03. Select Category</span>
              <span className={circuitProgress >= 0.80 ? "lit" : ""}>04. Operations Live</span>
            </div>
          </div>
        </div>

        {/* The Circuit Board Arena */}
        <div className="lp-circuit-arena">
          {/* STEP 1: SELECT PLAN (Left Column) */}
          <div className="lp-circuit-row lp-row-left">
            <div className={`lp-circuit-card ${circuitProgress >= 0.12 ? "active" : ""}`}>
              <div className="lp-circuit-step-num">01</div>
              <div className="lp-circuit-card-inner">
                <div className="lp-circuit-card-head">
                  <div className="lp-circuit-icon-box">
                    <IconZap size={20} />
                  </div>
                  <div>
                    <span className="lp-circuit-tag">Risk-Free Starting</span>
                    <h3>Select Your Plan</h3>
                  </div>
                </div>
                <p className="lp-circuit-desc">
                  Pick the tier that fits your size. Zero setup fee, instant access with 14-day free trial.
                </p>

                <div className="lp-micro-plans-box">
                  <div className="lp-micro-plan-item">
                    <span className="lp-plan-radio">●</span>
                    <div className="lp-plan-info">
                      <strong>Starter Free</strong>
                      <span>₹0 forever · Solo tutors & trainers</span>
                    </div>
                    <span className="lp-plan-tag-free">Free</span>
                  </div>
                  <div className="lp-micro-plan-item featured">
                    <span className="lp-plan-radio">●</span>
                    <div className="lp-plan-info">
                      <strong>Growth Business</strong>
                      <span>₹499/mo · Unlimited WhatsApp bills</span>
                    </div>
                    <span className="lp-plan-tag-offer">3 Mo Free</span>
                  </div>
                  <div className="lp-micro-plan-item">
                    <span className="lp-plan-radio">○</span>
                    <div className="lp-plan-info">
                      <strong>Pro Business</strong>
                      <span>₹999/mo · Multi-branch & custom domain</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connecting Circuit Line: Vertical Drop + Horizontal Right Turn */}
            <div className="lp-circuit-line-connector seg-1-to-2">
              <div
                className="lp-line-vertical v1"
                style={{ transform: `scaleY(${Math.min(1, Math.max(0, (circuitProgress - 0.10) / 0.15))})` }}
              />
              <div
                className="lp-line-horizontal h1"
                style={{ transform: `scaleX(${Math.min(1, Math.max(0, (circuitProgress - 0.22) / 0.15))})` }}
              />
            </div>
          </div>

          {/* STEP 2: LOGIN / SIGNUP (Right Column) */}
          <div className="lp-circuit-row lp-row-right">
            <div className={`lp-circuit-card ${circuitProgress >= 0.35 ? "active" : ""}`}>
              <div className="lp-circuit-step-num">02</div>
              <div className="lp-circuit-card-inner">
                <div className="lp-circuit-card-head">
                  <div className="lp-circuit-icon-box">
                    <IconCall size={20} />
                  </div>
                  <div>
                    <span className="lp-circuit-tag">30-Second Setup</span>
                    <h3>Login / Quick Signup</h3>
                  </div>
                </div>
                <p className="lp-circuit-desc">
                  Instant mobile OTP verification. Your private cloud workspace is provisioned in seconds.
                </p>

                <div className="lp-micro-auth-box">
                  <div className="lp-auth-field-label">Mobile Number for WhatsApp OTP</div>
                  <div className="lp-auth-input-mock">
                    <span className="lp-input-flag">🇮🇳 +91</span>
                    <span className="lp-input-val">98765 43210</span>
                    <span className="lp-input-tick">✓</span>
                  </div>
                  <div className="lp-otp-row-mock">
                    <span className="lp-otp-box">3</span>
                    <span className="lp-otp-box">2</span>
                    <span className="lp-otp-box">9</span>
                    <span className="lp-otp-box">1</span>
                    <span className="lp-otp-verified">Verified ✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connecting Circuit Line: Vertical Drop + Horizontal Turn into Center Box */}
            <div className="lp-circuit-line-connector seg-2-to-3">
              <div
                className="lp-line-vertical v2"
                style={{ transform: `scaleY(${seg2Progress})` }}
              />
              <div
                className="lp-line-horizontal h2"
                style={{ transform: `scaleX(${Math.min(1, Math.max(0, (seg2Progress - 0.25) / 0.75))})` }}
              />
            </div>
          </div>

          {/* STEP 3: SELECT CATEGORY (Branching Circuit Box like timeline2020 APR/MAY/JUN/JUL) */}
          <div className="lp-circuit-row lp-row-center">
            <div className={`lp-circuit-box-wrapper ${seg2Progress >= 0.5 ? "active" : ""}`}>
              {/* Surrounding Circuit Perimeter Lines */}
              <div
                className="lp-circuit-box-border-top"
                style={{ transform: `scaleX(${Math.min(1, seg2Progress * 1.3)})` }}
              />
              <div
                className="lp-circuit-box-border-right"
                style={{ transform: `scaleY(${Math.min(1, seg2Progress * 1.3)})` }}
              />
              <div
                className="lp-circuit-box-border-left"
                style={{ transform: `scaleY(${Math.min(1, seg2Progress * 1.3)})` }}
              />
              <div
                className="lp-circuit-box-border-bottom"
                style={{ transform: `scaleX(${Math.min(1, seg3Progress * 1.5)})` }}
              />

              <div className="lp-circuit-box-head">
                <div className="lp-circuit-step-num-center">03</div>
                <span className="lp-circuit-tag">Domain Specialization</span>
                <h3>Select Your Business Category</h3>
                <p>CRMKaro automatically customizes nomenclature, modules & fields for your exact domain:</p>
              </div>

              {/* 4 Categories in 2x2 Connected Circuit Grid */}
              <div className="lp-circuit-categories-grid">
                <div
                  onClick={() => setSelectedDemoCat("coaching")}
                  className={`lp-circuit-cat-cell ${selectedDemoCat === "coaching" ? "selected" : ""}`}
                >
                  <div className="lp-cat-cell-head">
                    <div className="lp-cat-cell-icon">
                      <IconGraduation size={20} />
                    </div>
                    <span className="lp-cat-badge">Academic</span>
                  </div>
                  <h4>Coaching & Tuition</h4>
                  <p>Batches, student roll numbers, 12-month fees cycle & daily attendance register.</p>
                </div>

                <div
                  onClick={() => setSelectedDemoCat("realestate")}
                  className={`lp-circuit-cat-cell ${selectedDemoCat === "realestate" ? "selected" : ""}`}
                >
                  <div className="lp-cat-cell-head">
                    <div className="lp-cat-cell-icon">
                      <IconBuilding size={20} />
                    </div>
                    <span className="lp-cat-badge">Real Estate</span>
                  </div>
                  <h4>Real Estate</h4>
                  <p>Property inquiries, site visit logs, broker commissions & deal stage pipelines.</p>
                </div>

                <div
                  onClick={() => setSelectedDemoCat("startups")}
                  className={`lp-circuit-cat-cell ${selectedDemoCat === "startups" ? "selected" : ""}`}
                >
                  <div className="lp-cat-cell-head">
                    <div className="lp-cat-cell-icon">
                      <IconRocket size={20} />
                    </div>
                    <span className="lp-cat-badge">Agencies</span>
                  </div>
                  <h4>Startups & Agencies</h4>
                  <p>Client CRM pipeline, project invoices, retainer billing & milestone trackers.</p>
                </div>

                <div
                  onClick={() => setSelectedDemoCat("manufacturing")}
                  className={`lp-circuit-cat-cell ${selectedDemoCat === "manufacturing" ? "selected" : ""}`}
                >
                  <div className="lp-cat-cell-head">
                    <div className="lp-cat-cell-icon">
                      <IconFactory size={20} />
                    </div>
                    <span className="lp-cat-badge">SMB & Factory</span>
                  </div>
                  <h4>Manufacturer & SMBs</h4>
                  <p>Staff wage ledger, kharcha tracking, vendor ledger & advance payout management.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Connecting Circuit Trunk Line from Step 3 directly into Step 4 */}
          <div className="lp-circuit-bridge-connector">
            <div className="lp-bridge-track" />
            <div
              className="lp-bridge-fill"
              style={{ transform: `scaleY(${seg3Progress})` }}
            />
            {seg3Progress > 0.08 && (
              <div className="lp-bridge-pulse" style={{ top: `${Math.min(100, seg3Progress * 100)}%` }} />
            )}
            <div className={`lp-bridge-arrow ${step4Active ? "active" : ""}`}>▼</div>
          </div>

          {/* STEP 4: ALL-IN-ONE OPERATIONS COMMAND CENTER (Final Center Hub) */}
          <div className="lp-circuit-row lp-row-operations">
            <div className={`lp-circuit-card lp-circuit-card-engine ${step4Active ? "active" : ""}`}>
              <div className={`lp-circuit-step-num-center ${step4Active ? "lit" : ""}`}>04</div>
              <div className="lp-circuit-card-inner">
                <div className="lp-circuit-engine-head">
                  <span className="lp-circuit-tag" style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}>
                    Everything Connected · Full Autopilot
                  </span>
                  <h3>All-in-One Operations Live!</h3>
                  <p>All daily tasks managed from one unified dashboard with single-tap speed:</p>
                </div>

                <div className="lp-engine-features-grid">
                  <div className="lp-engine-item">
                    <div className="lp-engine-icon">
                      <IconLead size={18} />
                    </div>
                    <div>
                      <strong>Collect Leads for Telecallers</strong>
                      <span>Auto-sync prospective inquiries from Meta Ads & Google Ads with 1-click follow-up logs.</span>
                    </div>
                  </div>

                  <div className="lp-engine-item">
                    <div className="lp-engine-icon">
                      <IconGraduation size={18} />
                    </div>
                    <div>
                      <strong>Make Groups & Batches Class-Wise</strong>
                      <span>Organize class timings, division rosters & track student enrollment effortlessly.</span>
                    </div>
                  </div>

                  <div className="lp-engine-item highlight-blue">
                    <div className="lp-engine-icon">
                      <IconReceipt size={18} />
                    </div>
                    <div>
                      <strong>Collect Instant Money (1-Click UPI/Cash)</strong>
                      <span>Record fees on the spot and auto-dispatch branded PDF receipts directly to parents on WhatsApp.</span>
                    </div>
                  </div>

                  <div className="lp-engine-item highlight-green">
                    <div className="lp-engine-icon green">
                      <IconWhatsApp size={18} />
                    </div>
                    <div>
                      <strong>Student Presenty & Parent WhatsApp Alert</strong>
                      <span>Instant WhatsApp notification sent to parents: <em>"Rahul is present in Grade 10 batch today."</em></span>
                    </div>
                  </div>

                  <div className="lp-engine-item">
                    <div className="lp-engine-icon">
                      <IconPayroll size={18} />
                    </div>
                    <div>
                      <strong>Staff Salary Management & Kharcha</strong>
                      <span>Auto-calculate teacher payouts, staff advances, daily kharcha & real-time net business profit.</span>
                    </div>
                  </div>
                </div>

                <div className="lp-circuit-cta-row">
                  <button onClick={handleRegister} className="lp-btn-hero-solid" type="button">
                    Claim 3 Months Free Access Now →
                  </button>
                  <a href="#pricing" className="lp-btn-hero-ghost" onClick={(e) => handleSmoothScroll(e, "#pricing")}>
                    Compare All Plans ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO GRID FEATURES (PROFESSIONAL VECTOR ICONS) */}
      <section id="features" className="lp-bento-section">
        <div className="lp-section-center-head">
          <span className="lp-orbit-tag">Complete Toolkit</span>
          <h2>A Complete Toolkit Operating Platform System</h2>
          <p>No more switching between accounting software, Excel spreadsheets, and WhatsApp groups.</p>
        </div>

        <div className="lp-bento-grid">
          {/* Card 1: Quick Collect */}
          <div className="lp-bento-card">
            <div className="lp-bento-content">
              <div className="lp-flow-svg-icon" style={{ width: 42, height: 42, borderRadius: 12, marginBottom: 14 }}>
                <IconZap size={22} />
              </div>
              <h4>1-Click Quick Collect & WhatsApp Invoicing</h4>
              <p>
                Collect fees and payments with automated digital PDF receipts. Send receipt confirmations directly to parents and clients on WhatsApp with single-tap convenience.
              </p>
            </div>
            <div className="lp-bento-img-wrap">
              <img
                src="/landing/feature-collect-fees.png"
                alt="Quick Collect"
                width={600}
                height={300}
                loading="eager"
              />
            </div>
          </div>

          {/* Card 2: Leads CRM */}
          <div className="lp-bento-card">
            <div className="lp-bento-content">
              <div className="lp-flow-svg-icon" style={{ width: 42, height: 42, borderRadius: 12, marginBottom: 14 }}>
                <IconLead size={22} />
              </div>
              <h4>Inquiry Tracking & Visual Lead CRM</h4>
              <p>
                Capture prospective student and client inquiries from Meta Ads, Google Ads, and walk-ins. Set call reminders and never lose a lead.
              </p>

              {/* Space Optimizer: Realistic Pipeline Stages & Action Badges */}
              <div className="lp-crm-space-filler">
                <div className="lp-pipeline-stage-pills">
                  <div className="lp-pipeline-pill">
                    <strong>
                      <span className="lp-status-dot lp-dot-blue" />
                      New Leads
                    </strong>
                    <span className="lp-pill-count">12 Inquiries</span>
                  </div>
                  <div className="lp-pipeline-pill">
                    <strong>
                      <span className="lp-status-dot lp-dot-amber" />
                      Follow-up Today
                    </strong>
                    <span className="lp-pill-count">4 Scheduled</span>
                  </div>
                  <div className="lp-pipeline-pill">
                    <strong>
                      <span className="lp-status-dot lp-dot-green" />
                      Enrolled / Won
                    </strong>
                    <span className="lp-pill-count">18 Admitted</span>
                  </div>
                </div>

                <div className="lp-lead-badges-row">
                  <span className="lp-lead-badge">
                    <IconMeta size={13} /> Meta & Google Ads Sync
                  </span>
                  <span className="lp-lead-badge">
                    <IconCall size={13} /> 1-Click Call Logs
                  </span>
                  <span className="lp-lead-badge">
                    <IconWhatsApp size={13} /> WhatsApp Templates
                  </span>
                  <span className="lp-lead-badge">
                    <IconZap size={13} /> 3x Conversion Rate
                  </span>
                </div>
              </div>
            </div>
            <div className="lp-bento-img-wrap">
              <img
                src="/landing/feature-leads-crm.jpg"
                alt="Leads CRM Pipeline"
                width={600}
                height={300}
                loading="eager"
              />
            </div>
          </div>

          {/* Card 3: Batches & Attendance */}
          <div className="lp-bento-card">
            <div className="lp-bento-content">
              <div className="lp-flow-svg-icon" style={{ width: 42, height: 42, borderRadius: 12, marginBottom: 14 }}>
                <IconGraduation size={22} />
              </div>
              <h4>Batch Rosters & 1-Click Daily Attendance</h4>
              <p>
                Organize morning and evening divisions. Mark attendance in 10 seconds and automatically trigger absent alerts to parents.
              </p>
            </div>
            <div className="lp-bento-img-wrap">
              <img
                src="/landing/feature-batches-attendance.jpg"
                alt="Batches & Attendance"
                width={600}
                height={300}
                loading="eager"
              />
            </div>
          </div>

          {/* Card 4: Staff Payroll */}
          <div className="lp-bento-card">
            <div className="lp-bento-content">
              <div className="lp-flow-svg-icon" style={{ width: 42, height: 42, borderRadius: 12, marginBottom: 14 }}>
                <IconPayroll size={22} />
              </div>
              <h4>Automated Staff Salaries & Payslips</h4>
              <p>
                Set up teacher and staff compensation, record advances, auto-calculate net pay, and generate professional salary slips.
              </p>
            </div>
            <div className="lp-bento-img-wrap">
              <img
                src="/landing/feature-staff-payroll.png"
                alt="Staff Payroll"
                width={600}
                height={300}
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="lp-solution-section">
        <div className="lp-section-center-head">
          <span className="lp-orbit-tag">Honest Comparison</span>
          <h2>Why Businesses Choose CRMKaro</h2>
          <p>See why Indian tuition centres, gyms, and SMBs are migrating away from Excel and foreign software.</p>
        </div>

        <div className="lp-comparison-box">
          <table className="lp-comparison-table">
            <thead>
              <tr>
                <th>Feature / Capability</th>
                <th className="crmkaro-col">CRMKaro Platform</th>
                <th>Manual Excel Sheets</th>
                <th>Foreign Software ($)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Fee Receipts on WhatsApp</strong></td>
                <td className="crmkaro-col">1-Click Instant Share</td>
                <td>Manual typing / screenshot</td>
                <td>Requires $50/mo add-ons</td>
              </tr>
              <tr>
                <td><strong>12-Month Academic Fee Cycle</strong></td>
                <td className="crmkaro-col">Native April-March support</td>
                <td>Formulas break easily</td>
                <td>Western monthly only</td>
              </tr>
              <tr>
                <td><strong>Teacher & Staff Payroll</strong></td>
                <td className="crmkaro-col">Built-in with salary slips</td>
                <td>Separate register needed</td>
                <td>Extra $10/user/mo</td>
              </tr>
              <tr>
                <td><strong>Pricing Structure</strong></td>
                <td className="crmkaro-col">Flat ₹499/mo (Unlimited)</td>
                <td>Free (costs hours of daily time)</td>
                <td>$49 - $199/month in USD</td>
              </tr>
              <tr>
                <td><strong>Mobile Experience</strong></td>
                <td className="crmkaro-col">Fast single-tap mobile web</td>
                <td>Terrible on phones</td>
                <td>Slow and bloated</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section id="faq" className="lp-solution-section">
        <div className="lp-section-center-head">
          <span className="lp-orbit-tag">Got Questions?</span>
          <h2>Frequently Asked Questions</h2>
          <p>Everything you need to know about getting started with CRMKaro.</p>
        </div>

        <div className="lp-faq-container">
          {FAQS.map((faq, idx) => (
            <div key={idx} className={`lp-faq-item ${openFaq === idx ? "open" : ""}`}>
              <button
                className="lp-faq-q-btn"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                type="button"
                aria-expanded={openFaq === idx}
              >
                <span>{faq.q}</span>
                <span style={{ fontSize: 14, color: "#38bdf8" }}>{openFaq === idx ? "▲" : "▼"}</span>
              </button>
              {openFaq === idx && (
                <div className="lp-faq-ans">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL BLUE CTA BANNER */}
      <section className="lp-blue-banner-section" style={{ margin: "60px auto" }}>
        <div className="lp-blue-banner-card" style={{ textAlign: "center", padding: "72px 40px" }}>
          <h2 style={{ margin: "0 auto 16px" }}>Ready to Run Your Business on Autopilot?</h2>
          <p style={{ margin: "0 auto 36px" }}>
            Join 500+ Indian tuition centres, gyms, and businesses collecting fees faster with CRMKaro. Setup takes less than 30 seconds.
          </p>
          <button
            onClick={handleRegister}
            className="lp-btn-capsule-primary"
            style={{
              padding: "16px 36px",
              fontSize: 16,
              background: "#ffffff",
              color: "#071739",
              border: "1px solid #ffffff",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)"
            }}
            type="button"
          >
            Create Your Free Workspace Now →
          </button>
        </div>
      </section>

      {/* CLEAN MODERN FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <div className="lp-brand" style={{ marginBottom: 16 }}>
              <div className="lp-brand-logo">
                <img
                  src="/brand/crmkaro-mark.png"
                  alt="CRMKaro Logo"
                  width={32}
                  height={32}
                  style={{ borderRadius: 8 }}
                />
              </div>
              <span className="lp-brand-name">CRMKaro</span>
            </div>
            <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, maxWidth: 300 }}>
              The modern Business OS for Indian academies, fitness studios, agencies, and SMBs. Manage fees, attendance, and payroll in one clean place.
            </p>
          </div>

          <div>
            <h5 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#ffffff", margin: "0 0 16px" }}>Solutions</h5>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#94a3b8" }}>
              <a href="#solutions" style={{ color: "inherit", textDecoration: "none" }}>Tuition & Academies</a>
              <a href="#solutions" style={{ color: "inherit", textDecoration: "none" }}>Studios & Gyms</a>
              <a href="#solutions" style={{ color: "inherit", textDecoration: "none" }}>Agencies & Services</a>
              <a href="#solutions" style={{ color: "inherit", textDecoration: "none" }}>Staff Payroll & HR</a>
            </div>
          </div>

          <div>
            <h5 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#ffffff", margin: "0 0 16px" }}>Product</h5>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#94a3b8" }}>
              <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>Quick Collect</a>
              <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>WhatsApp Invoicing</a>
              <a href="#workflow" style={{ color: "inherit", textDecoration: "none" }}>Interactive Workflow</a>
              <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>Pricing Plans</a>
            </div>
          </div>

          <div>
            <h5 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#ffffff", margin: "0 0 16px" }}>Security & Support</h5>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: "#94a3b8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>100% Encrypted Database</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>99.9% Uptime Guarantee</span>
              </div>
              <a
                href="https://wa.me/919004520400?text=Hello%20CRMKaro%20Team%2C%20I%20have%20an%20inquiry%20regarding%20CRMKaro."
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <IconWhatsApp size={16} />
                <span>WhatsApp Support</span>
              </a>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCheck size={14} />
                <span>Made for Indian Businesses</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <div>© {new Date().getFullYear()} CRMKaro Inc. All rights reserved.</div>
          <div style={{ display: "flex", gap: 20 }}>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Refund Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
