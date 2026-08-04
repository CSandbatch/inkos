# Development tooling context

- Tools must be deterministic, explicit about unavailable external dependencies, and safe to run in CI.
- Do not write secrets or creative content into generated context, reports, or telemetry.
- Tool state belongs in ignored `.agent/` files unless it is a durable specification or test.
- Cross-platform checks must work on Windows, macOS, Linux, and WSL where practical.
