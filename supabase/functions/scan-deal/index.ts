// BrokerPass scan engine — Supabase Edge Function (Deno)
//
// POST { deal_id } with Authorization: Bearer <service role key>
// Returns 202 immediately and runs the scan in the background:
//   1. load the deal + its live PDF from storage
//   2. send the PDF and the ruleset to Claude, forcing a structured tool call
//   3. write one scan row + one finding per applicable rule
//   4. recompute the deal status (cleared / needs_attention)

import { createClient } from "npm:@supabase/supabase-js@2";
import ruleset from "../_shared/ruleset-v1.json" with { type: "json" };
import packageRules from "../_shared/package-rules.json" with { type: "json" };

type Severity = "Critical" | "Warning" | "Confirm";
interface Rule {
  rule_id: string;
  severity: Severity;
  version: number;
  rule_name: string;
  requirement: string;
  applies_when: string;
  detection_signal: string;
  detection_strategy: string;
  finding_template: string;
  confirm_text: string | null;
  fix_guidance: string;
}

const RULES: Rule[] = [...packageRules.rules, ...ruleset.rules] as Rule[];
const RULESET_VERSION = `${ruleset.meta.version}+pkg-${packageRules.meta.version}`;
const AUTO_RULES = RULES.filter((r) => !r.detection_strategy.startsWith("Manual"));
const MANUAL_RULES = RULES.filter((r) => r.detection_strategy.startsWith("Manual"));

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5";

const DEAL_TYPE_LABELS: Record<string, string> = {
  aps_residential: "Agreement of Purchase and Sale (Residential, OREA Form 100)",
  aps_condo: "Agreement of Purchase and Sale (Condominium, OREA Form 101)",
  listing_seller: "Listing Agreement / Seller Representation (OREA Form 200)",
  buyer_rep: "Buyer Representation Agreement (OREA Form 300)",
  lease_residential: "Agreement to Lease (Residential, OREA Form 400)",
  amendment: "Amendment to Agreement (OREA Form 120)",
  waiver_nof: "Waiver / Notice of Fulfillment of Condition (OREA Form 123/124)",
  mutual_release: "Mutual Release (OREA Form 122)",
  assignment: "Assignment of Agreement (OREA Form 145/150)",
};

// ---------------------------------------------------------------------------
// Tool schema Claude must fill in
// ---------------------------------------------------------------------------
const REPORT_TOOL = {
  name: "report_findings",
  description:
    "Report the result of checking a real estate deal package against the BrokerPass ruleset.",
  input_schema: {
    type: "object",
    required: ["package_summary", "forms_found", "auto_results", "manual_applicability"],
    properties: {
      package_summary: {
        type: "string",
        description:
          "One or two plain-English sentences: what this package is (forms, property, parties, key dates). No advice.",
      },
      forms_found: {
        type: "array",
        items: {
          type: "object",
          required: ["form", "pages"],
          properties: {
            form: { type: "string", description: "e.g. 'OREA Form 100 Agreement of Purchase and Sale'" },
            pages: { type: "string", description: "page range in the PDF, e.g. '1-6'" },
          },
        },
      },
      auto_results: {
        type: "array",
        description: "One entry for EVERY rule in the AUTO list, in any order.",
        items: {
          type: "object",
          required: ["rule_id", "result", "confidence"],
          properties: {
            rule_id: { type: "string" },
            result: {
              type: "string",
              enum: ["passed", "failed", "not_applicable"],
              description:
                "passed = requirement met; failed = requirement not met (a finding); not_applicable = the rule's applies_when does not describe this package.",
            },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            finding: {
              type: "string",
              description:
                "Required when failed. One or two sentences an agent can act on. Name the form, the field and the party. No legal advice.",
            },
            evidence: {
              type: "string",
              description: "Required when failed. What you saw: quote the field label / text, or describe the blank.",
            },
            page: { type: "integer", description: "1-based PDF page where the issue is. Required when failed." },
          },
        },
      },
      manual_applicability: {
        type: "array",
        description:
          "One entry for EVERY rule in the MANUAL list: does its applies_when describe this package?",
        items: {
          type: "object",
          required: ["rule_id", "applies"],
          properties: {
            rule_id: { type: "string" },
            applies: { type: "boolean" },
            note: { type: "string", description: "Optional: why it applies or why not, one short sentence." },
          },
        },
      },
    },
  },
};

