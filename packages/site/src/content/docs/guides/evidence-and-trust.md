---
title: Evidence and reader trust
description: Model digital evidence, forensics, timestamps, witnesses, and reader-visible projections without oracle shortcuts.
slug: docs/guides/evidence-and-trust
---

Every evidence record separates what an item appears to mean from its authorized true meaning. Reader-facing agents receive only the apparent meaning until the planned reveal.

The canonical mystery evidence record is narrower than a full clue-ledger worksheet. It includes fields such as `title`, `kind`, `source`, `reliability`, `visibility`, `firstAppearanceChapter`, `revealChapter`, `apparentMeaning`, `trueMeaning`, `required`, `redHerring`, `corroborates`, and `contradicts`. It does not currently have separate canonical `access`, `dependencies`, or `payoff` fields. Those concepts belong in the surrounding timeline, knowledge, deduction, or legacy clue-ledger records and should not be documented as fields on every evidence object.

## Digital and forensic records

Digital evidence records origin, device or account control, timestamps, extraction, access history, possible manipulation, synchronization limits, and corroboration. A screenshot establishes that a screenshot exists; it does not prove the represented event occurred.

Forensic records separate sample, collection, test, result, interpretation, confidence, limitation, and alternatives. Biometrics, DNA, model output, detectors, experts, confessions, and database matches may contribute leads but cannot replace deduction.

## Time, location, and cameras

Normalize source timezones and distinguish creation, upload, modification, access, and transmission. Location usually identifies a device, account region, vehicle report, or approximate area—not bodily presence. Camera records need position, field of view, activation, clock accuracy, quality, retention, ownership, and blind spots.

## Reader projection

Use the Mystery Workbench to inspect what reader-facing agents know through a selected chapter. Required evidence must be reader-visible before its reveal. True meanings, future deductions, culprit identity, and author-only notes do not enter this projection.

Decisive technical mechanisms require admitted, cited research. Web material remains untrusted research until the author approves it as canon.

## What is implemented

The Studio exposes mystery setup, workbench, validation, and reader-projection data through `/api/v1/books/:bookId/mystery/...` routes. The reader projection deterministically filters evidence, timeline, and character knowledge by chapter and visibility and removes private fields; it is not a prose-understanding service. Mystery validation checks structured records for disclosure order, deductions, chronology, access, alternatives, oracle-like evidence, and reader-trust constraints. The rule catalog contains additional checks that are not all emitted by the current validator, so a catalog entry is not evidence that an automatic audit currently runs.

Research fetched through the book research route is stored as a pending snapshot until an author admits it. The current implementation does not automatically call a provider to interpret a source, turn a technical detail into a deduction, or verify that a chapter has used the evidence fairly.
