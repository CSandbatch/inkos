# Security policy

## Reporting a vulnerability

Do not open a public issue for credential exposure, path traversal, private-network research access, unsafe HTML, database corruption, or arbitrary local execution. Use GitHub's private vulnerability reporting for `CSandbatch/inkos` with reproduction details and affected versions.

You should receive acknowledgement within three business days. We will coordinate disclosure after a fix is available.

## Security boundaries

- Studio binds to loopback by default and has no authentication. Exposing it to a network is an explicit, unsupported-risk operation.
- Manuscripts, provider credentials, SQLite data, model responses, and research snapshots are local-only.
- Public demo data is immutable fixture content and performs no model calls.
- Research fetches must reject private, loopback, link-local, and metadata-service destinations.
- Telemetry is optional and must reject fields outside its documented allowlist.

Supported security fixes target the latest published pre-1.0 release.