function rulesForPrompt(rules: Rule[], includeDetection: boolean) {
  return rules
    .map((r) => {
      const lines = [
        `- ${r.rule_id} [${r.severity}] ${r.rule_name}`,
        `  requirement: ${r.requirement}`,
        `  applies_when: ${r.applies_when}`,
      ];
      if (includeDetection) lines.push(`  detection_signal: ${r.detection_signal}`);
      return lines.join("\n");
    })
    .join("\n");
}

function buildPrompt(dealType: string, address: string | null) {
  return `You are the BrokerPass compliance scanner for Ontario real estate brokerages. You are reading a deal package a salesperson is about to submit to their brokerage's compliance department. Your job is to check the package against the ruleset below and report exactly what you find. You are a second set of eyes, not a lawyer: report facts about the documents, never legal conclusions.

Submitted deal type: ${DEAL_TYPE_LABELS[dealType] ?? dealType}
Property address entered by the submitter: ${address ?? "(not entered)"}

How to work:
1. Read every page. Note which OREA/brokerage forms are present and their page ranges.
2. For each AUTO rule, decide passed / failed / not_applicable. "not_applicable" means the rule's applies_when does not describe this package (for example, a representation-agreement rule when no representation agreement is in the package). Do not invent forms that are not there.
3. When a rule fails, give the page number, quote or describe the evidence, and write a finding an agent can act on. Be specific: form, field, party.
4. Be strict on blanks: an empty signature line, initial box, date or time field is a failure for the rule that governs it. Be careful on judgment calls: if you cannot tell from the document, choose passed with confidence "low" rather than inventing a failure.
5. For each MANUAL rule, only decide whether it applies to this package. These become attestation checkboxes for the agent; you are not evaluating them.
6. If the upload is clearly not a real estate deal package, fail BP-PKG-05 with high confidence and mark every other rule not_applicable.

AUTO rules (evaluate each):
${rulesForPrompt(AUTO_RULES, true)}

MANUAL rules (applicability only):
${rulesForPrompt(MANUAL_RULES, false)}

Call the report_findings tool with one entry for every rule in both lists.`;
}

// ---------------------------------------------------------------------------
// Anthropic call
// ---------------------------------------------------------------------------
interface ReportInput {
  package_summary: string;
  forms_found: { form: string; pages: string }[];
  auto_results: {
    rule_id: string;
    result: "passed" | "failed" | "not_applicable";
    confidence: "high" | "medium" | "low";
    finding?: string;
    evidence?: string;
    page?: number;
  }[];
  manual_applicability: { rule_id: string; applies: boolean; note?: string }[];
}

async function askClaude(pdfBase64: string, prompt: string): Promise<ReportInput> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      tools: [REPORT_TOOL],
      tool_choice: { type: "tool", name: "report_findings" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              title: "Deal package",
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  const tool = (json.content as { type: string; name?: string; input?: unknown }[]).find(
    (c) => c.type === "tool_use" && c.name === "report_findings",
  );
  if (!tool?.input) throw new Error("Model returned no report_findings tool call");
  return tool.input as ReportInput;
}

