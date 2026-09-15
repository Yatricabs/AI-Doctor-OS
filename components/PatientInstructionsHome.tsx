'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText, HeartPulse, Info, PhoneCall, Pill, Printer, ShieldAlert, Stethoscope, TestTube, UserRound } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import type { Medicine, SeverityStatus } from '@/types/prescription';

const severityMeta: Record<SeverityStatus, { label: string; cls: string; helper: string }> = {
  stable: { label: 'Stable / Routine', cls: 'stable', helper: 'Your current plan is suitable for routine treatment and follow-up.' },
  monitor: { label: 'Needs Close Monitoring', cls: 'monitor', helper: 'Please follow the treatment plan carefully and attend the planned follow-up.' },
  serious: { label: 'Serious / Red Flag', cls: 'serious', helper: 'Your doctor has identified findings that need closer medical attention.' },
  emergency: { label: 'Emergency', cls: 'emergency', helper: 'Please follow the doctors urgent instructions and seek immediate medical attention when advised.' },
  evaluation: { label: 'Under Evaluation', cls: 'evaluation', helper: 'Further tests/evaluation are needed before the condition is fully established.' },
};

function frequencyCount(m: Medicine) {
  switch (m.frequency) {
    case 'Twice daily': return 2;
    case 'Thrice daily': return 3;
    case 'Once weekly': return 1 / 7;
    case 'As needed': return null;
    default: return 1;
  }
}

function medicineQuantity(m: Medicine) {
  const count = frequencyCount(m);
  if (count == null) return { units: null, packs: null };
  const days = m.durationUnit === 'weeks' ? m.duration * 7 : m.duration;
  const units = Math.ceil(Math.max(1, m.dose * count * days));
  const packs = Math.ceil(units / Math.max(1, m.packSize));
  return { units, packs };
}

function MedicineRow({ medicine, index }: { medicine: Medicine; index: number }) {
  const qty = medicineQuantity(medicine);
  const courseLabel = medicine.afterCourse === 'Stop' ? 'STOP AFTER COURSE' : medicine.afterCourse === 'Review' ? 'REVIEW AFTER COURSE' : 'CONTINUE';
  const courseClass = medicine.afterCourse === 'Stop' ? 'stop' : medicine.afterCourse === 'Review' ? 'review' : 'continue';
  const stopText = medicine.afterCourse === 'Stop' ? 'Stop after the prescribed course' : medicine.afterCourse === 'Review' ? 'Continue until review / doctor advice' : 'Continue as prescribed';

  return (
    <div className="patient-med-card">
      <div className="patient-med-head">
        <div className="patient-med-index">{index + 1}</div>
        <div>
          <div className="patient-med-name">{medicine.brand} <span>{medicine.strength}</span></div>
          <div className="patient-med-form">{medicine.form}  {medicine.generic}</div>
        </div>
        <div className={`course-badge ${courseClass}`}>{courseLabel}</div>
      </div>
      <div className="patient-med-grid">
        <div><span>DOSE</span><strong>{medicine.dose} {medicine.doseUnit}</strong></div>
        <div><span>HOW OFTEN</span><strong>{medicine.frequency}</strong></div>
        <div><span>WHEN</span><strong>{medicine.timing}</strong></div>
        <div><span>FOR</span><strong>{medicine.duration} {medicine.durationUnit}</strong></div>
      </div>
      <div className="patient-med-bottom">
        <div className="patient-med-instruction"><Info size={14}/><span>{stopText}</span></div>
        <div className="patient-qty">
          {qty.units != null ? <>Approx. quantity: <strong>{qty.units} {medicine.packUnit}</strong>{qty.packs ? <>  <strong>{qty.packs} pack(s)</strong></> : null}</> : <>Use only when required, as instructed.</>}
        </div>
      </div>
    </div>
  );
}

