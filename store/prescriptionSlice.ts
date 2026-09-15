import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Investigation, Medicine, PrescriptionState, SeverityStatus } from '@/types/prescription';

const initialState: PrescriptionState = {
  patient: {
    name: 'Raj Kumar', age: 42, sex: 'Male', uhid: 'UH12345',
    appointmentId: 'AP-10284', dateTime: '15 Sep 2026, 10:30 AM', type: 'Follow-up'
  },
  diagnosis: 'Acute Gastritis',
  secondaryDiagnosis: 'GERD (Probable)',
  symptoms: ['Abdominal pain', 'Nausea', 'Burning sensation'],
  aiSeverity: 'monitor',
  doctorSeverity: 'monitor',
  redFlags: [],
  clinicalNotes: 'Symptoms for 5 days, worse after meals. No vomiting, no bleeding. Advise tests and start medication.',
  medicines: [
    { id: 'm1', brand: 'Pantoprazole', generic: 'Pantoprazole', strength: '40 mg', form: 'Tablet', dose: 1, doseUnit: 'tablet', frequency: 'Once daily', timing: 'Before breakfast', duration: 5, durationUnit: 'days', afterCourse: 'Stop', packSize: 10, packUnit: 'tablets' },
    { id: 'm2', brand: 'Domperidone', generic: 'Domstal', strength: '10 mg', form: 'Tablet', dose: 1, doseUnit: 'tablet', frequency: 'Thrice daily', timing: 'Before meals', duration: 5, durationUnit: 'days', afterCourse: 'Stop', packSize: 10, packUnit: 'tablets' },
    { id: 'm3', brand: 'Sucralfate', generic: 'Sucral-O', strength: '1 g', form: 'Tablet', dose: 1, doseUnit: 'tablet', frequency: 'Twice daily', timing: 'After meals', duration: 14, durationUnit: 'days', afterCourse: 'Continue', packSize: 10, packUnit: 'tablets' },
    { id: 'm4', brand: 'Vitamin D3', generic: 'Uprise D3', strength: '60,000 IU', form: 'Capsule', dose: 1, doseUnit: 'capsule', frequency: 'Once weekly', timing: 'After food', duration: 8, durationUnit: 'weeks', afterCourse: 'Review', packSize: 8, packUnit: 'capsules' },
  ],
  investigations: [
    { id: 't1', name: 'CBC (Complete Blood Count)', category: 'Blood Test', reason: 'Evaluate infection/anemia', priority: 'Routine', instruction: 'No special preparation', expectedDate: '-' },
    { id: 't2', name: 'LFT (Liver Function Test)', category: 'Blood Test', reason: 'Assess liver function', priority: 'Routine', instruction: 'Fasting 810 hours', expectedDate: '-' },
    { id: 't3', name: 'Ultrasound Abdomen', category: 'Imaging', reason: 'Persistent abdominal pain', priority: 'Routine', instruction: 'Full bladder', expectedDate: '-' },
    { id: 't4', name: 'H. Pylori Test', category: 'Special Test', reason: 'Rule out H. pylori infection', priority: 'Routine', instruction: 'Stop PPI 2 weeks before', expectedDate: '-' },
  ],
  advice: ['Avoid spicy and oily food.', 'Eat small frequent meals.', 'Drink adequate water.', 'Walk 30 minutes daily.', 'Manage stress.'],
  followUpEnabled: true,
  followUpAfter: '2 weeks',
  followUpDate: '2026-09-29',
  followUpPurpose: 'Review symptoms and test reports',
  appointmentType: 'Regular Follow-up',
  doctorName: 'Dr. Anil Sharma', doctorQualification: 'MBBS, MD (Internal Medicine)',
  doctorRegNo: 'UP12345', clinicName: 'City Care Clinic, Lucknow', clinicLocation: 'Lucknow',
};

const slice = createSlice({
  name: 'prescription',
  initialState,
  reducers: {
    setField<K extends keyof PrescriptionState>(state: PrescriptionState, action: PayloadAction<{ key: K; value: PrescriptionState[K] }>) {
      state[action.payload.key] = action.payload.value as never;
    },
    setSeverity(state, action: PayloadAction<{ ai?: SeverityStatus; doctor?: SeverityStatus }>) {
      if (action.payload.ai) state.aiSeverity = action.payload.ai;
      if (action.payload.doctor) state.doctorSeverity = action.payload.doctor;
    },
    addMedicine(state, action: PayloadAction<Medicine>) { state.medicines.push(action.payload); },
    updateMedicine(state, action: PayloadAction<Medicine>) {
      const index = state.medicines.findIndex(m => m.id === action.payload.id);
      if (index >= 0) state.medicines[index] = action.payload;
    },
    removeMedicine(state, action: PayloadAction<string>) { state.medicines = state.medicines.filter(m => m.id !== action.payload); },
    addInvestigation(state, action: PayloadAction<Investigation>) { state.investigations.push(action.payload); },
    updateInvestigation(state, action: PayloadAction<Investigation>) {
      const index = state.investigations.findIndex(t => t.id === action.payload.id);
      if (index >= 0) state.investigations[index] = action.payload;
    },
    removeInvestigation(state, action: PayloadAction<string>) { state.investigations = state.investigations.filter(t => t.id !== action.payload); },
    addSymptom(state, action: PayloadAction<string>) { if (!state.symptoms.includes(action.payload)) state.symptoms.push(action.payload); },
    removeSymptom(state, action: PayloadAction<string>) { state.symptoms = state.symptoms.filter(s => s !== action.payload); },
    addAdvice(state, action: PayloadAction<string>) { if (action.payload.trim()) state.advice.push(action.payload.trim()); },
    removeAdvice(state, action: PayloadAction<string>) { state.advice = state.advice.filter(a => a !== action.payload); },
    resetPrescription: () => initialState,
  }
});

export const { setField, setSeverity, addMedicine, updateMedicine, removeMedicine, addInvestigation, updateInvestigation, removeInvestigation, addSymptom, removeSymptom, addAdvice, removeAdvice, resetPrescription } = slice.actions;
export default slice.reducer;





