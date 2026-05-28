export type UserRole = 'partner' | 'associate' | 'paralegal';
export type PermissionLevel = 'full' | 'read_only';
export type QueryType = 'draft' | 'research' | 'review';
export type ReviewStatus = 'pending' | 'reviewed' | 'rejected';
export type ReviewDecision = 'approved' | 'approved_with_edits' | 'rejected';

export interface Client {
  id: string;
  name: string;
  created_at: string;
}

export interface Matter {
  id: string;
  client_id: string;
  matter_name: string;
  practice_area: string | null;
  court: string | null;
  status: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  sra_number: string | null;
  created_at: string;
}

export interface MatterPermission {
  id: number;
  user_id: string;
  matter_id: string;
  permission_level: PermissionLevel;
  granted_at: string;
  granted_by: string;
}

export interface AiSession {
  id: string;
  user_id: string;
  matter_id: string;
  session_start: string;
  session_end: string | null;
  query_type: QueryType | null;
  output_token_count: number | null;
  output_hash: string | null;
  review_status: ReviewStatus;
  reviewer_id: string | null;
  review_timestamp: string | null;
  review_decision: ReviewDecision | null;
  review_notes: string | null;
  created_at: string;
}

export interface SessionWithJoins extends AiSession {
  users?: Pick<User, 'name' | 'role'> | null;
  matters?: Pick<Matter, 'matter_name' | 'client_id' | 'practice_area'> | null;
}

export interface ExportSessionRow extends AiSession {
  users?: Pick<User, 'role'> | null;
  matters?: (Pick<Matter, 'client_id' | 'practice_area'> & {
    clients?: Pick<Client, 'name'> | null;
  }) | null;
}

export interface BlockedAccessEvent {
  event_id: string;
  user_id: string;
  user_name?: string;           // joined from users table
  attempted_matter_id: string;
  reason: string;
  details: string | null;
  timestamp: string;
  chain_hash: string | null;    // forensic hash chain
}

export type AccessResult =
  | { status: 'CLEAR'; matterId: string }
  | { status: 'BLOCKED'; reason: string };

export interface DashboardStats {
  totalSessions: number;
  reviewedSessions: number;
  pendingSessions: number;
  blockedEvents: number;
  reviewedPercent: number;
}

export interface ComplianceExportRow {
  date: string;
  actor: string;
  role: string;
  matter: string;
  client: string;
  practiceArea: string;
  queryType: string;
  outputHash: string;
  reviewStatus: string;
  reviewer: string;
  reviewDate: string;
  decision: string;
  isBlockedEvent: boolean;
}
