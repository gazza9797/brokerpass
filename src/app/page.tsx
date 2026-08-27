import { readFileSync } from "node:fs";
import path from "node:path";
import { HomepageDemo } from "@/components/marketing/demo";
import "@/components/marketing/marketing.css";

/**
 * Public marketing homepage. The markup is the approved design mockup,
 * kept as HTML in src/components/marketing/homepage.html so design edits
 * stay a copy-paste job. Interactive demo behaviour lives in demo.tsx.
 */
const html = readFileSync(
  path.join(process.cwd(), "src/components/marketing/homepage.html"),
  "utf8",
);

export default function Home() {
  return (
    <>
      <div className="mk" dangerouslySetInnerHTML={{ __html: html }} />
      <HomepageDemo />
    </>
  );
}