function PatientInstructionsHome() {
  const p = useAppSelector(s => s.prescription);
  const severity = severityMeta[p.doctorSeverity];

  return (
    <main className="patient-page">
      <header className="patient-topbar">
        <div className="patient-brand"><span>AI</span> UPCHAR <small>Patient Care</small></div>
        <div className="patient-top-actions">
          <Link className="btn outline small" href="/"><ArrowLeft size={14}/> Doctor View</Link>
          <button className="btn outline small" onClick={() => window.print()}><Printer size={14}/> Print</button>
        </div>
      </header>

      <div className="patient-shell">
        <div className="patient-hero">
          <div><div className="eyebrow">AFTER VISIT CARE PLAN</div><h1>Your Treatment &amp; Care Instructions</h1><p>Everything you need to follow the treatment plan prescribed by your doctor.</p></div>
          <div className={`patient-severity ${severity.cls}`}><div className="severity-kicker">CURRENT STATUS</div><strong>{severity.label}</strong><span>{severity.helper}</span></div>
        </div>

        <section className="patient-card patient-patient-card">
          <div className="patient-section-title"><div className="patient-title-icon"><UserRound size={17}/></div><h2>Patient &amp; Appointment</h2></div>
          <div className="patient-info-grid">
            <div><span>PATIENT</span><strong>{p.patient.name}</strong></div>
            <div><span>AGE / SEX</span><strong>{p.patient.age} / {p.patient.sex}</strong></div>
            <div><span>UHID</span><strong>{p.patient.uhid}</strong></div>
            <div><span>APPOINTMENT</span><strong>{p.patient.appointmentId}</strong></div>
            <div><span>DATE &amp; TIME</span><strong>{p.patient.dateTime}</strong></div>
            <div><span>DOCTOR</span><strong>{p.doctorName}</strong></div>
          </div>
        </section>

        <div className="patient-columns">
          <div className="patient-main">
            <section className="patient-card">
              <div className="patient-section-title"><div className="patient-title-icon"><HeartPulse size={17}/></div><h2>Your Health Summary</h2></div>
              <div className="patient-diagnosis-box">
                <div><span>PRIMARY DIAGNOSIS</span><strong>{p.diagnosis}</strong></div>
                {p.secondaryDiagnosis && <div><span>SECONDARY / PROBABLE</span><strong>{p.secondaryDiagnosis}</strong></div>}
              </div>
              <div className="patient-subtitle">Symptoms / concerns recorded</div>
              <div className="patient-chip-row">{p.symptoms.map(s => <span className="patient-chip" key={s}>{s}</span>)}</div>
              {p.clinicalNotes && <div className="patient-note"><FileText size={15}/><div><strong>Doctors clinical note</strong><p>{p.clinicalNotes}</p></div></div>}
            </section>

            <section className="patient-card">
              <div className="patient-section-title"><div className="patient-title-icon"><Pill size={17}/></div><h2>Medicines  How to Take Them</h2></div>
              <p className="patient-intro">Please take each medicine exactly as prescribed. Do not change the dose or stop a medicine early unless your doctor tells you to.</p>
              <div className="patient-med-list">{p.medicines.map((m, i) => <MedicineRow key={m.id} medicine={m} index={i}/>)}</div>
            </section>

            <section className="patient-card">
              <div className="patient-section-title"><div className="patient-title-icon"><TestTube size={17}/></div><h2>Tests &amp; Investigations</h2></div>
              <div className="patient-test-list">
                {p.investigations.map((t, i) => (
                  <div className="patient-test-row" key={t.id}>
                    <div className="patient-test-no">{i + 1}</div>
                    <div className="patient-test-body"><strong>{t.name}</strong><span>{t.category}  {t.reason}</span>{t.instruction && <small>Preparation: {t.instruction}</small>}</div>
                    <span className={`priority-pill ${t.priority === 'Urgent' ? 'urgent' : 'routine'}`}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="patient-card">
              <div className="patient-section-title"><div className="patient-title-icon"><Stethoscope size={17}/></div><h2>Advice &amp; Daily Care</h2></div>
              <div className="patient-advice-list">{p.advice.map(a => <div className="patient-advice-item" key={a}><CheckCircle2 size={16}/><span>{a}</span></div>)}</div>
            </section>
          </div>

          <aside className="patient-side">
            <section className="patient-card follow-card">
              <div className="patient-section-title"><div className="patient-title-icon"><CalendarDays size={17}/></div><h2>Follow-up Plan</h2></div>
              {p.followUpEnabled ? <>
                <div className="follow-big-date"><CalendarDays size={18}/><div><span>COME BACK ON</span><strong>{p.followUpDate}</strong></div></div>
                <div className="follow-detail"><Clock3 size={15}/><div><span>FOLLOW-UP TYPE</span><strong>{p.appointmentType}</strong></div></div>
                <div className="follow-detail"><FileText size={15}/><div><span>WHY</span><strong>{p.followUpPurpose}</strong></div></div>
                <button className="btn primary full"><CalendarDays size={14}/> Request Follow-up Appointment</button>
              </> : <div className="empty-follow">No follow-up appointment has been scheduled yet.</div>}
            </section>

            <section className="patient-card safety-card">
              <div className="patient-section-title"><div className="patient-title-icon"><ShieldAlert size={17}/></div><h2>When to Seek Urgent Help</h2></div>
              {p.redFlags.length ? <div className="redflag-list">{p.redFlags.map(flag => <div key={flag}><ShieldAlert size={15}/>{flag}</div>)}</div> : <p className="muted-copy">No specific red flags were recorded in this visit. If you develop a sudden or severe worsening of symptoms, seek medical attention.</p>}
              <div className="emergency-box"><strong>Emergency?</strong><span>Call your local emergency service or go to the nearest emergency department if symptoms become severe or life-threatening.</span></div>
            </section>

            <section className="patient-card contact-card">
              <div className="patient-section-title"><div className="patient-title-icon"><PhoneCall size={17}/></div><h2>Clinic Information</h2></div>
              <strong>{p.clinicName}</strong><span>{p.clinicLocation}</span>
              <div className="contact-actions"><button className="btn outline small"><PhoneCall size={14}/> Call Clinic</button><Link href="/" className="btn outline small"><FileText size={14}/> View Prescription</Link></div>
            </section>
          </aside>
        </div>

        <section className="patient-footer-note"><Info size={15}/><div><strong>Important:</strong> This page is a patient-friendly summary of the clinicians signed treatment plan. It does not replace medical advice. Contact your doctor if you have questions about any medicine, test, or symptom.</div></section>
        <footer className="patient-footer"><span>AI UPCHAR  Patient Care Plan</span><span>Prepared for {p.patient.name}  {p.patient.appointmentId}</span></footer>
      </div>
    </main>
  );
}



export default PatientInstructionsHome;





