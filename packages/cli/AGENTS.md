# CLI package context

- CLI commands are thin transports over core/application services.
- Never print credentials, prompts, manuscript text, or sealed content by default.
- Hermes and provider checks must report unavailable configuration explicitly.
- Add integration coverage for every new command and update the CLI reference documentation.
