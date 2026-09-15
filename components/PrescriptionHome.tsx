'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, CircleAlert, ClipboardList, FileText, HeartPulse, Hospital, Info, Pill, Plus, Printer, Search, Stethoscope, TestTube, Trash2, UserRound, X, Save, Eye, Edit3, Clock3, Activity, Sparkles } from 'lucide-react';
import { addAdvice, addInvestigation, addMedicine, addSymptom, removeAdvice, removeInvestigation, removeMedicine, removeSymptom, setField, setSeverity } from '@/store/prescriptionSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import type { Investigation, Medicine, SeverityStatus } from '@/types/prescription';

type InventorySuggestion = { id: string; name: string; category: string; unit?: string; price?: number };

const severityMeta: Record<SeverityStatus, { label: string; cls: string; helper: string }> = {
  stable: { label: 'Stable / Routine', cls: 'stable', helper: 'Suitable for routine treatment and follow-up.' },
  monitor: { label: 'Needs Close Monitoring', cls: 'monitor', helper: 'Requires closer observation and early follow-up.' },
  serious: { label: 'Serious / Red Flag', cls: 'serious', helper: 'Concerning findings identified. Urgent clinical evaluation advised.' },
  emergency: { label: 'Emergency', cls: 'emergency', helper: 'Immediate clinical attention or emergency referral required.' },
  evaluation: { label: 'Under Evaluation', cls: 'evaluation', helper: 'Diagnosis is not yet established; further evaluation required.' },
};

function SectionTitle({ icon: Icon, title, action }: { icon: typeof HeartPulse; title: string; action?: React.ReactNode }) {
  return <div className="section-title"><div className="section-title-left"><span className="icon-wrap"><Icon size={16}/></span><h2>{title}</h2></div>{action}</div>;
}

function SummaryBadge({ value }: { value: SeverityStatus }) {
  const meta = severityMeta[value];
  return <span className={`status-badge ${meta.cls}`}><span className="dot"/>{meta.label}</span>;
}

function calcQty(m: Medicine) {
  const perDay = m.frequency === 'Twice daily' ? 2 : m.frequency === 'Thrice daily' ? 3 : m.frequency === 'Once weekly' ? 1 / 7 : m.frequency === 'As needed' ? 1 : 1;
  const durationDays = m.durationUnit === 'weeks' ? m.duration * 7 : m.duration;
  const totalUnits = Math.ceil(Math.max(1, perDay * durationDays * m.dose));
  const packs = Math.ceil(totalUnits / m.packSize);
  return { totalUnits, packs };
}

