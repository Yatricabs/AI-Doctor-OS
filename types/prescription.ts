export type SeverityStatus =
  | 'stable'
  | 'monitor'
  | 'serious'
  | 'emergency'
  | 'evaluation';

export type Frequency = 'Once daily' | 'Twice daily' | 'Thrice daily' | 'Once weekly' | 'As needed';
export type RouteForm = 'Tablet' | 'Capsule' | 'Syrup' | 'Spray' | 'Injection' | 'Cream';

export interface Patient {
  name: string;
  age: number;
  sex: string;
  uhid: string;
  appointmentId: string;
  dateTime: string;
  type: string;
}

export interface Medicine {
  id: string;
  brand: string;
  generic: string;
  strength: string;
  form: RouteForm;
  dose: number;
  doseUnit: string;
  frequency: Frequency;
  timing: string;
  duration: number;
  durationUnit: 'days' | 'weeks';
  afterCourse: 'Stop' | 'Continue' | 'Review';
  packSize: number;
  packUnit: string;
}

export interface Investigation {
  id: string;
  name: string;
  category: string;
  reason: string;
  priority: 'Routine' | 'Urgent';
  instruction: string;
  expectedDate: string;
}

export interface PrescriptionState {
  patient: Patient;
  diagnosis: string;
  secondaryDiagnosis: string;
  symptoms: string[];
  aiSeverity: SeverityStatus;
  doctorSeverity: SeverityStatus;
  redFlags: string[];
  clinicalNotes: string;
  medicines: Medicine[];
  investigations: Investigation[];
  advice: string[];
  followUpEnabled: boolean;
  followUpAfter: string;
  followUpDate: string;
  followUpPurpose: string;
  appointmentType: 'Regular Follow-up' | 'Urgent Follow-up' | 'Review';
  doctorName: string;
  doctorQualification: string;
  doctorRegNo: string;
  clinicName: string;
  clinicLocation: string;
}


