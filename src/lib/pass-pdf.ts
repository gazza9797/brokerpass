import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface PassData {
  ref: string;
  issuedAt: string;
  brokerage: string;
  dealName: string;
  dealType: string;
  agent: string;
  rulesetVersion: string;
  rulesRun: number;
  scanSummary: string | null;
  scannedAt: string;
}

const SLATE = rgb(0.059, 0.106, 0.176);
const GREEN = rgb(0.07, 0.718, 0.416);
const MUTED = rgb(0.36, 0.42, 0.49);
const PAPER = rgb(0.969, 0.965, 0.949);

function fmt(d: string) {
  return new Date(d).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "long",
    timeStyle: "short",
  });
}

/** One-page, letter-size stamped pass. */
export async function buildPassPdf(p: PassData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`BrokerPass ${p.ref}`);
  doc.setAuthor("BrokerPass");
  const page = doc.addPage([612, 792]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const W = 612;

  page.drawRectangle({ x: 0, y: 0, width: W, height: 792, color: PAPER });
  // header band
  page.drawRectangle({ x: 0, y: 700, width: W, height: 92, color: SLATE });
  page.drawText("BrokerPass", { x: 48, y: 738, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("DEAL CLEARED", { x: 48, y: 716, size: 10, font: bold, color: GREEN });
  page.drawText(p.ref, { x: W - 48 - bold.widthOfTextAtSize(p.ref, 14), y: 730, size: 14, font: bold, color: rgb(1, 1, 1) });

  // seal
  page.drawCircle({ x: W / 2, y: 610, size: 34, color: rgb(0.89, 0.96, 0.92) });
  page.drawCircle({ x: W / 2, y: 610, size: 30, borderColor: GREEN, borderWidth: 2 });
  // checkmark (drawn, since Helvetica has no ✓ glyph)
  page.drawLine({ start: { x: W / 2 - 13, y: 610 }, end: { x: W / 2 - 3, y: 599 }, thickness: 4, color: GREEN, lineCap: 1 });
  page.drawLine({ start: { x: W / 2 - 3, y: 599 }, end: { x: W / 2 + 15, y: 622 }, thickness: 4, color: GREEN, lineCap: 1 });

  const center = (t: string, y: number, size: number, font = reg, color = SLATE) =>
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });

  center("Deal Cleared", 548, 24, bold);
  center(p.dealName, 522, 14, bold);
  center(`${p.dealType}  ·  ${p.brokerage}`, 504, 11, reg, MUTED);
  center("Checked against RECO · TRESA · OREA, plus dates, initials and signatures", 486, 10, reg, MUTED);

  // details block
  const rows: [string, string][] = [
    ["Cleared", fmt(p.issuedAt)],
    ["Agent", p.agent],
    ["Rules run", `${p.rulesRun} (ruleset ${p.rulesetVersion})`],
    ["Scanned", fmt(p.scannedAt)],
    ["Reference", p.ref],
  ];
  let y = 430;
  page.drawLine({ start: { x: 96, y: y + 22 }, end: { x: W - 96, y: y + 22 }, thickness: 0.6, color: rgb(0.85, 0.86, 0.88) });
  for (const [k, v] of rows) {
    page.drawText(k.toUpperCase(), { x: 96, y, size: 8.5, font: bold, color: MUTED });
    page.drawText(v, { x: 220, y, size: 11, font: reg, color: SLATE });
    y -= 24;
  }
  page.drawLine({ start: { x: 96, y: y + 12 }, end: { x: W - 96, y: y + 12 }, thickness: 0.6, color: rgb(0.85, 0.86, 0.88) });

  if (p.scanSummary) {
    const words = p.scanSummary.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (reg.widthOfTextAtSize(t, 9.5) > W - 192) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    let sy = y - 12;
    page.drawText("PACKAGE", { x: 96, y: sy, size: 8.5, font: bold, color: MUTED });
    sy -= 14;
    for (const l of lines.slice(0, 6)) {
      page.drawText(l, { x: 96, y: sy, size: 9.5, font: reg, color: SLATE });
      sy -= 13;
    }
  }

  const foot =
    "BrokerPass is a compliance aid for brokerages, not legal advice. This pass records that the package on file at the time of the scan passed every automated check and that all attestations were resolved. The Broker of Record makes the final call.";
  const fw: string[] = [];
  let fc = "";
  for (const w of foot.split(" ")) {
    const t = fc ? `${fc} ${w}` : w;
    if (reg.widthOfTextAtSize(t, 8) > W - 96) {
      fw.push(fc);
      fc = w;
    } else fc = t;
  }
  if (fc) fw.push(fc);
  let fy = 92;
  for (const l of fw) {
    page.drawText(l, { x: 48, y: fy, size: 8, font: reg, color: MUTED });
    fy -= 11;
  }
  page.drawText("brokerpass.ca", { x: 48, y: 48, size: 9, font: bold, color: SLATE });

  return doc.save();
}
