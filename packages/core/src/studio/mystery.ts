import { randomUUID } from "node:crypto";
import type { StudioStore } from "./store.js";
import { MysteryCaseInputSchema } from "./domain.js";
import type { z } from "zod";

type MysteryCaseInput = z.infer<typeof MysteryCaseInputSchema>;

export class MysteryLedger {
  constructor(private readonly store: StudioStore) {}

  lockSolution(input: MysteryCaseInput): void {
    const value = MysteryCaseInputSchema.parse(input);
    this.assertLegacyWritable(value.bookId);
    const timestamp = new Date().toISOString();
    const existing = this.store.db.prepare("SELECT book_id, solution_locked FROM mystery_cases WHERE book_id = ?").get(value.bookId) as { book_id: string; solution_locked: number } | undefined;
    if (existing?.solution_locked) {
      const approval = this.store.requestApproval(value.bookId, "canon-retcon", value.bookId, "Changing a locked mystery solution requires author approval.");
      throw new Error(`Mystery solution is locked; approve retcon ${approval} before changing it.`);
    }
    this.store.db.prepare("INSERT INTO mystery_cases (book_id, culprit, motive, means, opportunity, solution_locked, approved_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(book_id) DO UPDATE SET culprit=excluded.culprit, motive=excluded.motive, means=excluded.means, opportunity=excluded.opportunity, solution_locked=excluded.solution_locked, updated_at=excluded.updated_at")
      .run(value.bookId, value.culprit, value.motive, value.means, value.opportunity, value.solutionLocked ? 1 : 0, value.solutionLocked ? timestamp : null, timestamp, timestamp);
    this.store.recordEvent(value.bookId, "author", "mystery.solution.locked", "mystery-case", value.bookId, null, value, "Locked mystery solution");
  }

  addClue(input: { bookId: string; title: string; evidence: string; discoveredChapter?: number; interpretation?: string; visibility?: "reader-visible" | "hidden"; payoffChapter?: number; redHerring?: boolean }): string {
    this.assertLegacyWritable(input.bookId);
    const id = randomUUID(); const timestamp = new Date().toISOString();
    this.store.db.prepare("INSERT INTO clues VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.bookId, input.title, input.evidence, input.discoveredChapter ?? null, input.interpretation ?? "", input.visibility ?? "reader-visible", input.payoffChapter ?? null, input.redHerring ? 1 : 0, "open", timestamp, timestamp);
    this.store.recordEvent(input.bookId, "author", "mystery.clue.created", "clue", id, null, input, "Added clue to fairness ledger");
    return id;
  }

  resolveClue(bookId: string, clueId: string, payoffChapter: number): void {
    this.assertLegacyWritable(bookId);
    const clue = this.store.db.prepare("SELECT discovered_chapter FROM clues WHERE id = ? AND book_id = ?").get(clueId, bookId) as { discovered_chapter: number | null } | undefined;
    if (!clue) throw new Error("Clue not found");
    if (clue.discovered_chapter !== null && payoffChapter <= clue.discovered_chapter) throw new Error("A clue payoff must occur after its discovery.");
    this.store.db.prepare("UPDATE clues SET status = 'resolved', payoff_chapter = ?, updated_at = ? WHERE id = ?").run(payoffChapter, new Date().toISOString(), clueId);
  }

  private assertLegacyWritable(bookId: string): void {
    const canonical = this.store.db.prepare("SELECT 1 FROM mystery_policies WHERE book_id = ?").get(bookId);
    if (canonical) throw new Error("This project uses canonical fair-play state; write through MysteryEngine instead of the legacy ledger.");
  }
}
