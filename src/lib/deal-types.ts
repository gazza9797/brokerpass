/**
 * The nine v1 deal types. One deal = one package = one scan.
 * The scanner detects the type from the principal form and writes it to
 * deals.deal_type ("pending" until the first scan, "other" if unrecognised).
 */
export const DEAL_TYPES = [
  { id: "aps_residential", label: "Agreement of Purchase and Sale (Residential)", short: "APS · Residential" },
  { id: "aps_condo", label: "Agreement of Purchase and Sale (Condominium)", short: "APS · Condo" },
  { id: "listing_seller", label: "Listing Agreement (Seller Representation)", short: "Listing" },
  { id: "buyer_rep", label: "Buyer Representation Agreement", short: "Buyer rep" },
  { id: "lease_residential", label: "Agreement to Lease (Residential)", short: "Lease" },
  { id: "amendment", label: "Amendment to Agreement", short: "Amendment" },
  { id: "waiver_nof", label: "Waiver / Notice of Fulfillment of Condition", short: "Waiver / NOF" },
  { id: "mutual_release", label: "Mutual Release", short: "Mutual release" },
  { id: "assignment", label: "Assignment of Agreement", short: "Assignment" },
] as const;

export type DealTypeId = (typeof DEAL_TYPES)[number]["id"];

export function dealTypeLabel(id: string): string {
  if (id === "pending") return "Detecting…";
  if (id === "other") return "Other / mixed package";
  return DEAL_TYPES.find((d) => d.id === id)?.label ?? id;
}

export function dealTypeShort(id: string): string {
  if (id === "pending") return "Detecting…";
  if (id === "other") return "Other";
  return DEAL_TYPES.find((d) => d.id === id)?.short ?? id;
}

/** Storage retention for uploaded PDFs. */
export const DOCUMENT_TTL_MINUTES = 60;
