import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://csandbatch.github.io",
  base: "/inkos",
  output: "static",
  integrations: [react(), starlight({
    title: "InkOS",
    description: "A local agent production OS for fiction.",
    social: [{ icon: "github", label: "GitHub", href: "https://github.com/CSandbatch/inkos" }],
    customCss: ["./src/styles/signal-grid.css"],
    sidebar: [
      { label: "Start", items: [{ label: "Getting started", slug: "docs/getting-started" }] },
      { label: "Understand", items: [{ label: "Architecture", slug: "docs/concepts/architecture" }, { label: "Story state and closure", slug: "docs/concepts/story-state" }, { label: "Supervised workflow", slug: "docs/concepts/workflow" }] },
      { label: "Build", items: [{ label: "Build a fair mystery", slug: "docs/guides/mystery" }, { label: "Evidence and reader trust", slug: "docs/guides/evidence-and-trust" }, { label: "Review, approve, and revise", slug: "docs/guides/review" }] },
      { label: "Reference", items: [{ label: "Fair-play rules", slug: "docs/reference/fair-play-rules" }, { label: "Studio API v1", slug: "docs/reference/api" }, { label: "Configuration", slug: "docs/reference/configuration" }] },
      { label: "Operate", items: [{ label: "Privacy and telemetry", slug: "docs/operations/privacy" }, { label: "Backup and recovery", slug: "docs/operations/backup-and-recovery" }] },
      { label: "Contribute", items: [{ label: "Development", slug: "docs/contributing/development" }] },
      { label: "Roadmap", slug: "docs/roadmap" }
    ]
  })]
});
