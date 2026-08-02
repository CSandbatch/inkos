---
title: Privacy and telemetry
description: What stays local and the exact optional diagnostics boundary.
slug: docs/operations/privacy
---

Manuscripts, prompts, model responses, graph data, credentials, paths, project names, and research snapshots remain local and are prohibited from telemetry.

Optional anonymous diagnostics may include only:

- random installation identifier;
- InkOS, Node.js, and operating-system versions;
- command or workflow name;
- duration bucket and success/failure category;
- coarse, documented error code.

Telemetry is off until explicitly enabled, has a persistent off switch, and must show the payload before transmission. The public demo uses fixture data and performs no model or manuscript requests.
