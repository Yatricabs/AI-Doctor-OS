"use client"

import { useState } from 'react'
import Image from 'next/image'
import { useDispatch, useSelector } from 'react-redux'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { AppDispatch, RootState } from '@/lib/store'
import { closeAppointmentDialog, openAppointmentDialog, setActiveSection } from '@/lib/landingSlice'
import PatientIntakeChat from '@/components/ops/PatientIntakeChat'

/* ---------------------------------- Images --------------------------------- */
const IMG = {
  patientHero:
    'https://images.unsplash.com/photo-1659463034333-b9f5bad5b78d?w=900&h=1100&fit=crop&auto=format',
  doctorLaptop:
    'https://images.unsplash.com/photo-1659353888096-cc5e333db5e0?w=900&h=900&fit=crop&auto=format',
  doctorPortrait:
    'https://images.unsplash.com/photo-1642975967602-653d378f3b5b?w=900&h=1100&fit=crop&auto=format',
  patientSection:
    'https://images.unsplash.com/photo-1614366483613-442f38491bf5?w=900&h=1100&fit=crop&auto=format',
  familyMountain:
    'https://images.unsplash.com/photo-1559054109-82d938dac629?w=1600&h=700&fit=crop&auto=format',
}

/* ---------------------------------- Icons ---------------------------------- */
type IconProps = ComponentPropsWithoutRef<'svg'>
const base = (p: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

const Globe = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
)
const Phone = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="7" y="2" width="10" height="20" rx="2.5" />
    <path d="M11 18h2" />
  </svg>
)
const Whatsapp = (p: IconProps) => (
  <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.13c-.24.68-1.4 1.3-1.94 1.35-.5.05-.96.24-3.2-.67-2.7-1.06-4.42-3.8-4.55-3.98-.13-.18-1.1-1.46-1.1-2.79 0-1.33.7-1.98.95-2.25.24-.27.53-.34.7-.34h.5c.16 0 .38-.06.59.45.24.58.8 2 .87 2.14.07.14.12.3.02.48-.44.88-.9.85-.66 1.26.98 1.68 1.96 2.26 3.45 3 .25.13.4.11.54-.07.14-.18.62-.72.79-.97.16-.24.33-.2.55-.12.22.08 1.42.67 1.66.79.24.12.4.18.46.28.06.1.06.58-.18 1.26z" />
  </svg>
)
const PhoneCall = (p: IconProps) => (
  <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}>
    <path d="M6.62 10.79a15.53 15.53 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.07 21 3 13.93 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z" />
  </svg>
)
const Calendar = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </svg>
)
const Users = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="3" />
    <path d="M2 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.5M18 20a5 5 0 0 0-3-4.6" />
  </svg>
)
const Stethoscope = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 3v6a4 4 0 0 0 8 0V3M5 3H3M13 3h2M9 13v3a4 4 0 0 0 8 0v-1" />
    <circle cx="18" cy="14" r="2" />
  </svg>
)
const FileText = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 2h8l4 4v16H6z" />
    <path d="M14 2v4h4M9 12h6M9 16h6" />
  </svg>
)
const Clock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
const TrendUp = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 17l6-6 4 4 8-8M21 7v5M21 7h-5" />
  </svg>
)
const Chat = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5h16v11H9l-4 4V5z" />
    <path d="M8 9h8M8 12h5" />
  </svg>
)
const Brain = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 5 2.5 2.5 0 0 0 5 0V4a2 2 0 0 0-3 0zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 5" />
  </svg>
)
const UserRound = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)
const Check = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12l5 5L20 6" />
  </svg>
)
const Play = (p: IconProps) => (
  <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}>
    <path d="M7 5l12 7-12 7z" />
  </svg>
)
const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
const X = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
const Alert = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l9 16H3z" />
    <path d="M12 10v4M12 17v.5" />
  </svg>
)
const Heart = (p: IconProps) => (
  <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}>
    <path d="M12 20s-7-4.6-9.3-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.3 6.5C19 15.4 12 20 12 20z" />
  </svg>
)

/* --------------------------------- Helpers --------------------------------- */
function Logo() {
  return (
    <a href="#" className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-teal)] to-[var(--color-brand)] text-white shadow-sm">
        <Heart width={16} height={16} className="text-white/90" />
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white text-[var(--color-brand)] shadow">
          <Chat width={10} height={10} />
        </span>
      </span>
      <span className="leading-none">
        <span className="block font-display text-[19.5px] font-extrabold tracking-tight text-[var(--color-ink)]">
          AI UPCHAR
        </span>
        <span className="block text-[11.5px] font-medium text-[var(--color-teal-deep)]">
          Better Conversations. Healthier Lives.
        </span>
      </span>
    </a>
  )
}

