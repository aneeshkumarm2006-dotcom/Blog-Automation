import { z } from "zod";

export const siteAnalysisSchema = z.object({
  niche: z.string().nullable(),
  audience: z
    .object({
      primary: z.string().nullable(),
      role_seniority: z.string().nullable(),
      expertise_level: z.string().nullable(),
    })
    .nullable(),
  tone: z
    .object({
      summary: z.string().nullable(),
      sample_phrases: z.array(z.string()).nullable(),
    })
    .nullable(),
  existing_content: z
    .object({
      topics_covered: z.array(z.string()).nullable(),
      dominant_format: z.string().nullable(),
      avg_length_words: z.number().nullable(),
    })
    .nullable(),
  content_gaps: z.array(z.string()).nullable(),
  competitors: z
    .array(
      z.object({
        name: z.string().nullable(),
        url: z.string().nullable(),
        publishing_cadence: z.string().nullable(),
        content_focus: z.string().nullable(),
      }),
    )
    .nullable(),
  ai_citation_surface: z
    .object({
      optimized: z.boolean().nullable(),
      evidence: z.string().nullable(),
    })
    .nullable(),
  differentiation_hooks: z.array(z.string()).nullable(),
});
export type SiteAnalysisData = z.infer<typeof siteAnalysisSchema>;

export const keywordPairSchema = z.object({
  keyword: z.string().trim().min(1, "Keyword is required").max(120),
  backlink: z.string().trim().url("Backlink must be a valid URL"),
});
export type KeywordPairInput = z.infer<typeof keywordPairSchema>;

export const newProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(120, "Project name must be at most 120 characters"),
  websiteUrl: z.string().trim().url("Website URL must be a valid URL"),
});
export type NewProjectInput = z.infer<typeof newProjectSchema>;

// Batch (a single generation run inside a Project).
export const newBatchSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Batch name is required")
      .max(120, "Batch name must be at most 120 characters"),
    keywordPairs: z
      .array(keywordPairSchema)
      .min(1, "At least one keyword pair is required")
      .max(20, "At most 20 keyword pairs are allowed"),
    blogCount: z
      .number()
      .int("Blog count must be a whole number")
      .min(1, "Blog count must be at least 1")
      .max(50, "Blog count must be at most 50"),
    wordCount: z
      .number()
      .int("Word count must be a whole number")
      .min(500, "Word count must be at least 500")
      .max(4000, "Word count must be at most 4000")
      .refine(
        (n) => (n - 500) % 250 === 0,
        "Word count must be a multiple of 250 between 500 and 4000",
      ),
  });
export type NewBatchInput = z.infer<typeof newBatchSchema>;

export const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(160, "Name must be at most 160 characters"),
});
export type RenameInput = z.infer<typeof renameSchema>;

// Matches the strict JSON schema in `context/skills/idea-generation.md`.
// The model returns string-typed `searchIntent`; downstream code is responsible
// for treating it as informational | commercial | transactional | navigational.
export const ideaItemSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().trim().min(1),
  angle: z.string().trim().min(1),
  searchIntent: z.string().trim().min(1),
  wordCountTarget: z.number().int().min(100),
  primaryGapAddressed: z.string(),
  uniqueValueHook: z.string(),
});
export type IdeaItem = z.infer<typeof ideaItemSchema>;

export const ideasResponseSchema = z.object({
  ideas: z.array(ideaItemSchema).min(1),
  diversityNotes: z.string().default(""),
});
export type IdeasResponse = z.infer<typeof ideasResponseSchema>;

// PATCH body for editing a single idea. All fields are optional.
export const ideaPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    angle: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });
export type IdeaPatch = z.infer<typeof ideaPatchSchema>;

export const regenerateIdeasSchema = z.object({
  ideaIds: z.array(z.string().min(1)).min(1),
});
export type RegenerateIdeasInput = z.infer<typeof regenerateIdeasSchema>;
