# Studio package context

- Studio is a thin local transport and author-facing client.
- Route handlers call application services; new routes must not issue SQL directly.
- The UI is not a security or consistency boundary.
- Keep credentials in the local process/OS store, never in browser state or project files.
- Test loading, empty, blocked, keyboard, and reduced-motion behavior for UI changes.
