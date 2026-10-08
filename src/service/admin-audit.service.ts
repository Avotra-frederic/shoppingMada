import AdminAudit from "../model/admin-audit.model";

export interface AdminAuditInput {
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export const recordAdminAction = (event: AdminAuditInput) => AdminAudit.create(event);
