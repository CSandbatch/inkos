---
title: Privacy
description: Current local storage, provider, demo, and diagnostics boundaries.
slug: docs/operations/privacy
---

The local Studio stores project state in `.novelgraph/studio.sqlite` and writes exports beneath `.novelgraph/exports/`. It has no hosted manuscript service, account system, or cloud synchronization. The unauthenticated API binds to loopback by default and must not be exposed to an untrusted network.

The repository contains a strict validator for a proposed anonymous diagnostics payload. It does not contain a telemetry sender, collector, persistent consent setting, payload-preview screen, or deletion workflow. The **Share anonymous diagnostics** checkbox in New book is not wired to project creation. This build transmits no diagnostics through that control.

The public demo uses fixture data in the browser. It accepts no provider key, performs no model call, and writes no server-side project or export.

Read [Privacy and telemetry](/novelgraph/docs/operations/privacy-and-telemetry/) for the exact local data scope, the allowlisted diagnostic fields, and external-worker responsibilities.