function Hand({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-hand leading-tight text-[var(--color-teal-deep)] ${className}`}>
      {children}
    </span>
  )
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[var(--color-mint)] px-3 py-1 text-[13.8px] font-semibold text-[var(--color-teal-deep)] ring-1 ring-[var(--color-mint-line)]">
      {children}
    </span>
  )
}

/* ---------------------------------- Header --------------------------------- */
const NAV = [
  { label: 'Home', target: 'home' },
  { label: 'For Patients', target: 'for-patients' },
  { label: 'For Doctors', target: 'for-doctors' },
  { label: 'How It Works', target: 'how-it-works' },
  { label: 'Features', target: 'features' },
  { label: 'About', target: 'about' },
]

function Header() {
  const dispatch = useDispatch<AppDispatch>()
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-sky-line)]/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-none items-center justify-between gap-4 px-5 py-3">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map(({ label, target }, i) => (
            <a
              key={label}
              href={`#${target}`}
              onClick={() => { dispatch(setActiveSection(label)); setMobileOpen(false) }}
              className={`relative text-[16px] font-medium transition-colors hover:text-[var(--color-brand)] ${i === 0 ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'
                }`}
            >
              {label}
              {i === 0 && (
                <span className="absolute -bottom-1.5 left-0 h-0.5 w-full rounded bg-[var(--color-brand)]" />
              )}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <a href="/demo" className="hidden items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-[16px] font-semibold text-white shadow-sm transition hover:bg-[var(--color-brand-dark)] sm:inline-flex">
            <Play width={13} height={13} /> Watch Demo
          </a>
          <a href="/demo" className="hidden rounded-lg border border-[var(--color-sky-line)] px-4 py-2 text-[16px] font-semibold text-[var(--color-ink-soft)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] sm:block">
            Sign In
          </a>
          <button type="button" aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)} className="rounded-lg border border-[var(--color-sky-line)] p-2 text-[var(--color-ink-soft)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] lg:hidden">
            {mobileOpen ? <X width={20} height={20} /> : <span className="block space-y-1"><span className="block h-0.5 w-5 rounded bg-current" /><span className="block h-0.5 w-5 rounded bg-current" /><span className="block h-0.5 w-5 rounded bg-current" /></span>}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-[var(--color-sky-line)] bg-white px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map(({ label, target }) => <a key={label} href={`#${target}`} onClick={() => { dispatch(setActiveSection(label)); setMobileOpen(false) }} className="rounded-lg px-3 py-2.5 text-[16px] font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-mint)] hover:text-[var(--color-brand)]">{label}</a>)}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-[var(--color-sky-line)] pt-3">
            <a href="/demo" className="rounded-lg border border-[var(--color-sky-line)] px-4 py-2.5 text-center text-[16px] font-semibold text-[var(--color-ink-soft)]">Sign In</a>
          </div>
        </div>
      )}
    </header>
  )
}

/* ----------------------------------- Hero ---------------------------------- */
const CHANNELS = [
  { icon: Globe, label: 'Website', color: 'var(--color-brand)' },
  { icon: Phone, label: 'Mobile App', color: 'var(--color-ink-soft)' },
  { icon: Whatsapp, label: 'WhatsApp', color: 'var(--color-wa)' },
  { icon: PhoneCall, label: 'Voice Call', color: 'var(--color-brand)' },
]

