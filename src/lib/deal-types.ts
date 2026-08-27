/**
 * The nine v1 deal types. One deal = one package = one scan.
 * Keys are stored in deals.deal_type; labels are what agents see.
 * Adjust labels here only; the rule engine keys off the id.
 */
export const DEAL_TYPES = [
  { id: "aps_residential", label: "Agreement of Purchase and Sale (Residential)" },
  { id: "aps_condo", label: "Agreement of Purchase and Sale (Condominium)" },
  { id: "listing_seller", label: "Listing Agreement (Seller Representation)" },
  { id: "buyer_rep", label: "Buyer Representation Agreement" },
  { id: "lease_residential", label: "Agreement to Lease (Residential)" },
  { id: "amendment", label: "Amendment to Agreement" },
  { id: "waiver_nof", label: "Waiver / Notice of Fulfillment of Condition" },
  { id: "mutual_release", label: "Mutual Release" },
  { id: "assignment", label: "Assignment of Agreement" },
] as const;

export type DealTypeId = (typeof DEAL_TYPES)[number]["id"];

export function dealTypeLabel(id: string): string {
  return DEAL_TYPES.find((d) => d.id === id)?.label ?? id;
}

/** Storage retention for uploaded PDFs. */
export const DOCUMENT_TTL_MINUTES = 60;
