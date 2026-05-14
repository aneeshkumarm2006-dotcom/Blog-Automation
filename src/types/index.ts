import type { ObjectId } from "mongodb";

export interface KeywordPair {
  keyword: string;
  backlink: string;
}

export type SessionStatus =
  | "created"
  | "analyzing"
  | "ideas_pending"
  | "ideas_approved"
  | "generating"
  | "humanizing"
  | "done"
  | "failed";

export type BlogStatus =
  | "queued"
  | "writing"
  | "raw"
  | "humanizing"
  | "humanized"
  | "failed";

// Matches the strict JSON schema in `context/skills/site-analysis.md`.
// Zod validation lives in `src/lib/schemas.ts` (siteAnalysisSchema); this
// interface is the persisted shape after parsing.
export interface SiteAnalysisAudience {
  primary: string | null;
  role_seniority: string | null;
  expertise_level: string | null;
}

export interface SiteAnalysisTone {
  summary: string | null;
  sample_phrases: string[] | null;
}

export interface SiteAnalysisExistingContent {
  topics_covered: string[] | null;
  dominant_format: string | null;
  avg_length_words: number | null;
}

export interface SiteAnalysisCompetitor {
  name: string | null;
  url: string | null;
  publishing_cadence: string | null;
  content_focus: string | null;
}

export interface SiteAnalysisCitationSurface {
  optimized: boolean | null;
  evidence: string | null;
}

export interface SiteAnalysis {
  niche: string | null;
  audience: SiteAnalysisAudience | null;
  tone: SiteAnalysisTone | null;
  existing_content: SiteAnalysisExistingContent | null;
  content_gaps: string[] | null;
  competitors: SiteAnalysisCompetitor[] | null;
  ai_citation_surface: SiteAnalysisCitationSurface | null;
  differentiation_hooks: string[] | null;
}

export interface Session {
  _id: ObjectId;
  createdAt: Date;
  websiteUrl: string;
  keywordPairs: KeywordPair[];
  blogCount: number;
  wordCount: number;
  status: SessionStatus;
  siteAnalysis?: SiteAnalysis;
  failureReason?: string;
}

export interface Idea {
  _id: ObjectId;
  sessionId: ObjectId;
  title: string;
  angle: string;
  assignedKeyword: string;
  assignedBacklink: string;
  searchIntent: string;
  wordCountTarget: number;
  primaryGapAddressed: string;
  uniqueValueHook: string;
  approved: boolean;
  edited: boolean;
  deleted: boolean;
}

export interface Blog {
  _id: ObjectId;
  sessionId: ObjectId;
  ideaId: ObjectId;
  status: BlogStatus;
  rawContent?: string;
  humanizedContent?: string;
  humanizationFailed?: boolean;
  generatedAt?: Date;
  wordCount?: number;
  failureReason?: string;
}

export type Serialized<T> = {
  [K in keyof T]: T[K] extends ObjectId
    ? string
    : T[K] extends ObjectId | undefined
      ? string | undefined
      : T[K] extends Date
        ? string
        : T[K] extends Date | undefined
          ? string | undefined
          : T[K];
};

export type SessionDTO = Serialized<Session>;
export type IdeaDTO = Serialized<Idea>;
export type BlogDTO = Serialized<Blog>;