// ---------------------------------------------------------------------------
// Scan runner
// ---------------------------------------------------------------------------
async function runScan(dealId: string) {
  const started = Date.now();
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fail = async (msg: string) => {
    console.error(`scan ${dealId}: ${msg}`);
    await db
      .from("deals")
      .update({ status: "needs_attention", scan_error: msg, last_scanned_at: new Date().toISOString() })
      .eq("id", dealId);
  };

  try {
    const { data: deal, error: dealErr } = await db
      .from("deals")
      .select("id, brokerage_id, deal_type, property_address")
      .eq("id", dealId)
      .single();
    if (dealErr || !deal) return fail("deal not found");

    await db.from("deals").update({ status: "scanning", scan_error: null }).eq("id", dealId);

    const { data: doc } = await db
      .from("documents")
      .select("storage_path, file_name")
      .eq("deal_id", dealId)
      .is("purged_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!doc) return fail("No document on file. The PDF may have been auto-deleted; upload it again to re-check.");

    const { data: blob, error: dlErr } = await db.storage.from("deal-documents").download(doc.storage_path);
    if (dlErr || !blob) return fail(`could not read the PDF: ${dlErr?.message ?? "unknown"}`);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const pdfBase64 = btoa(binary);

    const report = await askClaude(pdfBase64, buildPrompt(deal.deal_type, deal.property_address));

    // ---- Persist -----------------------------------------------------------
    const byId = new Map(RULES.map((r) => [r.rule_id, r]));
    const findings: Record<string, unknown>[] = [];
    let passed = 0, warnings = 0, critical = 0, confirms = 0;

    for (const r of report.auto_results) {
      const rule = byId.get(r.rule_id);
      if (!rule || r.result === "not_applicable") continue;
      if (r.result === "passed") {
        passed++;
        findings.push({
          rule_id: rule.rule_id, rule_version: rule.version, rule_name: rule.rule_name,
          severity: rule.severity.toLowerCase(), outcome: "passed",
          confidence: r.confidence, finding_text: null, evidence: null, page: null,
        });
        continue;
      }
      const outcome = rule.severity === "Critical" ? "critical" : "warning";
      if (outcome === "critical") critical++; else warnings++;
      findings.push({
        rule_id: rule.rule_id, rule_version: rule.version, rule_name: rule.rule_name,
        severity: rule.severity.toLowerCase(), outcome,
        confidence: r.confidence,
        finding_text: r.finding ?? rule.finding_template,
        evidence: r.evidence ?? null,
        page: r.page ?? null,
        fix_guidance: rule.fix_guidance,
      });
    }

    for (const m of report.manual_applicability) {
      const rule = byId.get(m.rule_id);
      if (!rule || !m.applies) continue;
      confirms++;
      findings.push({
        rule_id: rule.rule_id, rule_version: rule.version, rule_name: rule.rule_name,
        severity: "confirm", outcome: "confirm",
        confidence: null,
        finding_text: rule.finding_template,
        evidence: m.note ?? null, page: null,
        confirm_text: rule.confirm_text, fix_guidance: rule.fix_guidance,
      });
    }

    const rulesRun = passed + warnings + critical + confirms;
    const { data: scan, error: scanErr } = await db
      .from("scans")
      .insert({
        deal_id: dealId, brokerage_id: deal.brokerage_id,
        ruleset_version: RULESET_VERSION, model: MODEL,
        rules_run: rulesRun, passed, warnings, critical, confirms,
        duration_ms: Date.now() - started,
        summary: report.package_summary,
      })
      .select("id")
      .single();
    if (scanErr || !scan) return fail(`could not save scan: ${scanErr?.message}`);

    if (findings.length) {
      const { error: fErr } = await db.from("findings").insert(
        findings.map((f) => ({ ...f, scan_id: scan.id, brokerage_id: deal.brokerage_id })),
      );
      if (fErr) return fail(`could not save findings: ${fErr.message}`);
    }

    await db.from("deals").update({ last_scanned_at: new Date().toISOString(), scan_error: null }).eq("id", dealId);
    await db.rpc("recompute_deal_status", { p_deal_id: dealId });
    console.log(`scan ${dealId}: ${rulesRun} run, ${passed} passed, ${warnings} warn, ${critical} crit, ${confirms} confirm in ${Date.now() - started}ms`);
  } catch (e) {
    await fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// HTTP entry
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_KEY}`) return new Response("unauthorized", { status: 401 });

  let dealId: string | undefined;
  try {
    ({ deal_id: dealId } = await req.json());
  } catch { /* fallthrough */ }
  if (!dealId) return new Response("deal_id required", { status: 400 });

  // @ts-ignore EdgeRuntime is provided by Supabase
  EdgeRuntime.waitUntil(runScan(dealId));
  return new Response(JSON.stringify({ queued: true, deal_id: dealId }), {
    status: 202,
    headers: { "content-type": "application/json" },
  });
});
