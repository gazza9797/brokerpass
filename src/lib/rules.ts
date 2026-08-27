import ruleset from "../../supabase/functions/_shared/ruleset-v1.json";
import packageRules from "../../supabase/functions/_shared/package-rules.json";

export interface Rule {
  rule_id: string;
  category: number;
  category_name: string;
  bulletin: string;
  severity: "Critical" | "Warning" | "Confirm";
  version: number;
  mca_validate: boolean;
  rule_name: string;
  requirement: string;
  applies_when: string;
  detection_signal: string;
  detection_strategy: string;
  finding_template: string;
  confirm_text: string | null;
  fix_guidance: string;
  source: string;
  pinpoint: string;
  notes: string;
}

const ALL: Rule[] = [
  ...(packageRules.rules as Rule[]),
  ...(ruleset.rules as Rule[]),
];

const BY_ID = new Map(ALL.map((r) => [r.rule_id, r]));

export const RULESET_VERSION = `${ruleset.meta.version}+pkg-${packageRules.meta.version}`;

export function getRule(id: string): Rule | undefined {
  return BY_ID.get(id);
}

export function allRules(): Rule[] {
  return ALL;
}
