"use client"

import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/lib/store'
import { closeAppointmentDialog, openAppointmentDialog, setActiveSection } from '@/lib/landingSlice'
import DemoDialog from '@/components/DemoDialog'

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
  <svg {...base(p)}>
    <path d="M4 20l1.4-4A8 8 0 1 1 8 18.6L4 20z" />
    <path d="M9 9c0 3 2.5 5.5 5.5 5.5M9 9c0-.6.5-1 1-1s1 1.5 1.5 2c-.5.5-1 1-.5 1.5s1.5 1 2 .5c.5-.5 1.4 0 2 .5s.5 1-1 1" />
  </svg>
)
const PhoneCall = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5c0 8 7 15 15 15 1 0 2-1 2-2l-3-2-2 2c-3-1-6-4-7-7l2-2-2-3c-1 0-2 1-2 2z" />
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
        <span className="block font-display text-[17px] font-extrabold tracking-tight text-[var(--color-ink)]">
          AI UPCHAR
        </span>
        <span className="block text-[10px] font-medium text-[var(--color-teal-deep)]">
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
    <span className="inline-block rounded-full bg-[var(--color-mint)] px-3 py-1 text-xs font-semibold text-[var(--color-teal-deep)] ring-1 ring-[var(--color-mint-line)]">
      {children}
    </span>
  )
}

/* ---------------------------------- Header --------------------------------- */
const NAV = ['Home', 'For Patients', 'For Doctors', 'How It Works', 'Features', 'About']

function Header() {
  const dispatch = useDispatch<AppDispatch>()
  const [demoOpen, setDemoOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <>
    <header className="sticky top-0 z-50 border-b border-[var(--color-sky-line)]/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((n, i) => (
            <a
              key={n}
              href={`#${n.toLowerCase().replaceAll(' ', '-')}`}
              onClick={() => dispatch(setActiveSection(n))}
              className={`relative text-sm font-medium transition-colors hover:text-[var(--color-brand)] ${
                i === 0 ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'
              }`}
            >
              {n}
              {i === 0 && (
                <span className="absolute -bottom-1.5 left-0 h-0.5 w-full rounded bg-[var(--color-brand)]" />
              )}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setDemoOpen(true)} className="hidden rounded-lg border border-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-brand)] transition hover:bg-[var(--color-mint)] sm:block">
            Request a free demo
          </button>
          <button className="hidden rounded-lg border border-[var(--color-sky-line)] px-4 py-2 text-sm font-semibold text-[var(--color-ink-soft)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] sm:block">
            Sign In
          </button>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-lg border border-[var(--color-sky-line)] p-2 text-[var(--color-ink-soft)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] lg:hidden"
          >
            {mobileOpen ? <X width={20} height={20} /> : <span className="block space-y-1"><span className="block h-0.5 w-5 rounded bg-current" /><span className="block h-0.5 w-5 rounded bg-current" /><span className="block h-0.5 w-5 rounded bg-current" /></span>}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-[var(--color-sky-line)] bg-white px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => (
              <a key={n} href={`#${n.toLowerCase().replaceAll(' ', '-')}`} onClick={() => { dispatch(setActiveSection(n)); setMobileOpen(false) }} className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-mint)] hover:text-[var(--color-brand)]">
                {n}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-[var(--color-sky-line)] pt-3">
            <button onClick={() => { setDemoOpen(true); setMobileOpen(false) }} className="rounded-lg border border-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-[var(--color-brand)]">
              Request a free demo
            </button>
            <button className="rounded-lg border border-[var(--color-sky-line)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink-soft)]">
              Sign In
            </button>
          </div>
        </div>
      )}
    </header>
    <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
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
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-[11px] leading-snug ${
          isAi
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
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink)]">{label}</p>
        <p className="text-[10px] leading-tight text-[var(--color-body)]">{value}</p>
      </div>
    </div>
  )
}

