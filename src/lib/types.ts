/** Mirrors the enums and core rows in supabase/migrations/0001_foundation.sql */

export type UserRole =
  | "broker_of_record"
  | "alternate_bor"
  | "compliance_officer"
  | "agent";

export type UserStatus = "pending" | "active" | "deactivated";

export type RuleSeverity = "critical" | "warning" | "confirm";

export type RuleOutcome = "passed" | "warning" | "critical" | "confirm";

export type DealStatus =
  | "draft"
  | "scanning"
  | "needs_attention"
  | "cleared"
  | "submitted";

export interface Brokerage {
  id: string;
  name: string;
  slug: string; // subdomain: {slug}.brokerpass.ca
  email_domain: string | null;
  plan: "pilot" | "starter" | "pro" | "enterprise";
  created_at: string;
}

export interface Profile {
  id: string; // = auth.users.id
  brokerage_id: string;
  role: UserRole;
  status: UserStatus;
  full_name: string;
  email: string;
  created_at: string;
}

export interface Deal {
  id: string;
  brokerage_id: string;
  agent_id: string; // whose file this lives in
  submitted_by: string; // who uploaded it (may differ: submit on behalf)
  deal_type: string;
  property_address: string | null;
  status: DealStatus;
  created_at: string;
  updated_at: string;
}

export const ADMIN_ROLES: UserRole[] = [
  "broker_of_record",
  "alternate_bor",
  "compliance_officer",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  broker_of_record: "Broker of Record",
  alternate_bor: "Alternate Broker of Record",
  compliance_officer: "Compliance Officer",
  agent: "Agent",
};
