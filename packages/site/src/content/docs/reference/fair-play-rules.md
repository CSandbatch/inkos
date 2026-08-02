---
title: Fair-play rule reference
description: Generated rule codes, modes, capabilities, and closure behavior for fair-play-detective-2026.
slug: docs/reference/fair-play-rules
---

This page is generated from the executable `fair-play-detective-2026@1` contract. Edit the shared schema and regenerate this page instead of changing the table by hand.

## Modes

| Mode | Murder required | Principal investigator | Single culprit | Blocker waiver |
| --- | --- | --- | --- | --- |
| `strict-golden-age` | yes | yes | yes | no |
| `contemporary` | no | no | no | no |
| `hybrid` | no | no | no | no |
| `rule-breaking` | no | no | no | yes |

## Stable findings

| Code | Validation suite | Default severity | Meaning |
| --- | --- | --- | --- |
| `FP-POLICY-001` | fair-disclosure | blocker | Mystery policy required |
| `FP-DISCLOSURE-001` | fair-disclosure | blocker | Decisive evidence must be reader-visible |
| `FP-DISCLOSURE-002` | fair-disclosure | blocker | Decisive evidence needs a first appearance |
| `FP-DISCLOSURE-003` | fair-disclosure | blocker | Evidence must precede its reveal |
| `FP-DEDUCTION-001` | fair-disclosure | blocker | Every deduction must reference existing evidence |
| `CAUSAL-SOLUTION-001` | causal-completeness | blocker | True and apparent events are required |
| `CAUSAL-SOLUTION-002` | causal-completeness | blocker | The solution must be locked |
| `ACCESS-001` | causal-completeness | blocker | Responsibility requires documented access |
| `TIME-RANGE-001` | causal-completeness | blocker | Timeline ranges must be possible |
| `MODE-STRICT-001` | fair-disclosure | blocker | Strict mode requires murder |
| `MODE-STRICT-002` | causal-completeness | blocker | Strict mode requires one principal culprit |
| `DIGITAL-PROVENANCE-001` | digital-realism | major | Digital evidence needs provenance and limitations |
| `DIGITAL-RESEARCH-001` | digital-realism | major | Decisive digital mechanisms need admitted research |
| `FORENSIC-METHOD-001` | forensic-realism | major | Forensic evidence needs method and limitations |
| `FORENSIC-RESEARCH-001` | forensic-realism | major | Decisive forensic mechanisms need admitted research |
| `ALT-SOLUTION-001` | alternative-solution | major | Test an alternative solution |
| `FP-RED-HERRING-001` | reader-trust | major | Red herrings need documented reversals |
| `CHARACTER-LOGIC-001` | character-logic | major | Conduct, motive, and pressure must cohere |
| `RETROSPECTIVE-001` | retrospective | major | Earlier scenes must remain coherent after the reveal |
| `STEREOTYPE-001` | anti-stereotype | blocker | Identity or marginality cannot substitute for evidence |
| `ORACLE-001` | anti-oracle | blocker | Systems, experts, biometrics, and confessions cannot replace deduction |
| `READER-TRUST-001` | reader-trust | blocker | Narration cannot conceal an indispensable fact |

## Required capabilities

- `story:read`
- `reader-view:read`
- `solution:read`
- `solution:write`
- `research:web`
- `draft:write`
- `canon:propose`
- `approval:request`

Blockers prevent progression and publication. Major findings require author review before publication. Moderate, minor, and prose-pattern findings remain advisory unless a project policy explicitly promotes them.
