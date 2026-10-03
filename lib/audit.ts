import { insert } from "../app/api/_lib/database";
import crypto from "crypto";

export type AuditAction = 
  | "LOGIN" 
  | "LOGOUT"
  | "CREATE_PATIENT" 
  | "UPDATE_PATIENT"
  | "VIEW_PATIENT"
  | "CREATE_APPOINTMENT"
  | "UPDATE_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "CREATE_PRESCRIPTION"
  | "SIGN_PRESCRIPTION"
  | "UPLOAD_REPORT"
  | "VIEW_REPORT"
  | "UPDATE_SETTINGS"
  | "OVERRIDE_SAFETY_CHECK";

export type EntityType = 
  | "PATIENT"
  | "APPOINTMENT"
  | "PRESCRIPTION"
  | "REPORT"
  | "USER"
  | "SETTINGS";

export interface AuditLogEntry {
  userId?: string;
  patientId?: string;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Creates an immutable audit log entry in the database.
 * 
 * @param entry The audit log data
 */
export async function logAuditAction(entry: AuditLogEntry): Promise<void> {
  const id = crypto.randomUUID();
  
  await insert("audit_logs", {
    id,
    userId: entry.userId || null,
    patientId: entry.patientId || null,
    action: entry.action,
    entityType: entry.entityType || null,
    entityId: entry.entityId || null,
    details: entry.details ? JSON.stringify(entry.details) : null,
    ipAddress: entry.ipAddress || null,
    createdAt: new Date().toISOString()
  });
}
