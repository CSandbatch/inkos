import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://csandbatch.github.io",
  base: "/novelgraph",
  output: "static",
  integrations: [react(), starlight({
    title: "NovelGraph",
    description: "A local agent production OS for fiction.",
    social: [{ icon: "github", label: "GitHub", href: "https://github.com/CSandbatch/novelgraph" }],
    customCss: ["./src/styles/signal-grid.css"],
    sidebar: [
      { label: "Start", items: [{ label: "Getting started", slug: "docs/getting-started" }, { label: "Sign in to a model provider", slug: "docs/guides/provider-sign-in" }] },
      { label: "Understand", items: [{ label: "Architecture", slug: "docs/concepts/architecture" }, { label: "Discovery and Story Charters", slug: "docs/concepts/discovery-and-charters" }, { label: "Knowledge boundaries", slug: "docs/concepts/knowledge-boundaries" }, { label: "Scratchpads and handoffs", slug: "docs/concepts/scratchpads-and-handoffs" }, { label: "Narrative surfaces", slug: "docs/concepts/narrative-surfaces" }, { label: "Story state and closure", slug: "docs/concepts/story-state" }, { label: "Supervised workflow", slug: "docs/concepts/workflow" }] },
      { label: "Build", items: [{ label: "Curate the literary library", slug: "docs/guides/literary-library" }, { label: "Link a series", slug: "docs/guides/series-linking" }, { label: "Build a fair mystery", slug: "docs/guides/mystery" }, { label: "Evidence and reader trust", slug: "docs/guides/evidence-and-trust" }, { label: "Review, approve, and revise", slug: "docs/guides/review" }, { label: "Revision, retcon, and rollback", slug: "docs/guides/revision-retcon-rollback" }] },
      { label: "Reference", items: [{ label: "Capability status", slug: "docs/reference/capability-status" }, { label: "CLI", slug: "docs/reference/cli" }, { label: "Agent capabilities", slug: "docs/reference/agent-capabilities" }, { label: "Fair-play rules", slug: "docs/reference/fair-play-rules" }, { label: "Studio API v1", slug: "docs/reference/api" }, { label: "Configuration", slug: "docs/reference/configuration" }] },
      { label: "Operate", items: [{ label: "Shipping readiness", slug: "docs/operations/shipping-readiness" }, { label: "Local deployment", slug: "docs/operations/local-deployment" }, { label: "Privacy and telemetry", slug: "docs/operations/privacy" }, { label: "Backup and recovery", slug: "docs/operations/backup-and-recovery" }, { label: "Legacy v0 migration", slug: "docs/operations/migration-v0" }, { label: "Release operations", slug: "docs/operations/release" }] },
      { label: "Contribute", items: [{ label: "Development", slug: "docs/contributing/development" }, { label: "Public copy standard", slug: "docs/contributing/public-copy" }] },
      { label: "Roadmap", slug: "docs/roadmap" }
    ]
  })]
});