function PrescriptionPreview() {
  const p = useAppSelector(s => s.prescription);
  return <div className="preview-shell">
    <div className="preview-tabs"><button className="active">Prescription View</button><Link href="/patient-instructions">Patient Instructions</Link></div>
    <div className="paper">
      <div className="paper-header"><div><div className="brand"><span className="brand-ai">AI</span> UPCHAR</div><div className="brand-tag">Smarter Healthcare for a Healthier Tomorrow</div></div><div className="doctor-meta"><strong>{p.doctorName}</strong><div>{p.doctorQualification}</div><div>Reg. No.: {p.doctorRegNo}</div><div>{p.clinicName}</div></div><div className="qr-placeholder">QR<br/><span>verify</span></div></div>
      <div className="paper-title">PRESCRIPTION</div>
      <div className="patient-grid"><div><b>Patient Name</b>{p.patient.name}</div><div><b>Age / Sex</b>{p.patient.age} years / {p.patient.sex}</div><div><b>UHID</b>{p.patient.uhid}</div><div><b>Appointment ID</b>{p.patient.appointmentId}</div><div><b>Date</b>{p.patient.dateTime}</div><div className="clinical-status"><b>Clinical Status</b><SummaryBadge value={p.doctorSeverity}/><small>AI: {severityMeta[p.aiSeverity].label}</small></div></div>
      <div className="paper-grid-2"><div><h4>DIAGNOSIS</h4><ol><li>{p.diagnosis}</li>{p.secondaryDiagnosis && <li>{p.secondaryDiagnosis}</li>}</ol></div><div><h4>SYMPTOMS / COMPLAINTS</h4><p>{p.symptoms.join(', ')}</p></div></div>
      <div className="paper-section"><h4>MEDICINES</h4><table><thead><tr><th>#</th><th>Medicine</th><th>Strength & Form</th><th>Dose</th><th>Frequency</th><th>Timing</th><th>Duration</th><th>After Course</th><th>Total Qty</th></tr></thead><tbody>{p.medicines.map((m,i)=>{const q=calcQty(m);return <tr key={m.id}><td>{i+1}</td><td><b>{m.brand}</b><div className="muted">({m.generic})</div></td><td>{m.strength}<br/>{m.form}</td><td>{m.dose} {m.doseUnit}</td><td>{m.frequency}</td><td>{m.timing}</td><td>{m.duration} {m.durationUnit}</td><td><b>{m.afterCourse}</b></td><td>{q.totalUnits} {m.packUnit}<br/><span className="muted">({q.packs} pack)</span></td></tr>})}</tbody></table></div>
      <div className="paper-section"><h4>INVESTIGATIONS / TESTS ADVISED</h4><ol className="plain-list">{p.investigations.map(t=><li key={t.id}><b>{t.name}</b>  {t.reason}</li>)}</ol></div>
      <div className="paper-grid-2"><div><h4>ADVICE / LIFESTYLE INSTRUCTIONS</h4><ul>{p.advice.map(a=><li key={a}>{a}</li>)}</ul></div><div><h4>FOLLOW-UP</h4><p><b>After:</b> {p.followUpAfter}</p><p><b>Purpose:</b> {p.followUpPurpose}</p><p><b>Appointment:</b> {p.appointmentType}</p></div></div>
      {p.redFlags.length > 0 && <div className="redflag-note"><CircleAlert size={15}/> <span><b>Red Flags:</b> {p.redFlags.join(', ')}</span></div>}
      <div className="signature"><div className="sign-line">Dr. {p.doctorName.replace('Dr. ','')}</div><strong>{p.doctorName}</strong><div>{p.doctorQualification}</div></div>
      <div className="paper-footer"><span>AI UPCHAR | www.aiupchar.com</span><span>Better Conversations. Better Care.</span></div>
    </div>
  </div>
}

