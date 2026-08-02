# ADR 003: Supervised durable DAG

**Status:** Accepted

Agent work is represented by durable typed nodes rather than an unbounded tool loop. Nodes declare dependencies and capabilities, persist events and artifacts, respect hard budgets, and support cancellation, retry, and resume. Major creative and publication decisions remain author-approved.
