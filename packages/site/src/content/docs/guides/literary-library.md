---
title: Use the literary library
description: Add and retrieve cited craft guidance without mistaking it for story canon.
slug: docs/guides/literary-library
---

The literary library supplies advice and sources to a book’s discovery work. It is not a store of fictional truth. A craft passage can support a decision about scene causality, a genre rule can warn about reader trust, and admitted research can inform a mechanism; none becomes a fact about a character or event merely because it was retrieved.

The canonical [knowledge-layers diagram](/diagrams/03-knowledge-layers.svg) places the literary library upstream of the run scratchpad as cited guidance rather than in the canon path.

Textual equivalent:

```text
Source → chunk with citation, topics, and applicability → retrieval result
                                                         ↓
                                               scratchpad or proposal
                                                         ↓
                                          author approval, if it becomes canon
```

## There are two nearby mechanisms

The core uses the phrase “literary” in two related but distinct places. Keeping them separate avoids an easy documentation error.

| Mechanism | Stored records | What it does today |
| --- | --- | --- |
| Source and chunk library | `knowledge_sources`, `knowledge_chunks`, optional `knowledge_fts` | Stores searchable source text with citations and metadata |
| Discovery literary knowledge base | `knowledge_bases` with scope `literary`, plus a `literary-guidance` link | Makes a global literary layer available in discovery dossiers |

`KnowledgeBase.addSource` accepts a title, origin, license note, and version. `addChunk` attaches content, topics, applicability, and a citation to a source. It writes both the ordinary chunk table and, where available, the optional SQLite FTS5 index. The relational chunk table remains canonical; a SQLite build without FTS5 must still open and search the workspace.

Discovery initialization also ensures that one global knowledge base exists with scope `literary`, named “NovelGraph Literary Library,” and links each discovered book to it as `literary-guidance`. Scoped claims use a separate table from source chunks. In the current core, source chunks are not automatically converted into scoped claims or attached to a particular knowledge base. A citation in the retrieval library is evidence for guidance, not a hidden canon-promotion mechanism.

## Add sources with enough context to evaluate them

Create one source record for a coherent edition, article, note set, or other identifiable origin. Give it a stable title, identify the origin, preserve the license note, and record the version. Then split it into chunks that can be retrieved and cited without losing their meaning.

For each chunk, include:

| Field | Why it matters |
| --- | --- |
| Content | The actual guidance available to retrieval |
| Topics | Terms that help locate the material, such as `scene`, `pacing`, or `mystery` |
| Applicability | Where the guidance is intended to apply |
| Citation | The label a later proposal can use to show its source |

The core does not validate a fixed vocabulary for topics or applicability. Use consistent project language so retrieval stays useful. A chunk about omniscient narration should say so in its topics; a chunk meant only for a mystery project should make that explicit in its applicability. Do not put a book-specific assertion in a general craft chunk just because it has the right keywords.

NovelGraph seeds a small curated craft library once per store, identified by origin `novelgraph-curated`. The supplied entries cover scene causality, character agency, fair-play mystery, promise and payoff, and reader expectations. Each is stored as original editorial guidance with version `1.0.0` and applicability `general`. The seed is a starting library, not a claim that these brief entries replace research or editorial judgment.

## Search behavior and its limits

`KnowledgeBase.search(query, limit)` returns up to eight matches by default. A match contains its chunk identifier, content, topics, citation, and score. With FTS5 available, the search uses SQLite full-text matching over chunk content and topics and orders results by BM25 score. Without FTS5, it uses a case-insensitive `LIKE` search over content and serialized topics, orders by newest chunk first, and reports a score of zero.

The fallback escapes backslashes, percent signs, and underscores in the query so those characters are treated as literal search text rather than wildcard controls. The result is resilient across supported SQLite builds, but the two modes do not rank in the same way. Do not interpret a zero fallback score as a judgment that a source is irrelevant; it means ranked FTS search was unavailable.

The current search method does not filter results by a book, a series link, or chunk applicability. Applicability is stored metadata for the caller to use; it is not yet an enforced retrieval filter in `KnowledgeBase.search`. If you load specialized material, review the citation, topics, and applicability before relying on it in a proposal.

## Move from guidance to a story decision honestly

The normal route is advisory:

1. Retrieve a relevant chunk and retain its citation.
2. Put the implication into a scratchpad observation, question, or hypothesis, with source references and the right provenance such as `literary-guidance`.
3. Compare it with author-stated aims, approved series facts, and book constraints.
4. If it suggests a genuine fictional commitment, create a proposed scoped claim or revise the proposed Story Charter.
5. Require author approval and rationale before calling the commitment canon.

For example, the seeded fair-play entry says that a solution should be supported by discoverable evidence before the reveal. That guidance can motivate an evidence plan. It does not establish that a particular watch was visible in chapter 2, that it is decisive, or what it truly means. Those are story records with their own visibility, appearance, and approval consequences.

## Research is not automatically admitted either

The same restraint applies to factual research. In a mystery project, decisive digital or forensic evidence needs author-admitted cited research. Validation checks for approved research identifiers in the evidence extensions; a web result or note alone is insufficient. Literary craft material and factual research serve different questions, but both are inputs to judgment rather than automatic truth.

Treat the library as a place to preserve sources, not a machine for laundering advice into canon. When a later reviewer asks why a premise or technique was considered, the citation and scratchpad trail should make the path visible. When they ask what the book has actually committed to, the answer should come from approved claims and the charter instead.