function Hero() {
  const dispatch = useDispatch<AppDispatch>()
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[var(--color-hero)] to-white">
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-14 lg:grid-cols-[1fr_1.05fr] lg:py-16">
        <div>
          <SectionEyebrow>An Intelligent Healthcare Ecosystem</SectionEyebrow>
          <h1 className="mt-5 font-display text-[40px] font-extrabold leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-[52px]">
            Doctor se milne se pehle,{' '}
            <span className="text-[var(--color-teal)]">AI aapki problem samajh chuka hoga.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-body)]">
            AI UPCHAR patient aur doctor ke beech ek intelligent bridge hai. Appointment se lekar
            symptoms, medical history, reports aur follow-up tak — sab kuch AI samajhta hai, organize
            karta hai aur doctor ke liye taiyar karta hai.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => dispatch(openAppointmentDialog())} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--color-teal-deep)]">
              <Calendar width={17} height={17} /> Book an Appointment
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-sky-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
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
                <span className="text-[11px] font-semibold text-[var(--color-ink-soft)]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <Hand className="absolute -top-6 right-2 z-20 hidden max-w-[160px] rotate-[-4deg] text-right text-xl md:block">
            Doctor gets complete context before the consultation.
          </Hand>

          <div className="relative flex items-end justify-center gap-3">
            <div className="relative z-10 w-[210px] shrink-0 rounded-[2rem] border-[6px] border-[var(--color-ink)] bg-white shadow-2xl sm:w-[230px]">
              <div className="rounded-t-[1.6rem] bg-white px-3 pb-2 pt-3">
                <div className="flex items-center gap-2 border-b border-[var(--color-sky-line)] pb-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[var(--color-teal)] to-[var(--color-brand)] text-white">
                    <Heart width={11} height={11} />
                  </span>
                  <span className="font-display text-xs font-bold text-[var(--color-ink)]">AI UPCHAR</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 px-3 pb-3">
                <ChatBubble from="ai">
                  Namaste! Main aapki swasthya samasya ko samajhne me aapki madad karunga.
                </ChatBubble>
                <ChatBubble from="user">
                  Mere pet me dard hai aur loose motion ho raha hai 20 din se.
                </ChatBubble>
                <ChatBubble from="ai">Yeh problem kab se ho rahi hai?</ChatBubble>
                <ChatBubble from="user">Laghbhag 20 din se.</ChatBubble>
                <ChatBubble from="ai">Ek din me approximately kitni baar loose motion hota hai?</ChatBubble>
                <div className="flex items-center gap-1 pl-1 pt-0.5">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" style={{ animationDelay: '0s' }} />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" style={{ animationDelay: '.2s' }} />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" style={{ animationDelay: '.4s' }} />
                </div>
                <div className="mt-1 flex items-center gap-2 rounded-full border border-[var(--color-sky-line)] px-3 py-1.5">
                  <span className="text-[10px] text-[var(--color-body)]">Type your answer…</span>
                  <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-[var(--color-brand)] text-white">
                    <ArrowRight width={11} height={11} />
                  </span>
                </div>
              </div>
              <span className="absolute -left-16 top-24 hidden w-32 rotate-[-3deg] rounded-xl bg-white px-2 py-1.5 text-[9px] text-[var(--color-ink-soft)] shadow-md ring-1 ring-[var(--color-sky-line)] sm:block">
                AI is asking the right questions…
              </span>
            </div>

            <div className="relative z-20 -ml-6 w-[250px] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-[var(--color-sky-line)]">
              <div className="flex items-center justify-between border-b border-[var(--color-sky-line)] pb-2">
                <p className="font-display text-[13px] font-bold text-[var(--color-ink)]">
                  AI Pre-Visit Clinical Brief
                </p>
                <X width={14} height={14} className="text-[var(--color-body)]" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-sky)] text-[var(--color-brand)]">
                  <UserRound width={16} height={16} />
                </span>
                <div>
                  <p className="text-xs font-bold text-[var(--color-ink)]">Rahul Sharma, 42</p>
                  <span className="rounded-full bg-[var(--color-sky)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-brand)]">
                    Follow-up Patient
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                <BriefRow icon={FileText} label="Chief Complaint" value="Persistent abdominal discomfort" />
                <BriefRow icon={Clock} label="Duration" value="3 weeks" />
                <BriefRow icon={FileText} label="Previous Treatment" value="Yes, on medication" />
                <BriefRow icon={FileText} label="Uploaded Reports" value="2 lab reports, 1 ultrasound" />
                <BriefRow icon={Brain} label="AI Analysis" value="Likely GI infection / IBS (to be reviewed)" accent="var(--color-teal)" />
                <BriefRow icon={FileText} label="Recommended Tests" value="Stool test, CBC, LFT (suggested)" />
                <BriefRow icon={Alert} label="Alert" value="No immediate emergency signs" accent="var(--color-wa)" />
              </div>
            </div>
          </div>

          <div className="mt-4 ml-auto w-[62%] overflow-hidden rounded-2xl bg-[var(--color-sky)] shadow-lg">
            <img
              src={IMG.doctorLaptop}
              alt="Doctor reviewing an AI pre-visit clinical brief on a laptop"
              className="h-40 w-full object-cover"
              loading="lazy"
            />
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
    <section className="border-y border-[var(--color-sky-line)]/60 bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-6 px-5 py-8 sm:grid-cols-3 lg:grid-cols-5">
        {BENEFITS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-sky)] text-[var(--color-brand)]">
              <Icon width={20} height={20} />
            </span>
            <span className="whitespace-pre-line text-[13px] font-semibold leading-tight text-[var(--color-ink)]">
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
    <section className="bg-[var(--color-mint)]/40">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-16 lg:grid-cols-[0.8fr_2fr]">
        <h2 className="font-display text-[30px] font-extrabold leading-tight text-[var(--color-ink)]">
          Healthcare mein problem sirf treatment ki nahi, access aur information ki bhi hai.
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {PROBLEM_CARDS.map((c) => (
            <div key={c.title} className="rounded-2xl border p-5" style={{ background: c.bg, borderColor: c.line }}>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white" style={{ color: c.accent }}>
                  <c.icon width={17} height={17} />
                </span>
                <h3 className="font-display text-[15px] font-bold" style={{ color: c.accent }}>
                  {c.title}
                </h3>
              </div>
              <ul className="flex flex-col gap-2.5">
                {c.items.map((it) => (
                  <li key={it} className="flex gap-2 text-[13px] leading-snug text-[var(--color-ink-soft)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.accent }} />
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
  { icon: UserRound, title: 'Patient', sub: 'Website / App\nWhatsApp / Voice Call', teal: false },
  { icon: Calendar, title: 'Book Appointment', sub: 'AI starts conversation immediately', teal: false },
  { icon: Chat, title: 'Adaptive AI Conversation', sub: 'Symptoms, history, previous treatment', teal: true },
  { icon: FileText, title: 'Upload Reports', sub: 'Prescriptions, lab tests, scans, etc.', teal: false },
  { icon: Brain, title: 'AI Analysis & Patient Context', sub: 'Findings, suggestions, risk assessment', teal: true },
  { icon: FileText, title: 'Pre-Visit Brief for Doctor', sub: 'Structured & actionable', teal: false },
  { icon: Stethoscope, title: 'Doctor Consultation', sub: 'Doctor reviews, decides & treats', teal: true },
  { icon: Calendar, title: 'Follow-up Care', sub: 'Continuous health journey', teal: false },
]

function HowItWorks() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-16">
        <h2 className="font-display text-[30px] font-extrabold text-[var(--color-ink)]">How AI UPCHAR Works</h2>
        <p className="mt-2 text-[15px] text-[var(--color-body)]">
          A complete journey from your first question to better treatment.
        </p>
        <Hand className="mt-4 block text-right text-xl md:float-right md:-mt-8 md:max-w-[220px]">
          One Patient. One Healthcare Context. Across All Channels.
        </Hand>

        <div className="mt-10 flex flex-wrap items-start justify-between gap-y-8">
          {STEPS.map(({ icon: Icon, title, sub, teal }, i) => (
            <div key={title} className="flex items-start">
              <div className="flex w-[120px] flex-col items-center text-center">
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full ${
                    teal
                      ? 'bg-[var(--color-mint)] text-[var(--color-teal-deep)]'
                      : 'bg-[var(--color-sky)] text-[var(--color-brand)]'
                  }`}
                >
                  <Icon width={24} height={24} />
                </span>
                <p className="mt-3 font-display text-[13px] font-bold leading-tight text-[var(--color-ink)]">
                  {title}
                </p>
                <p className="mt-1 whitespace-pre-line text-[11px] leading-tight text-[var(--color-body)]">
                  {sub}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight width={18} height={18} className="mt-5 hidden shrink-0 text-[var(--color-sky-line)] xl:block" />
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
  { icon: Globe, title: 'Website', sub: 'Book and interact online', color: 'var(--color-brand)' },
  { icon: Phone, title: 'Mobile App', sub: 'Appointments, history, reports and more', color: 'var(--color-brand)' },
  { icon: Whatsapp, title: 'WhatsApp', sub: 'Chat naturally with AI', color: 'var(--color-wa)' },
  { icon: PhoneCall, title: 'Voice Call', sub: 'Talk to AI, create your appointment', color: 'var(--color-brand)' },
]

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] leading-snug text-[var(--color-ink-soft)]">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--color-mint)] text-[var(--color-teal-deep)]">
        <Check width={11} height={11} />
      </span>
      {children}
    </li>
  )
}

function AudienceSection() {
  return (
    <section className="bg-[var(--color-hero)]/50">
      <div className="mx-auto grid max-w-[1180px] gap-6 px-5 py-16 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[var(--color-sky-line)]">
          <div className="grid grid-cols-[110px_1fr] gap-4 p-5">
            <img
              src={IMG.patientSection}
              alt="Patient chatting with AI UPCHAR on her phone"
              className="h-full w-full rounded-xl bg-[var(--color-rose)] object-cover"
              loading="lazy"
            />
            <div>
              <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">For Patients</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {PATIENT_POINTS.map((p) => (
                  <CheckItem key={p}>{p}</CheckItem>
                ))}
              </ul>
            </div>
          </div>
          <blockquote className="mx-5 mb-5 rounded-xl bg-[var(--color-rose)]/60 p-4 text-[12.5px] italic leading-snug text-[var(--color-ink-soft)]">
            “Pehli baar laga ki doctor ke paas jaane se pehle hi kisi ne meri problem achhe se samajh li.”
            <span className="mt-2 block not-italic font-semibold text-[var(--color-ink)]">— Priya S., Patient</span>
          </blockquote>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[var(--color-sky-line)]">
          <div className="grid grid-cols-[110px_1fr] gap-4 p-5">
            <img
              src={IMG.doctorPortrait}
              alt="Doctor using AI UPCHAR clinical briefs"
              className="h-full w-full rounded-xl bg-[var(--color-sky)] object-cover"
              loading="lazy"
            />
            <div>
              <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">For Doctors</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {DOCTOR_POINTS.map((p) => (
                  <CheckItem key={p}>{p}</CheckItem>
                ))}
              </ul>
            </div>
          </div>
          <blockquote className="mx-5 mb-5 rounded-xl bg-[var(--color-sky)]/70 p-4 text-[12.5px] italic leading-snug text-[var(--color-ink-soft)]">
            “Ab consultation ke waqt main zero se shuru nahi karta. AI UPCHAR mujhe already patient ki poori story de deta hai.”
            <span className="mt-2 block not-italic font-semibold text-[var(--color-ink)]">— Dr. Amit Verma, General Physician</span>
          </blockquote>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[var(--color-sky-line)]">
          <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">Multiple Ways to Connect</h3>
          <p className="mt-1 text-[13px] text-[var(--color-body)]">
            Healthcare shouldn&apos;t require learning a new app.
          </p>
          <div className="mt-5 flex flex-col gap-4">
            {CONNECT.map(({ icon: Icon, title, sub, color }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-sky)]" style={{ color }}>
                  <Icon width={19} height={19} />
                </span>
                <div>
                  <p className="text-sm font-bold text-[var(--color-ink)]">{title}</p>
                  <p className="text-[12px] text-[var(--color-body)]">{sub}</p>
                </div>
              </div>
            ))}
          </div>
          <Hand className="mt-6 block text-lg">Same AI. Same Patient Context. Across all platforms.</Hand>
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
    <section className="bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-6 px-5 pb-16 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-sky-line)] p-6">
          <h3 className="font-display text-base font-bold text-[var(--color-brand)]">
            Real Example: AI Conversation for a New Patient
          </h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              {CONV.map((c, i) => {
                const isAi = c.from === 'ai'
                return (
                  <div key={i} className={`flex items-end gap-1.5 ${isAi ? '' : 'flex-row-reverse'}`}>
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${
                        isAi ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-brand)]'
                      }`}
                    >
                      {isAi ? <Brain width={12} height={12} /> : <UserRound width={12} height={12} />}
                    </span>
                    <span
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[11px] leading-snug ${
                        isAi
                          ? 'rounded-bl-sm bg-[var(--color-mint)] text-[var(--color-ink)]'
                          : 'rounded-br-sm bg-[var(--color-sky)] text-[var(--color-ink)]'
                      }`}
                    >
                      {c.text}
                    </span>
                  </div>
                )
              })}
              <div className="flex gap-1 pl-8 pt-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" style={{ animationDelay: '.2s' }} />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" style={{ animationDelay: '.4s' }} />
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {CONV_POINTS.map((p) => (
                <CheckItem key={p}>{p}</CheckItem>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-sky-line)] p-6">
          <h3 className="font-display text-base font-bold text-[var(--color-brand)]">
            Your Medical Documents Become Usable Context
          </h3>
          <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <ul className="flex flex-col gap-2">
              {DOCS.map((d) => (
                <li
                  key={d}
                  className="flex items-center gap-2 rounded-lg bg-[var(--color-sky)]/60 px-3 py-2 text-[12px] font-medium text-[var(--color-ink)]"
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
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-teal-deep)]">
                <Brain width={14} height={14} /> AI Analysis
              </p>
              <ul className="flex flex-col gap-1.5">
                {INSIGHTS.map((it) => (
                  <li key={it.label} className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-soft)]">
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
          <Hand className="mt-4 block text-right text-lg">From files to meaningful insights.</Hand>
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
      <img
        src={IMG.familyMountain}
        alt="A family looking out over mountains at sunset"
        className="absolute inset-0 h-full w-full bg-[var(--color-ink)] object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-ink)]/85 via-[var(--color-ink)]/55 to-[var(--color-brand)]/40" />
      <div className="relative mx-auto flex max-w-[1180px] flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-[26px] font-extrabold leading-snug text-white sm:text-[30px]">
            From “Mujhe doctor ko dikhana hai” to “Doctor already understands my case.”
          </h2>
          <p className="mt-3 text-[15px] text-white/85">AI UPCHAR connects the entire journey.</p>
        </div>
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => dispatch(openAppointmentDialog())} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[var(--color-teal-deep)]">
              <Calendar width={16} height={16} /> Book an Appointment <ArrowRight width={15} height={15} />
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/40 backdrop-blur-sm transition hover:bg-white/20">
              <Play width={13} height={13} /> Watch Demo
            </button>
          </div>
          <Hand className="text-2xl text-white">Better Conversations Healthier Lives</Hand>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Footer ---------------------------------- */
function Footer() {
  return (
    <footer className="bg-[var(--color-ink)] text-white/70">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
        <Logo />
        <p className="text-xs">© 2026 AI UPCHAR — Better Conversations. Healthier Lives.</p>
        <div className="flex gap-5 text-xs">
          <a href="#" className="transition hover:text-white">Privacy</a>
          <a href="#" className="transition hover:text-white">Terms</a>
          <a href="#" className="transition hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  )
}

function AppointmentDialog() {
  const dispatch = useDispatch<AppDispatch>()
  const open = useSelector((state: RootState) => state.landing.appointmentDialogOpen)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[var(--color-ink)]/40 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Book an appointment">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-display text-xl font-bold text-[var(--color-ink)]">Book an Appointment</h2><p className="mt-1 text-sm text-[var(--color-body)]">Our intelligent intake will guide you through the next steps.</p></div>
          <button onClick={() => dispatch(closeAppointmentDialog())} className="rounded-lg p-2 text-[var(--color-ink-soft)] hover:bg-[var(--color-sky)]" aria-label="Close appointment dialog"><X width={18} height={18} /></button>
        </div>
        <button onClick={() => dispatch(closeAppointmentDialog())} className="mt-5 w-full rounded-xl bg-[var(--color-teal)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-teal-deep)]">Start patient intake</button>
      </div>
    </div>
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