function PrescriptionHome() {
  const dispatch = useAppDispatch();
  const p = useAppSelector(s=>s.prescription);
  const [preview, setPreview] = useState(true);
  const [showMed, setShowMed] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [symptom, setSymptom] = useState('');
  const [advice, setAdvice] = useState('');
  const [medDraft, setMedDraft] = useState<Medicine>({ id:'', brand:'', generic:'', strength:'', form:'Tablet', dose:1, doseUnit:'tablet', frequency:'Once daily', timing:'Before breakfast', duration:5, durationUnit:'days', afterCourse:'Stop', packSize:10, packUnit:'tablets' });
  const [testDraft, setTestDraft] = useState<Investigation>({ id:'', name:'', category:'Blood Test', reason:'', priority:'Routine', instruction:'', expectedDate:'-' });
  const [inventory, setInventory] = useState<InventorySuggestion[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [medicineQuery, setMedicineQuery] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState<'medicine'|'test'|null>(null);

  useEffect(() => {
    let cancelled = false;
    setInventoryLoading(true);
    Promise.all([
      fetch('/api/inventory?category=medicine').then(r => r.ok ? r.json() : Promise.reject(new Error('Medicine catalogue unavailable'))),
      fetch('/api/inventory?category=test').then(r => r.ok ? r.json() : Promise.reject(new Error('Test catalogue unavailable'))),
      fetch('/api/inventory?category=scan').then(r => r.ok ? r.json() : Promise.reject(new Error('Scan catalogue unavailable'))),
    ]).then(results => {
      if (!cancelled) setInventory(results.flatMap((result: { data?: { items?: InventorySuggestion[] } }) => result.data?.items ?? []));
    }).catch(error => {
      if (!cancelled) setInventoryError(error instanceof Error ? error.message : 'Could not load catalogue.');
    }).finally(() => {
      if (!cancelled) setInventoryLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const medicineSuggestions = inventory.filter(item => item.category === 'medicine' && medicineQuery.trim() && item.name.toLowerCase().includes(medicineQuery.toLowerCase())).slice(0, 8);
  const testSuggestions = inventory.filter(item => (item.category === 'test' || item.category === 'scan') && testQuery.trim() && item.name.toLowerCase().includes(testQuery.toLowerCase())).slice(0, 8);
  const totals = useMemo(()=>p.medicines.reduce((acc,m)=>{const q=calcQty(m); acc.units += q.totalUnits; acc.packs += q.packs; return acc;},{units:0,packs:0}),[p.medicines]);

  const saveMedicine = () => { dispatch(addMedicine({...medDraft,id: crypto.randomUUID()})); setShowMed(false); setMedDraft({...medDraft,id:''}); };
  const saveTest = () => { dispatch(addInvestigation({...testDraft,id: crypto.randomUUID()})); setShowTest(false); setTestDraft({...testDraft,id:''}); };

  const print = () => { window.print(); };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-area"><div className="brand big"><span className="brand-ai">AI</span> UPCHAR</div><div className="brand-tag">Smarter Healthcare for a Healthier Tomorrow</div></div><div className="stepper"><Step n="1" text="Clinical Details" active/><Step n="2" text="Medicines"/><Step n="3" text="Investigations"/><Step n="4" text="Advice & Follow-up"/><Step n="5" text="Preview & Sign"/></div><div className="top-actions"><button className="btn ghost">Save Draft</button><button className="btn ghost" onClick={()=>setPreview(v=>!v)}><Eye size={16}/>Preview</button><button className="btn primary" onClick={print}><Save size={16}/>Save & Sign</button><button className="icon-btn"><X size={18}/></button></div></header>
    <div className={`workspace ${preview?'with-preview':''}`}>
      <div className="editor-pane">
        <section className="card"><SectionTitle icon={UserRound} title="Patient & Appointment" action={<button className="btn small outline">View AI Consultation Summary</button>}/><div className="patient-row"><div className="avatar">RK</div><div className="patient-name"><strong>{p.patient.name}</strong><span>{p.patient.age} years&nbsp;&nbsp;|&nbsp;&nbsp;{p.patient.sex}&nbsp;&nbsp;|&nbsp;&nbsp;UHID: {p.patient.uhid}</span></div><div className="meta"><b>Appointment ID</b><span>{p.patient.appointmentId}</span></div><div className="meta"><b>Date & Time</b><span>{p.patient.dateTime}</span></div><div className="meta"><b>Type</b><span>{p.patient.type}</span></div></div></section>

        <section className="card"><SectionTitle icon={HeartPulse} title="Clinical Assessment"/><div className="clinical-layout"><div className="form-col"><label>Primary Diagnosis <em>*</em></label><div className="input with-icon"><input value={p.diagnosis} onChange={e=>dispatch(setField({key:'diagnosis',value:e.target.value}))}/><Search size={16}/></div><label>Secondary Diagnosis <span className="optional">(optional)</span></label><input value={p.secondaryDiagnosis} onChange={e=>dispatch(setField({key:'secondaryDiagnosis',value:e.target.value}))}/><label>Symptoms / Complaints</label><div className="chips">{p.symptoms.map(s=><span key={s} className="chip">{s}<button onClick={()=>dispatch(removeSymptom(s))}><X size={12}/></button></span>)}<input placeholder="Add symptom" value={symptom} onChange={e=>setSymptom(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&symptom.trim()){dispatch(addSymptom(symptom.trim()));setSymptom('')}}}/></div><button className="link-btn" onClick={()=>{if(symptom.trim()){dispatch(addSymptom(symptom.trim()));setSymptom('')}}}><Plus size={15}/> Add symptom</button></div><div className="severity-panel"><div className="panel-title">Clinical Severity / Risk Status <Info size={14}/></div><div className="severity-columns"><div><label>AI Assessment</label><div className={`severity-card ${severityMeta[p.aiSeverity].cls}`}><SummaryBadge value={p.aiSeverity}/><span>Based on symptoms and history.</span><small>For physician review.</small></div></div><div><label>Doctor Confirmed Status <em>*</em></label><select value={p.doctorSeverity} onChange={e=>dispatch(setSeverity({doctor:e.target.value as SeverityStatus}))}>{Object.entries(severityMeta).map(([key,m])=><option key={key} value={key}>{m.label}</option>)}</select></div></div><div className="status-helper"><Sparkles size={15}/>{severityMeta[p.doctorSeverity].helper}</div></div><div><label>Clinical Notes</label><textarea value={p.clinicalNotes} onChange={e=>dispatch(setField({key:'clinicalNotes',value:e.target.value}))}/><div className="counter">{p.clinicalNotes.length}/500</div></div></div>{p.redFlags.length>0?<div className="alert-box danger"><CircleAlert size={16}/><div><b>Red flags detected</b><span>{p.redFlags.join(', ')}</span></div></div>:<div className="alert-box neutral"><Check size={16}/><span>No immediate red flags detected, but symptoms require clinical review.</span></div>}</section>

        <section className="card"><SectionTitle icon={Pill} title="Medicines" action={<div className="section-actions"><button className="link-btn" onClick={()=>setShowMed(true)}><Plus size={15}/> Add Medicine</button><button className="btn small outline">Use Common Prescription</button></div>}/><div className="table-wrap"><table className="data-table"><thead><tr><th>#</th><th>Medicine (Brand/Generic)</th><th>Strength & Form</th><th>Dose per intake</th><th>Frequency</th><th>Timing</th><th>Duration</th><th>After course</th><th>Calc. Quantity</th><th>Actions</th></tr></thead><tbody>{p.medicines.map((m,i)=>{const q=calcQty(m);return <tr key={m.id}><td>{i+1}</td><td><b>{m.brand}</b><div className="muted">{m.generic}</div></td><td>{m.strength}<br/><span className="muted">{m.form}</span></td><td>{m.dose} {m.doseUnit}</td><td>{m.frequency}</td><td>{m.timing}</td><td>{m.duration} {m.durationUnit}</td><td><b>{m.afterCourse}</b></td><td><b>{q.totalUnits}</b> {m.packUnit}<div className="muted">{q.packs} pack</div></td><td><button className="icon-sm"><Edit3 size={14}/></button><button className="icon-sm danger" onClick={()=>dispatch(removeMedicine(m.id))}><Trash2 size={14}/></button></td></tr>})}</tbody></table></div><div className="medicine-total"><span>Total medicine units: <b>{totals.units}</b>  packs: <b>{totals.packs}</b></span></div></section>

        <section className="card"><SectionTitle icon={TestTube} title="Investigations / Tests" action={<button className="link-btn" onClick={()=>setShowTest(true)}><Plus size={15}/> Add Test</button>}/><div className="table-wrap"><table className="data-table"><thead><tr><th>#</th><th>Test / Investigation</th><th>Category</th><th>Reason / Clinical Indication</th><th>Priority</th><th>Instructions</th><th>Expected Date</th><th>Actions</th></tr></thead><tbody>{p.investigations.map((t,i)=><tr key={t.id}><td>{i+1}</td><td><b>{t.name}</b></td><td>{t.category}</td><td>{t.reason}</td><td>{t.priority}</td><td>{t.instruction}</td><td>{t.expectedDate}</td><td><button className="icon-sm danger" onClick={()=>dispatch(removeInvestigation(t.id))}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div></section>

        <div className="bottom-grid"><section className="card"><SectionTitle icon={Activity} title="Advice / Lifestyle Instructions"/><div className="checks"><label><input type="checkbox" defaultChecked/> Diet modification</label><label><input type="checkbox" defaultChecked/> Hydration</label><label><input type="checkbox" defaultChecked/> Exercise</label><label><input type="checkbox" defaultChecked/> Adequate sleep</label><label><input type="checkbox"/> Weight management</label><label><input type="checkbox"/> Smoking cessation</label><label><input type="checkbox"/> Alcohol avoidance</label></div><textarea placeholder="Add additional advice" value={advice} onChange={e=>setAdvice(e.target.value)} onBlur={()=>{if(advice.trim()){dispatch(addAdvice(advice));setAdvice('')}}}/><div className="advice-list">{p.advice.map(a=><span key={a}>{a}<button onClick={()=>dispatch(removeAdvice(a))}><X size={11}/></button></span>)}</div></section><section className="card"><SectionTitle icon={CalendarDays} title="Follow-up Plan"/><div className="follow-grid"><label className="switch-row">Follow-up required?<input type="checkbox" checked={p.followUpEnabled} onChange={e=>dispatch(setField({key:'followUpEnabled',value:e.target.checked}))}/><span className="switch"/></label><label>Follow-up after<select value={p.followUpAfter} onChange={e=>dispatch(setField({key:'followUpAfter',value:e.target.value}))}><option>1 week</option><option>2 weeks</option><option>4 weeks</option><option>6 weeks</option></select></label><label>or<input type="date" value={p.followUpDate} onChange={e=>dispatch(setField({key:'followUpDate',value:e.target.value}))}/></label><label>Purpose<input value={p.followUpPurpose} onChange={e=>dispatch(setField({key:'followUpPurpose',value:e.target.value}))}/></label><label>Appointment type<select value={p.appointmentType} onChange={e=>dispatch(setField({key:'appointmentType',value:e.target.value as typeof p.appointmentType}))}><option>Regular Follow-up</option><option>Urgent Follow-up</option><option>Review</option></select></label></div></section></div>
      </div>
      {preview && <aside className="preview-pane"><div className="preview-header"><div><h2>Prescription Preview</h2><span>Printable clinical document</span></div><button className="icon-btn"><Printer size={16}/></button></div><PrescriptionPreview/></aside>}
    </div>

    {showMed && <Modal title="Add medicine" onClose={()=>setShowMed(false)} onSave={saveMedicine}><div className="modal-grid"><label className="autocomplete-field">Medicine / Brand<input value={medDraft.brand} onFocus={()=>{setMedicineQuery(medDraft.brand);setActiveSuggestion('medicine')}} onChange={e=>{setMedDraft({...medDraft,brand:e.target.value});setMedicineQuery(e.target.value);setActiveSuggestion('medicine')}} placeholder={inventoryLoading?'Loading medicines':'Type medicine initials'} />{activeSuggestion==='medicine' && medicineQuery.trim() && <SuggestionList items={medicineSuggestions} loading={inventoryLoading} error={inventoryError} onSelect={item=>{setMedDraft({...medDraft,brand:item.name});setMedicineQuery(item.name);setActiveSuggestion(null)}} />}</label><label>Generic<input value={medDraft.generic} onChange={e=>setMedDraft({...medDraft,generic:e.target.value})}/></label><label>Strength<input value={medDraft.strength} onChange={e=>setMedDraft({...medDraft,strength:e.target.value})}/></label><label>Form<select value={medDraft.form} onChange={e=>setMedDraft({...medDraft,form:e.target.value as any,doseUnit:e.target.value==='Syrup'?'ml':e.target.value==='Spray'?'shots':e.target.value==='Capsule'?'capsule':'tablet',packUnit:e.target.value==='Syrup'?'bottles':e.target.value==='Spray'?'shots':e.target.value==='Capsule'?'capsules':'tablets'})}><option>Tablet</option><option>Capsule</option><option>Syrup</option><option>Spray</option><option>Injection</option><option>Cream</option></select></label><label>Dose per intake<input type="number" min="0.1" step="0.1" value={medDraft.dose} onChange={e=>setMedDraft({...medDraft,dose:Number(e.target.value)})}/></label><label>Frequency<select value={medDraft.frequency} onChange={e=>setMedDraft({...medDraft,frequency:e.target.value as any})}><option>Once daily</option><option>Twice daily</option><option>Thrice daily</option><option>Once weekly</option><option>As needed</option></select></label><label>Timing<select value={medDraft.timing} onChange={e=>setMedDraft({...medDraft,timing:e.target.value})}><option>Before breakfast</option><option>Before meals</option><option>After meals</option><option>After food</option><option>At bedtime</option></select></label><label>Duration<input type="number" min="1" value={medDraft.duration} onChange={e=>setMedDraft({...medDraft,duration:Number(e.target.value)})}/></label><label>Duration unit<select value={medDraft.durationUnit} onChange={e=>setMedDraft({...medDraft,durationUnit:e.target.value as any})}><option>days</option><option>weeks</option></select></label><label>After course<select value={medDraft.afterCourse} onChange={e=>setMedDraft({...medDraft,afterCourse:e.target.value as any})}><option>Stop</option><option>Continue</option><option>Review</option></select></label><label>Pack size<input type="number" min="1" value={medDraft.packSize} onChange={e=>setMedDraft({...medDraft,packSize:Number(e.target.value)})}/></label></div><div className="calculated-preview">Estimated quantity: <b>{calcQty(medDraft).totalUnits}</b> {medDraft.packUnit}  <b>{calcQty(medDraft).packs}</b> pack(s)</div></Modal>}
    {showTest && <Modal title="Add investigation / test" onClose={()=>setShowTest(false)} onSave={saveTest}><div className="modal-grid"><label className="autocomplete-field">Test name<input value={testDraft.name} onFocus={()=>{setTestQuery(testDraft.name);setActiveSuggestion('test')}} onChange={e=>{setTestDraft({...testDraft,name:e.target.value});setTestQuery(e.target.value);setActiveSuggestion('test')}} placeholder={inventoryLoading?'Loading tests':'Type test initials'} />{activeSuggestion==='test' && testQuery.trim() && <SuggestionList items={testSuggestions} loading={inventoryLoading} error={inventoryError} onSelect={item=>{setTestDraft({...testDraft,name:item.name,category:item.category === 'scan' ? 'Imaging' : 'Blood Test'});setTestQuery(item.name);setActiveSuggestion(null)}} />}</label><label>Category<select value={testDraft.category} onChange={e=>setTestDraft({...testDraft,category:e.target.value})}><option>Blood Test</option><option>Urine</option><option>Stool</option><option>MRI</option><option>CT Scan</option><option>Ultrasound</option><option>ECG</option><option>EEG</option><option>Biopsy</option><option>Other</option></select></label><label>Clinical reason<input value={testDraft.reason} onChange={e=>setTestDraft({...testDraft,reason:e.target.value})}/></label><label>Priority<select value={testDraft.priority} onChange={e=>setTestDraft({...testDraft,priority:e.target.value as any})}><option>Routine</option><option>Urgent</option></select></label><label>Instructions<textarea value={testDraft.instruction} onChange={e=>setTestDraft({...testDraft,instruction:e.target.value})}/></label><label>Expected date<input type="date" value={testDraft.expectedDate === '-' ? '' : testDraft.expectedDate} onChange={e=>setTestDraft({...testDraft,expectedDate:e.target.value})}/></label></div></Modal>}
  </main>
}

function Step({n,text,active}:{n:string;text:string;active?:boolean}){return <div className={`step ${active?'active':''}`}><span>{n}</span><small>{text}</small></div>}
function Modal({title,onClose,onSave,children}:{title:string;onClose:()=>void;onSave:()=>void;children:React.ReactNode}){return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div><div className="modal-body">{children}</div><div className="modal-foot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" onClick={onSave}><Check size={16}/>Save</button></div></div></div>}



function SuggestionList({ items, loading, error, onSelect }: { items: InventorySuggestion[]; loading: boolean; error: string; onSelect: (item: InventorySuggestion) => void }) {
  return <div className="autocomplete-list">{loading && <div className="autocomplete-state">Loading catalogue</div>}{!loading && error && <div className="autocomplete-state error">{error}</div>}{!loading && !error && items.length === 0 && <div className="autocomplete-state">No matching item found.</div>}{!loading && !error && items.map(item => <button type="button" key={item.id} className="autocomplete-option" onMouseDown={event => event.preventDefault()} onClick={() => onSelect(item)}><span>{item.name}</span><small>{item.category}{item.unit ? `  ${item.unit}` : ''}</small></button>)}</div>;
}

export default PrescriptionHome;





