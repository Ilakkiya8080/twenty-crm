export interface HealthcareModule {
  name: string;
  plural: string;
  singular: string;
  icon: string;
  description: string;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
  }>;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface HealthcarePipeline {
  id: string;
  name: string;
  targetObject: string;
  stages: PipelineStage[];
}

export const HEALTHCARE_MODULES: HealthcareModule[] = [
  {
    name: 'Patients',
    plural: 'patients',
    singular: 'patient',
    icon: 'IconHeartbeat',
    description: 'Patient records, demographics, medical history, contact info, and status.',
    fields: [
      { name: 'patientId', label: 'Patient ID', type: 'TEXT', required: true },
      { name: 'name', label: 'Full Name', type: 'FULL_NAME', required: true },
      { name: 'phone', label: 'Phone', type: 'PHONES', required: true },
      { name: 'email', label: 'Email', type: 'EMAILS', required: true },
      { name: 'dateOfBirth', label: 'Date of Birth', type: 'DATE', required: false },
      { name: 'gender', label: 'Gender', type: 'SELECT', required: false },
      { name: 'address', label: 'Address', type: 'ADDRESS', required: false },
      { name: 'recordStatus', label: 'Record Status', type: 'SELECT', required: true },
    ],
  },
  {
    name: 'Appointments',
    plural: 'appointments',
    singular: 'appointment',
    icon: 'IconCalendarEvent',
    description: 'Clinical visits, schedule, department, assigned doctor, and consultation status.',
    fields: [
      { name: 'appointmentId', label: 'Appointment ID', type: 'TEXT', required: true },
      { name: 'patient', label: 'Patient', type: 'RELATION', required: true },
      { name: 'doctor', label: 'Doctor', type: 'RELATION', required: true },
      { name: 'department', label: 'Department', type: 'RELATION', required: true },
      { name: 'appointmentDate', label: 'Appointment Date', type: 'DATE', required: true },
      { name: 'appointmentTime', label: 'Appointment Time', type: 'TEXT', required: true },
      { name: 'reason', label: 'Reason for Visit', type: 'TEXT', required: true },
      { name: 'status', label: 'Status', type: 'SELECT', required: true },
    ],
  },
  {
    name: 'Doctors',
    plural: 'doctors',
    singular: 'doctor',
    icon: 'IconUserCheck',
    description: 'Physicians, specialists, department affiliations, contact details, and availability.',
    fields: [
      { name: 'doctorId', label: 'Doctor ID', type: 'TEXT', required: true },
      { name: 'name', label: 'Doctor Name', type: 'FULL_NAME', required: true },
      { name: 'specialization', label: 'Specialization', type: 'TEXT', required: true },
      { name: 'department', label: 'Department', type: 'RELATION', required: true },
      { name: 'phone', label: 'Phone', type: 'PHONES', required: true },
      { name: 'email', label: 'Email', type: 'EMAILS', required: true },
      { name: 'availability', label: 'Availability', type: 'TEXT', required: true },
    ],
  },
  {
    name: 'Departments',
    plural: 'departments',
    singular: 'department',
    icon: 'IconBuildingHospital',
    description: 'Hospital & clinic divisions (Cardiology, Neurology, Pediatrics, Orthopedics, etc.).',
    fields: [
      { name: 'departmentName', label: 'Department Name', type: 'TEXT', required: true },
      { name: 'departmentHead', label: 'Department Head', type: 'TEXT', required: true },
      { name: 'location', label: 'Location / Wing', type: 'TEXT', required: false },
      { name: 'description', label: 'Description', type: 'TEXT', required: false },
      { name: 'contactPhone', label: 'Contact Phone', type: 'PHONES', required: false },
    ],
  },
  {
    name: 'Follow-ups',
    plural: 'followUps',
    singular: 'followUp',
    icon: 'IconCalendarCheck',
    description: 'Post-consultation care, lab review reminders, suture removal, and prescription checks.',
    fields: [
      { name: 'patient', label: 'Patient', type: 'RELATION', required: true },
      { name: 'relatedAppointment', label: 'Related Appointment', type: 'RELATION', required: false },
      { name: 'assignedDoctor', label: 'Assigned Doctor', type: 'RELATION', required: true },
      { name: 'followUpDate', label: 'Follow-up Date', type: 'DATE', required: true },
      { name: 'notes', label: 'Clinical Notes', type: 'TEXT', required: true },
      { name: 'priority', label: 'Priority', type: 'SELECT', required: false },
      { name: 'status', label: 'Status', type: 'SELECT', required: true },
    ],
  },
  {
    name: 'Reports',
    plural: 'reports',
    singular: 'report',
    icon: 'IconChartBar',
    description: 'Operational analytics: Patient volume, appointment completion, doctor workload, and compliance.',
    fields: [
      { name: 'reportTitle', label: 'Report Title', type: 'TEXT', required: true },
      { name: 'category', label: 'Category', type: 'SELECT', required: true },
      { name: 'summary', label: 'Executive Summary', type: 'TEXT', required: true },
      { name: 'generatedAt', label: 'Generated Date', type: 'DATE_TIME', required: true },
    ],
  },
];

export const HEALTHCARE_PIPELINES: HealthcarePipeline[] = [
  {
    id: 'patient-acquisition',
    name: 'Patient Acquisition Pipeline',
    targetObject: 'opportunity',
    stages: [
      { id: '20202020-8e01-4afd-9c39-d2063097587a', name: 'New Inquiry', color: 'sky', position: 0 },
      { id: '20202020-e685-4671-ac32-26d304dacb6e', name: 'Contacted', color: 'purple', position: 1 },
      { id: '20202020-dde9-4acc-b5ca-f6531a8ecb4a', name: 'Appointment Booked', color: 'blue', position: 2 },
      { id: '20202020-696e-4f6b-91bc-f413e9b2f654', name: 'Converted', color: 'green', position: 3 },
      { id: '20202020-0bb5-4a6f-a8b2-774bbad21104', name: 'Lost', color: 'red', position: 4 },
    ],
  },
  {
    id: 'appointment-management',
    name: 'Appointment Management Pipeline',
    targetObject: 'opportunity',
    stages: [
      { id: '20202020-0001-4afd-9c39-d2063097587a', name: 'Requested', color: 'yellow', position: 0 },
      { id: '20202020-0002-4671-ac32-26d304dacb6e', name: 'Confirmed', color: 'blue', position: 1 },
      { id: '20202020-0003-4acc-b5ca-f6531a8ecb4a', name: 'Checked In', color: 'purple', position: 2 },
      { id: '20202020-0004-4f6b-91bc-f413e9b2f654', name: 'Completed', color: 'green', position: 3 },
      { id: '20202020-0005-4a6f-a8b2-774bbad21104', name: 'Cancelled', color: 'red', position: 4 },
      { id: '20202020-0006-4a6f-a8b2-774bbad21105', name: 'No-show', color: 'gray', position: 5 },
    ],
  },
];
