import { z } from "zod";
import yaml from "js-yaml";

export const GenreProfileSchema = z.object({
  name: z.string(),
  id: z.string(),
  language: z.enum(["zh", "en"]).default("zh"),
  chapterTypes: z.array(z.string()),
  fatigueWords: z.array(z.string()),
  numericalSystem: z.boolean().default(false),
  powerScaling: z.boolean().default(false),
  eraResearch: z.boolean().default(false),
  pacingRule: z.string().default(""),
  satisfactionTypes: z.array(z.string()).default([]),
  auditDimensions: z.array(z.number()).default([]),
  rulePacks: z.array(z.string()).default([]),
  workflowTemplate: z.string().default("standard"),
  stateExtensions: z.array(z.string()).default([]),
  validators: z.array(z.string()).default([]),
  readerPersonas: z.array(z.string()).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
});

type ParsedGenreProfileValue = z.infer<typeof GenreProfileSchema>;
type ExtensionKeys = "rulePacks" | "workflowTemplate" | "stateExtensions" | "validators" | "readerPersonas" | "requiredCapabilities";
export type GenreProfile = Omit<ParsedGenreProfileValue, ExtensionKeys> & Partial<Pick<ParsedGenreProfileValue, ExtensionKeys>>;

export interface ParsedGenreProfile {
  readonly profile: GenreProfile;
  readonly body: string;
}

export function parseGenreProfile(raw: string): ParsedGenreProfile {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error("Genre profile missing YAML frontmatter (--- ... ---)");
  }

  const frontmatter = yaml.load(fmMatch[1]) as Record<string, unknown>;
  const profile = GenreProfileSchema.parse(frontmatter);
  const body = fmMatch[2].trim();

  return { profile, body };
}