function ChatBubble({ from, children }: { from: 'ai' | 'user'; children: ReactNode }) {
  const isAi = from === 'ai'
  return (
    <div className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12.7px] leading-snug ${isAi
          ? 'rounded-tl-sm bg-[var(--color-sky)] text-[var(--color-ink)]'
          : 'rounded-tr-sm bg-[var(--color-brand)] text-white'
          }`}
      >
        {children}
      </div>
    </div>
  )
}

function BriefRow({
  icon: Icon,
  label,
  value,
  accent = 'var(--color-brand)',
}: {
  icon: (p: IconProps) => ReactNode
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="flex gap-2.5">
      <span
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md"
        style={{ background: `color-mix(in srgb, ${accent} 12%, white)`, color: accent }}
      >
        <Icon width={13} height={13} />
      </span>
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-ink)]">{label}</p>
        <p className="text-[11.5px] leading-tight text-[var(--color-body)]">{value}</p>
      </div>
    </div>
  )
}

function ClinicalBrief({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white p-3.5 shadow-2xl ring-1 ring-[var(--color-sky-line)] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-sky-line)] pb-2">
        <p className="font-display text-[13.8px] font-bold text-[var(--color-ink)]">
          AI Pre-Visit Clinical Brief
        </p>
        <X width={13} height={13} className="text-[var(--color-body)]" />
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-sky)] text-[var(--color-brand)]">
          <UserRound width={16} height={16} />
        </span>
        <div>
          <p className="text-[13.8px] font-bold text-[var(--color-ink)]">Rahul Sharma, 42</p>
          <span className="rounded-full bg-[var(--color-sky)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-brand)]">
            Follow-up Patient
          </span>
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        <BriefRow icon={FileText} label="Chief Complaint" value="Persistent abdominal discomfort" />
        <BriefRow icon={Clock} label="Duration" value="3 weeks" />
        <BriefRow icon={FileText} label="Previous Treatment" value="Yes, on medication" />
        <BriefRow icon={FileText} label="Uploaded Reports" value="2 lab reports, 1 ultrasound" />
        <BriefRow icon={Brain} label="AI Analysis" value="Likely GI infection / IBS (to be reviewed)" accent="var(--color-teal)" />
        <BriefRow icon={FileText} label="Recommended Tests" value="Stool test, CBC, LFT (suggested)" />
        <BriefRow icon={Alert} label="Alert" value="No immediate emergency signs" accent="var(--color-wa)" />
      </div>
    </div>
  )
}

function Hero() {
  const dispatch = useDispatch<AppDispatch>()
  return (
    <section id="home" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-[var(--color-hero)] to-white">
      <div className="mx-auto grid max-w-none items-center gap-8 px-5 py-6 lg:grid-cols-[0.9fr_1.3fr] lg:py-8">
        <div>
          <SectionEyebrow>An Intelligent Healthcare Ecosystem</SectionEyebrow>
          <h1 className="mt-5 font-display text-[38px] font-extrabold leading-[1.12] tracking-tight text-[var(--color-ink)] sm:text-[50px]">
            Doctor se milne se pehle,
            <br />
            <span className="landing-gradient-text bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-teal)] bg-clip-text text-transparent">
              AI aapki problem
            </span>
            <br />
            samajh chuka hoga.
          </h1>
          <p className="mt-5 max-w-xl text-[17.3px] leading-relaxed text-[var(--color-body)]">
            AI UPCHAR patient aur doctor ke beech ek intelligent bridge hai. Appointment se lekar
            symptoms, medical history, reports aur follow-up tak — sab kuch AI samajhta hai, organize
            karta hai aur doctor ke liye taiyar karta hai.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => dispatch(openAppointmentDialog())} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-3 text-[16px] font-semibold text-white shadow-md transition hover:bg-[var(--color-teal-deep)]">
              <Calendar width={17} height={17} /> Book an Appointment
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-sky-line)] bg-white px-5 py-3 text-[16px] font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
              For Doctors &amp; Clinics <ArrowRight width={16} height={16} />
            </button>
          </div>
          <div className="mt-8 grid max-w-md grid-cols-4 gap-3">
            {CHANNELS.map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <span
                  className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-[var(--color-sky-line)]"
                  style={{ color }}
                >
                  <Icon width={20} height={20} />
                </span>
                <span className="text-[12.7px] font-semibold text-[var(--color-ink-soft)]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <Hand className="absolute -top-3 right-0 z-40 hidden max-w-[180px] rotate-[-3deg] text-right text-[20.5px] leading-tight lg:block">
            Doctor gets complete context before the consultation.
            <svg width="70" height="34" viewBox="0 0 70 34" className="ml-auto mt-1 block text-[var(--color-teal-deep)]">
              <path d="M4 4c22 2 40 10 44 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M40 26l8 6 2-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Hand>

          {/* Desktop / tablet collage — built from scratch */}
          <div className="relative mx-auto hidden aspect-[1.42/1] w-full md:block">
            {/* Patient photo */}
            <div className="absolute bottom-0 left-0 z-20 h-[82%] w-[30%] overflow-hidden rounded-[1.75rem] bg-[var(--color-sky)] shadow-xl">
              <Image
                src={IMG.patientHero}
                alt="Patient chatting with AI UPCHAR on her phone"
                fill
                sizes="30vw"
                className="object-cover object-top"
              />
            </div>
            {/* Doctor photo */}
            <div className="absolute bottom-[6%] right-0 z-10 h-[62%] w-[25%] overflow-hidden rounded-2xl bg-[var(--color-sky)] shadow-xl">
              <Image
                src={IMG.doctorLaptop}
                alt="Doctor reviewing an AI pre-visit clinical brief on a laptop"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </div>

            {/* Phone — large, full conversation inside */}
            <div className="absolute left-[22%] top-[1%] z-10 flex h-[97%] w-[28%] flex-col overflow-hidden rounded-[1.8rem] border-[5px] border-[var(--color-ink)] bg-white shadow-2xl">
              <div className="flex items-center justify-between px-3 pt-1.5 text-[7px] font-semibold text-[var(--color-ink)]">
                <span>9:01</span>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ink)]" />
                  <span className="h-1.5 w-2.5 rounded-sm bg-[var(--color-ink)]" />
                </span>
              </div>
              <div className="flex items-center gap-1.5 border-b border-[var(--color-sky-line)] px-3 py-1.5">
                <ArrowRight width={11} height={11} className="rotate-180 text-[var(--color-body)]" />
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-[var(--color-teal)] to-[var(--color-brand)] text-white">
                  <Heart width={10} height={10} />
                </span>
                <span className="font-display text-[11.5px] font-bold text-[var(--color-ink)]">AI UPCHAR</span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 overflow-hidden bg-[var(--color-hero)]/40 p-2.5">
                <div className="flex items-start gap-1">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--color-teal)] text-white"><Brain width={9} height={9} /></span>
                  <div className="max-w-[86%] rounded-2xl rounded-tl-sm bg-white px-2.5 py-1.5 text-[8.5px] leading-snug text-[var(--color-ink)] shadow-sm">
                    Namaste! Main aapki swasthya samasya ko samajhne me aapki madad karunga.
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--color-teal)] text-white"><Brain width={9} height={9} /></span>
                  <div className="max-w-[86%] rounded-2xl rounded-tl-sm bg-white px-2.5 py-1.5 text-[8.5px] leading-snug text-[var(--color-ink)] shadow-sm">
                    Yeh problem kab se ho rahi hai?
                  </div>
                </div>
                <div className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-[var(--color-brand)] px-2.5 py-1.5 text-[8.5px] leading-snug text-white shadow-sm">
                  Laghbhag 20 din se.
                </div>
                <div className="flex items-start gap-1">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--color-teal)] text-white"><Brain width={9} height={9} /></span>
                  <div className="max-w-[86%] rounded-2xl rounded-tl-sm bg-white px-2.5 py-1.5 text-[8.5px] leading-snug text-[var(--color-ink)] shadow-sm">
                    Ek din me approximately kitni baar loose motion hota hai?
                  </div>
                </div>
              </div>
              <div className="m-2 flex items-center gap-1.5 rounded-full border border-[var(--color-sky-line)] px-2.5 py-1.5">
                <span className="text-[8px] text-[var(--color-body)]">Type your answer…</span>
                <span className="ml-auto grid h-4 w-4 place-items-center rounded-full bg-[var(--color-brand)] text-white">
                  <ArrowRight width={9} height={9} />
                </span>
              </div>
            </div>

            {/* Floating patient bubble */}
            <div className="absolute left-[16%] top-[13%] z-40 w-[19%] rotate-[-5deg]">
              <div className="rounded-2xl rounded-br-sm bg-white px-2.5 py-1.5 text-[9px] leading-snug text-[var(--color-ink)] shadow-lg ring-1 ring-[var(--color-sky-line)]">
                Mere pet me dard hai aur loose motion ho raha hai 20 din se.
              </div>
            </div>

            {/* "AI is asking" note */}
            <span className="absolute bottom-[8%] left-[20%] z-40 w-[19%] rotate-[-2deg] rounded-xl bg-white px-2.5 py-1.5 text-[9px] leading-tight text-[var(--color-ink-soft)] shadow-lg ring-1 ring-[var(--color-sky-line)]">
              AI is asking the right questions…
            </span>

            {/* Dashed connector to brief */}
            <div className="absolute left-[50%] top-[47%] z-40 flex items-center">
              <span className="h-px w-7 border-t-2 border-dashed border-[var(--color-brand)]" />
              <ArrowRight width={13} height={13} className="text-[var(--color-brand)]" />
            </div>

            {/* Clinical brief */}
            <ClinicalBrief className="absolute left-[52%] top-[2%] z-30 w-[29%]" />
          </div>

          {/* Mobile stack */}
          <div className="flex flex-col gap-4 md:hidden">
            <Hand className="block text-right text-[18.4px]">
              Doctor gets complete context before the consultation.
            </Hand>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative h-44 w-full overflow-hidden rounded-2xl bg-[var(--color-sky)]">
                <Image
                  src={IMG.patientHero}
                  alt="Patient chatting with AI UPCHAR on her phone"
                  fill
                  sizes="50vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="relative h-44 w-full overflow-hidden rounded-2xl bg-[var(--color-sky)]">
                <Image
                  src={IMG.doctorLaptop}
                  alt="Doctor reviewing an AI pre-visit clinical brief on a laptop"
                  fill
                  sizes="50vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-sky-line)] bg-white p-3 shadow-md">
              <div className="flex flex-col gap-2">
                <ChatBubble from="ai">Namaste! Main aapki swasthya samasya ko samajhne me aapki madad karunga.</ChatBubble>
                <ChatBubble from="user">Mere pet me dard hai aur loose motion ho raha hai 20 din se.</ChatBubble>
                <ChatBubble from="ai">Yeh problem kab se ho rahi hai?</ChatBubble>
                <ChatBubble from="user">Laghbhag 20 din se.</ChatBubble>
                <ChatBubble from="ai">Ek din me approximately kitni baar loose motion hota hai?</ChatBubble>
              </div>
            </div>
            <ClinicalBrief />
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------- Benefits --------------------------------- */
const BENEFITS = [
  { icon: Users, label: 'Easier Access\nto Quality Care' },
  { icon: Stethoscope, label: 'Smarter Consultations\nfor Doctors' },
  { icon: FileText, label: 'Organized Medical History\nin One Place' },
  { icon: Clock, label: 'Saves Time for Everyone' },
  { icon: TrendUp, label: 'Better Health Outcomes' },
]

function Benefits() {
  return (
    <section className="border-y border-[var(--color-sky-line)]/60 bg-gradient-to-b from-white to-[var(--color-mint)]/25">
      <div className="mx-auto flex max-w-none flex-wrap items-center justify-between gap-x-6 gap-y-6 px-5 py-5">
        {BENEFITS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-1 items-center gap-3 basis-[45%] sm:basis-[30%] lg:basis-0">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-sky)] text-[var(--color-brand)]">
              <Icon width={22} height={22} strokeWidth={2.3} />
            </span>
            <span className="whitespace-pre text-[14.4px] font-bold leading-tight text-[var(--color-ink)]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* --------------------------- Problem / Solution ---------------------------- */
type ProblemCard = {
  icon: (p: IconProps) => ReactNode
  title: string
  items: string[]
  accent: string
  bg: string
  line: string
}
const PROBLEM_CARDS: ProblemCard[] = [
  {
    icon: UserRound,
    title: 'Patients ke liye mushkilen',
    accent: '#e8607f',
    bg: 'var(--color-rose)',
    line: 'var(--color-rose-line)',
    items: [
      'Appointment milna mushkil',
      'Clinic pahunchne par pata chalta hai slot full hai',
      'Long waiting time, especially in government hospitals',
      'Purani reports aur prescriptions dhoondhna mushkil',
      'Har naye doctor ko same kahani dubara batani padti hai',
    ],
  },
  {
    icon: Stethoscope,
    title: 'Doctors ke liye mushkilen',
    accent: 'var(--color-brand)',
    bg: 'var(--color-sky)',
    line: 'var(--color-sky-line)',
    items: [
      'Consultation ka waqt basic history lene me chala jata hai',
      'New patient me problem samajhne ke liye bahut sawaal jawab',
      'Follow-up patient ki previous history dhoondhna padta hai',
      'Reports, prescriptions, tests alag alag format me',
      'Zyada patients, kam time',
    ],
  },
  {
    icon: FileText,
    title: 'AI UPCHAR is the solution',
    accent: 'var(--color-teal-deep)',
    bg: 'var(--color-mint)',
    line: 'var(--color-mint-line)',
    items: [
      'Appointment se pehle hi AI information collect karta hai',
      'Reports ko analyze karke context banata hai',
      'Doctor ko structured pre-visit brief milta hai',
      'New aur follow-up dono patients ke liye smart approach',
      'Alarming conditions ki pehchaan',
      'Sahi patient, sahi doctor, sahi samay par',
    ],
  },
]

function ProblemSolution() {
  return (
    <section className="bg-white px-5 py-5">
      <div className="mx-auto grid max-w-none items-start gap-8 rounded-3xl bg-[var(--color-mint)]/35 p-7 ring-1 ring-[var(--color-mint-line)]/60 lg:grid-cols-[0.85fr_2.15fr] lg:p-9">
        <h2 className="font-display text-[30px] font-extrabold leading-[1.2] text-[var(--color-ink)]">
          Healthcare mein problem sirf treatment ki nahi, access aur information ki bhi hai.
        </h2>
        <div className="grid items-stretch gap-4 md:grid-cols-3">
          {PROBLEM_CARDS.map((c) => (
            <div
              key={c.title}
              className="flex flex-col rounded-2xl border p-4 shadow-sm"
              style={{ background: c.bg, borderColor: c.line }}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white shadow-sm" style={{ color: c.accent }}>
                  <c.icon width={17} height={17} />
                </span>
                <h3 className="font-display text-[16px] font-bold leading-tight" style={{ color: c.accent }}>
                  {c.title}
                </h3>
              </div>
              <ul className="flex flex-col gap-2">
                {c.items.map((it) => (
                  <li key={it} className="flex gap-2 text-[14.4px] leading-snug text-[var(--color-ink-soft)]">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.accent }} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------- How It Works ------------------------------ */
const STEPS = [
  { icon: UserRound, title: 'Patient', sub: 'Website / App\nWhatsApp / Voice Call', teal: true },
  { icon: Calendar, title: 'Book Appointment', sub: 'AI starts conversation immediately', teal: false },
  { icon: Chat, title: 'Adaptive AI Conversation', sub: 'Symptoms, history, previous treatment', teal: true },
  { icon: FileText, title: 'Upload Reports', sub: 'Prescriptions, lab tests, scans, etc.', teal: false },
  { icon: Brain, title: 'AI Analysis & Patient Context', sub: 'Findings, suggestions, risk assessment', teal: false },
  { icon: FileText, title: 'Pre-Visit Brief for Doctor', sub: 'Structured & actionable', teal: false },
  { icon: Stethoscope, title: 'Doctor Consultation', sub: 'Doctor reviews, decides & treats', teal: true },
  { icon: Calendar, title: 'Follow-up Care', sub: 'Continuous health journey', teal: true },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-none px-5 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[32px] font-extrabold text-[var(--color-ink)]">How AI UPCHAR Works</h2>
            <p className="mt-1.5 text-[17.3px] text-[var(--color-body)]">
              A complete journey from your first question to better treatment.
            </p>
          </div>
          <Hand className="max-w-[230px] text-right text-[20.5px]">
            One Patient. One Healthcare Context. Across All Channels.
          </Hand>
        </div>

        <div className="mt-8 flex items-start justify-between gap-1 overflow-x-auto pb-2 lg:overflow-visible">
          {STEPS.map(({ icon: Icon, title, sub, teal }, i) => (
            <div key={title} className="flex shrink-0 items-start lg:shrink lg:flex-1">
              <div className="flex w-[112px] flex-col items-center text-center lg:w-full">
                <span
                  className={`grid h-16 w-16 place-items-center rounded-full ${teal
                    ? 'bg-[var(--color-mint)] text-[var(--color-teal-deep)]'
                    : 'bg-[var(--color-sky)] text-[var(--color-brand)]'
                    }`}
                >
                  <Icon width={30} height={30} strokeWidth={2.4} />
                </span>
                <p className="mt-3 font-display text-[14.4px] font-bold leading-tight text-[var(--color-ink)]">
                  {title}
                </p>
                <p className="mt-1 whitespace-pre-line text-[12px] leading-tight text-[var(--color-body)]">
                  {sub}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight width={16} height={16} className="mt-5 shrink-0 text-[var(--color-brand)]/45" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------- Patients / Doctors / Connect ---------------------- */
const PATIENT_POINTS = [
  'Appointment anytime, anywhere',
  'AI se natural baat karke apni problem batayein',
  'Website, Mobile App, WhatsApp ya Voice Call — aapki suvidha ke hisaab se',
  'Reports upload karein, AI unhe samajh lega',
  'Clinic pahunchne se pehle doctor ke paas aapki complete information',
  'Kam waiting time, behtar ilaaj',
]
const DOCTOR_POINTS = [
  'New patient ki detailed, structured history',
  'Follow-up patient ka complete previous context',
  'Reports, scans, prescriptions ka AI analysis',
  'AI suggested possible conditions and relevant tests',
  'Safety & red-flag alerts',
  'More time for actual clinical decision and patient care',
  'Better organized workflow',
]
const CONNECT = [
  { icon: Globe, title: 'Website', sub: 'Book and interact online', color: 'var(--color-brand)', solid: false },
  { icon: Phone, title: 'Mobile App', sub: 'Appointments, history, reports and more', color: 'var(--color-brand)', solid: false },
  { icon: Whatsapp, title: 'WhatsApp', sub: 'Chat naturally with AI', color: 'var(--color-wa)', solid: true },
  { icon: PhoneCall, title: 'Voice Call', sub: 'Talk to AI, create your appointment', color: 'var(--color-brand)', solid: true },
]

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-[14.4px] leading-snug text-[var(--color-ink-soft)]">
      <span className="mt-0.5 grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full bg-[var(--color-wa)] text-white shadow-sm">
        <Check width={11} height={11} strokeWidth={3} />
      </span>
      {children}
    </li>
  )
}

function AudienceSection() {
  return (
    <section id="for-patients" className="scroll-mt-20 bg-white">
      <div className="mx-auto grid max-w-none items-start gap-6 px-5 py-5 lg:grid-cols-3">
        {/* For Patients */}
        <div className="flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-sky)] to-white shadow-sm ring-1 ring-[var(--color-sky-line)]/70">
          <div className="grid flex-1 grid-cols-[30%_1fr]">
            <div className="relative h-full w-full overflow-hidden bg-[var(--color-rose)]">
              <Image
                src={IMG.patientSection}
                alt="Patient chatting with AI UPCHAR on her phone"
                fill
                sizes="(min-width: 1024px) 10vw, 30vw"
                className="object-cover object-top"
              />
            </div>
            <div className="p-4">
              <h3 className="font-display text-[20.5px] font-bold text-[var(--color-ink)]">For Patients</h3>
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {PATIENT_POINTS.map((p) => (
                  <CheckItem key={p}>{p}</CheckItem>
                ))}
              </ul>
              <blockquote className="mt-3 rounded-xl bg-white/70 p-3 text-[13.2px] italic leading-snug text-[var(--color-ink-soft)] ring-1 ring-[var(--color-sky-line)]/60">
                “Pehli baar laga ki doctor ke paas jaane se pehle hi kisi ne meri problem achhe se samajh li.”
                <span className="mt-1.5 block not-italic font-semibold text-[var(--color-ink)]">— Priya S., Patient</span>
              </blockquote>
            </div>
          </div>
        </div>

        {/* For Doctors */}
        <div id="for-doctors" className="flex scroll-mt-20 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-sky)] to-white shadow-sm ring-1 ring-[var(--color-sky-line)]/70">
          <div className="grid flex-1 grid-cols-[30%_1fr]">
            <div className="relative h-full w-full overflow-hidden bg-[var(--color-sky)]">
              <Image
                src={IMG.doctorPortrait}
                alt="Doctor using AI UPCHAR clinical briefs"
                fill
                sizes="(min-width: 1024px) 10vw, 30vw"
                className="object-cover object-top"
              />
            </div>
            <div className="p-4">
              <h3 className="font-display text-[20.5px] font-bold text-[var(--color-ink)]">For Doctors</h3>
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {DOCTOR_POINTS.map((p) => (
                  <CheckItem key={p}>{p}</CheckItem>
                ))}
              </ul>
              <blockquote className="mt-3 rounded-xl bg-white/70 p-3 text-[13.2px] italic leading-snug text-[var(--color-ink-soft)] ring-1 ring-[var(--color-sky-line)]/60">
                “Ab consultation ke waqt main zero se shuru nahi karta. AI UPCHAR mujhe already patient ki poori story de deta hai.”
                <span className="mt-1.5 block not-italic font-semibold text-[var(--color-ink)]">— Dr. Amit Verma, General Physician</span>
              </blockquote>
            </div>
          </div>
        </div>

        {/* Multiple Ways to Connect */}
        <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[var(--color-sky)] to-white p-5 shadow-sm ring-1 ring-[var(--color-sky-line)]/70">
          <h3 className="font-display text-[19.5px] font-bold text-[var(--color-ink)]">Multiple Ways to Connect</h3>
          <p className="mt-1 text-[13.8px] text-[var(--color-body)]">
            Healthcare shouldn&apos;t require learning a new app.
          </p>
          <div className="mt-5 flex flex-col gap-5">
            {CONNECT.map(({ icon: Icon, title, sub, color, solid }) => (
              <div key={title} className="flex items-center gap-4">
                <span
                  className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full shadow-sm"
                  style={
                    solid
                      ? { background: color, color: 'white' }
                      : { background: `color-mix(in srgb, ${color} 15%, white)`, color }
                  }
                >
                  <Icon width={28} height={28} strokeWidth={2.6} />
                </span>
                <div>
                  <p className="text-[17.3px] font-bold leading-tight text-[var(--color-ink)]">{title}</p>
                  <p className="text-[14.4px] leading-tight text-[var(--color-body)]">{sub}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-white/75 px-3 py-5 text-center ring-1 ring-[var(--color-sky-line)]/60">
            <Hand className="block -rotate-6 text-[20px] font-bold leading-tight !text-[#1d6fff]">
              <>Same AI. Same Patient Context.<br />Across all platforms.</>
            </Hand>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------- Example + Documents --------------------------- */
const CONV = [
  { from: 'user', text: 'Mere pet me dard hai aur loose motion ho raha hai.' },
  { from: 'ai', text: 'Yeh problem kab se ho rahi hai?' },
  { from: 'user', text: 'Laghbhag 20 din se.' },
  { from: 'ai', text: 'Ek din me roughly kitni baar loose motion hota hai?' },
] as const
const CONV_POINTS = [
  'Complaint-specific questions',
  'One question at a time',
  'Skip irrelevant questions',
  'Uses previous context & uploaded reports',
  'Checks for safety / red flags',
  'Adapts to every patient’s unique situation',
]
const DOCS = ['Prescription', 'Lab Report', 'X-Ray / MRI / CT', 'Discharge Summary', 'Other Reports']
const INSIGHTS = [
  { label: 'Key Findings', alert: false },
  { label: 'Relevant History', alert: false },
  { label: 'Previous Treatment', alert: false },
  { label: 'Changes Since Last Visit', alert: false },
  { label: 'Safety Flags', alert: true },
  { label: 'Questions for Consultation', alert: false },
]

function DetailCards() {
  return (
    <section id="features" className="scroll-mt-20 bg-white">
      <div className="mx-auto grid max-w-none gap-6 px-5 pb-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-sky-line)] p-6">
          <h3 className="font-display text-[18.4px] font-bold text-[var(--color-brand)]">
            Real Example: AI Conversation for a New Patient
          </h3>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col justify-center gap-4">
              {CONV.map((c, i) => {
                const isAi = c.from === 'ai'
                return (
                  <div key={i} className={`flex items-end gap-2 ${isAi ? '' : 'flex-row-reverse'}`}>
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ${isAi ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-brand)]'
                        }`}
                    >
                      {isAi ? <Brain width={16} height={16} /> : <UserRound width={16} height={16} />}
                    </span>
                    <span
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14.9px] leading-snug ${isAi
                        ? 'rounded-bl-sm bg-[var(--color-mint)] text-[var(--color-ink)]'
                        : 'rounded-br-sm bg-[var(--color-sky)] text-[var(--color-ink)]'
                        }`}
                    >
                      {c.text}
                    </span>
                  </div>
                )
              })}
              <div className="flex gap-1 pl-10 pt-1">
                <span className="typing-dot h-2 w-2 rounded-full bg-[var(--color-teal)]" />
                <span className="typing-dot h-2 w-2 rounded-full bg-[var(--color-teal)]" style={{ animationDelay: '.2s' }} />
                <span className="typing-dot h-2 w-2 rounded-full bg-[var(--color-teal)]" style={{ animationDelay: '.4s' }} />
              </div>
            </div>
            <ul className="flex flex-col justify-center gap-4">
              {CONV_POINTS.map((p) => (
                <CheckItem key={p}>{p}</CheckItem>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-sky-line)] p-6">
          <h3 className="font-display text-[18.4px] font-bold text-[var(--color-brand)]">
            Your Medical Documents Become Usable Context
          </h3>
          <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <ul className="flex flex-col gap-2">
              {DOCS.map((d) => (
                <li
                  key={d}
                  className="flex items-center gap-2 rounded-lg bg-[var(--color-sky)]/60 px-3 py-2 text-[13.8px] font-medium text-[var(--color-ink)]"
                >
                  <FileText width={14} height={14} className="text-[var(--color-brand)]" />
                  {d}
                </li>
              ))}
            </ul>
            <div className="flex justify-center">
              <ArrowRight width={22} height={22} className="text-[var(--color-teal)]" />
            </div>
            <div className="rounded-xl bg-[var(--color-mint)]/70 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[13.8px] font-bold text-[var(--color-teal-deep)]">
                <Brain width={14} height={14} /> AI Analysis
              </p>
              <ul className="flex flex-col gap-1.5">
                {INSIGHTS.map((it) => (
                  <li key={it.label} className="flex items-center gap-1.5 text-[12.7px] text-[var(--color-ink-soft)]">
                    {it.alert ? (
                      <Alert width={12} height={12} className="text-[#e8607f]" />
                    ) : (
                      <Check width={12} height={12} className="text-[var(--color-teal-deep)]" />
                    )}
                    {it.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Hand className="mt-4 block text-right text-[20.5px]">From files to meaningful insights.</Hand>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- CTA band -------------------------------- */
function CtaBand() {
  const dispatch = useDispatch<AppDispatch>()
  return (
    <section className="relative overflow-hidden">
      <Image
        src={IMG.familyMountain}
        alt="A family looking out over mountains at sunset"
        fill
        sizes="100vw"
        className="bg-[var(--color-ink)] object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-ink)]/85 via-[var(--color-ink)]/55 to-[var(--color-brand)]/40" />
      <div className="relative mx-auto flex max-w-none flex-col items-start gap-6 px-5 py-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-[30px] font-extrabold leading-snug text-white sm:text-[34.5px]">
            From “Mujhe doctor ko dikhana hai” to “Doctor already understands my case.”
          </h2>
          <p className="mt-3 text-[17.3px] text-white/85">AI UPCHAR connects the entire journey.</p>
        </div>
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => dispatch(openAppointmentDialog())} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-3 text-[16px] font-semibold text-white shadow-lg transition hover:bg-[var(--color-teal-deep)]">
              <Calendar width={16} height={16} /> Book an Appointment <ArrowRight width={15} height={15} />
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-[16px] font-semibold text-white ring-1 ring-white/40 backdrop-blur-sm transition hover:bg-white/20">
              <Play width={13} height={13} /> Watch Demo
            </button>
          </div>
          <Hand className="text-[27.6px] text-white">Better Conversations Healthier Lives</Hand>
        </div>
      </div>
    </section>
  )
}

function AppointmentDialog() {
  const dispatch = useDispatch<AppDispatch>()
  const open = useSelector((state: RootState) => state.landing.appointmentDialogOpen)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-ink)]/45 px-3 py-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Book an appointment">
      <div className="relative flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button onClick={() => dispatch(closeAppointmentDialog())} className="absolute right-3 top-3 z-10 rounded-lg bg-white/90 p-2 text-[var(--color-ink-soft)] shadow-sm hover:bg-[var(--color-sky)]" aria-label="Close appointment dialog"><X width={18} height={18} /></button>
        <PatientIntakeChat variant="landing" />
      </div>
    </div>
  )
}

/* --------------------------------- Footer ---------------------------------- */
function Footer() {
  return (
    <footer id="about" className="scroll-mt-20 bg-[var(--color-ink)] text-white/70">
      <div className="mx-auto flex max-w-none flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
        <Logo />
        <p className="text-[13.8px]">© 2026 AI UPCHAR — Better Conversations. Healthier Lives.</p>
        <div className="flex gap-5 text-[13.8px]">
          <a href="#" className="transition hover:text-white">Privacy</a>
          <a href="#" className="transition hover:text-white">Terms</a>
          <a href="#" className="transition hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  )
}

/* ----------------------------------- App ----------------------------------- */
export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-[var(--color-body)]">
      <Header />
      <main>
        <Hero />
        <Benefits />
        <ProblemSolution />
        <HowItWorks />
        <AudienceSection />
        <DetailCards />
        <CtaBand />
      </main>
      <Footer />
      <AppointmentDialog />
    </div>
  )
}
