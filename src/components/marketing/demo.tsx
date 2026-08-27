"use client";

import { useEffect } from "react";

/**
 * Wires the interactive upload demo on the marketing homepage.
 * The markup lives in homepage.html; this attaches behaviour to
 * [data-action="runDemo"] and [data-action="clearDeal"].
 */
export function HomepageDemo() {
  useEffect(() => {
    const check =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function runDemo() {
      const $ = (id: string) => document.getElementById(id);
      const drop = $("drop"),
        title = $("drop-title"),
        sub = $("drop-sub"),
        scan = $("scan"),
        fill = $("scanFill"),
        label = $("scanLabel"),
        report = $("report");
      if (!drop || !title || !sub || !scan || !fill || !label || !report) return;

      report.classList.remove("show");
      drop.classList.add("busy");
      title.textContent = "Reading APS_1420-Lakeshore-Rd.pdf";
      sub.textContent = "Checking every clause and every page.";
      scan.classList.add("on");
      label.classList.add("on");
      fill.style.width = "0";

      const steps = [
        "Checking clauses against RECO and TRESA…",
        "Scanning every page for dates, initials and signatures…",
        "Matching OREA form fields…",
        "Building your report…",
      ];
      let p = 0;
      const t = setInterval(() => {
        p += 4;
        fill.style.width = p + "%";
        label.textContent = steps[Math.min(steps.length - 1, Math.floor(p / 26))];
        if (p >= 100) {
          clearInterval(t);
          setTimeout(() => {
            scan.classList.remove("on");
            label.classList.remove("on");
            drop.classList.remove("busy");
            title.textContent = "Drop an agreement to see a live report";
            sub.textContent = "APS, buyer rep, listing agreement, amendments. PDF or scan.";
            report.classList.add("show");
            report.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 350);
        }
      }, 70);
    }

    function clearDeal() {
      const badge = document.querySelector<HTMLElement>(".rep-head .badge");
      const foot = document.querySelector<HTMLElement>(".rep-foot");
      const marker = document.querySelector<HTMLElement>(".marker");
      document.querySelectorAll<HTMLElement>(".flag-pane .row.flag").forEach((f) => {
        f.classList.remove("flag");
        f.classList.add("pass");
        const ico = f.querySelector(".rico");
        if (ico) {
          ico.classList.remove("flag");
          ico.classList.add("pass");
          ico.innerHTML = check;
        }
        f.querySelectorAll(".fixbtn").forEach((b) => b.remove());
        const conf = f.querySelector(".conf");
        if (conf) conf.textContent = "Now verified";
        f.querySelector(".why")?.remove();
      });
      if (marker) marker.style.display = "none";
      if (badge) {
        badge.style.background = "var(--green)";
        badge.style.color = "#04331f";
        badge.innerHTML =
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#04331f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg> Deal cleared';
      }
      if (foot) {
        foot.innerHTML =
          '<div class="l" style="color:#0a7a48;font-weight:600">Deal cleared. Stamped pass BP-2026-08-4472 issued and attached to the file.</div>';
      }
    }

    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!el) return;
      if (el.dataset.action === "runDemo") runDemo();
      if (el.dataset.action === "clearDeal") clearDeal();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
