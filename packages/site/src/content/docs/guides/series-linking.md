---
title: Link a book to series continuity
description: Use the current series-canon link without confusing shared continuity with book-level decisions.
slug: docs/guides/series-linking
---

Every NovelGraph book belongs to a series, even when the series contains one book. The series relationship gives a book a place to inherit continuity from, while the book keeps its own charter, chapters, revisions, obligations, and local canon. A linked series is not permission for one installment to silently rewrite another.

The canonical [series-linking diagram](/novelgraph/diagrams/07-series-linking.svg) shows the intended decision path for shared continuity.

Textual equivalent:

```text
Series canon → selected continuity records → self-contained book canon

Book proposal → series conflict?
                 ├─ no  → book-local approval → book canon
                 └─ yes → series impact review → series canon
```

## Create the structural relationship first

`createSeries` stores a title, premise, and publication target. The supported publication targets are `general`, `kindle-direct-publishing`, and `direct-sales`. `createBook` requires the series identifier, title, premise, genre-pack name, and a positive planned order. It records the book in that series and creates the default balanced reader panel for the book.

The book record is therefore the correct place for installment-specific information such as the selected genre pack and planned order. A series is not a book template. It is the parent continuity container that lets several books share a premise and later share approved claims.

When discovery starts, NovelGraph ensures three scoped knowledge bases exist: one global literary base, one series base owned by the book’s series, and one book base owned by the book. It then links the book to the literary base with relation `literary-guidance` and to the series base with relation `series-canon`.

| Scope | Owner | Intended use |
| --- | --- | --- |
| Literary | Global | Cited craft guidance, not fictional truth |
| Series | One series | Approved continuity that may matter to several books |
| Book | One book | The charter and claims that govern this installment |
| Run | One discovery context | Exploratory material; not canon |

## Decide what belongs at series level

Put a claim in series canon when it must remain consistent across installments and is meaningfully shared: a standing world rule, an established recurring character fact, a past event that later books rely on, or a continuity constraint. Put it in book canon when it is specific to the current installment: this book’s conflict, reader promise, ending horizon, chapter-level facts, or a local consequence that other books do not need to inherit.

The level should reflect the decision’s scope, not its dramatic size. A major revelation can be book-local if it is confined to this book; a small date can be series-wide if later books depend on it. A useful review question is: if this claim changes, which books would need to be reread, revised, or audited?

## Understand the current implementation boundary

The diagram labels the inherited material “selected records.” That is the intended editorial model, but record-by-record selection and automatic conflict detection are not yet implemented in the discovery core. At present, a book’s dossier gathers approved claims from knowledge bases it owns or that are linked to it. For a standard series link, that means approved claims from the linked series base are included alongside the book base and literary base.

Likewise, the current core can promote a proposed claim after an approval, but `promoteClaim` does not compare the new value with series claims or create an impact-review record. The migration provides `knowledge_links` and the diagram defines the desired path; it does not yet enforce “series conflict?” as a database operation.

| Capability | Current behavior |
| --- | --- |
| Associate a book with a series | Implemented through `series_id` when the book is created |
| Create and link a series knowledge base | Implemented when discovery initializes the book |
| Include linked approved claims in a dossier | Implemented |
| Select only particular series records for a book | Not represented as a per-record selection in the core |
| Detect a contradiction automatically | Not implemented for general series claims |
| Produce a complete series impact review | Not implemented in the core |

This distinction is worth documenting because it changes the workflow. Do not describe a book-level approval as having reconciled series continuity unless an editor has actually reviewed the shared claims and affected books.

## A practical linking routine

1. Create the series once, with a concise premise and the intended publication target.
2. Create each book with that series identifier and its planned order. Keep the book premise focused on the installment rather than copying the whole series premise.
3. Start discovery for the book. This establishes the literary, series, and book knowledge-base links.
4. Add shared continuity as proposed series-scoped claims with clear subject, predicate, value, provenance, and source references.
5. Obtain author approval before treating those claims as series canon. Add installment-specific claims to the book scope instead.
6. Before approving a change that touches a shared fact, manually compare it with the series claims and identify which books, charters, chapters, obligations, or mystery records could be affected.
7. Record the rationale for the decision and revisit affected books before treating their audits as current.

For a recurring detective, for example, “has an old injury in the left hand” belongs in series canon if it remains true between cases. “The injury forces her to delegate the final confrontation in this case” is book-local. The first claim gives later books continuity to respect; the second belongs to this book’s causal design.

## Avoid false inheritance

Series canon should not crowd out a new book’s discovery. The current charter is book-specific and production cannot begin until that book has an approved charter. A dossier can include approved series claims, but those claims do not substitute for deciding the installment’s reader promise, central conflict, protagonist, form, or ending horizon.

Similarly, a book should not leak unapproved exploration into shared continuity. Alternatives and contradictions belong in the run scratchpad until an author deliberately promotes a claim. That discipline lets a series retain stable facts while each book remains free to find its own necessary shape.
