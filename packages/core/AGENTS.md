# Core package context

- Core owns contracts, persistence, validation, workflow governance, and authentication.
- Keep provider and Hermes implementation details outside contracts and domain types.
- Workers propose; validators check; only governance commits canon.
- Sealed content requires an explicit capability and access must be logged.
- Database changes require migration fixtures, rollback injection, and idempotence tests.
- Run core typecheck and tests after changes; update capability and provenance records when behavior changes.
