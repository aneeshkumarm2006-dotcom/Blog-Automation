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

export interface SiteAnalysis {
  niche: string;
  audience: string;
  tone: string;
  existingTopics: string[];
  contentGaps: string[];
  competitiveAngles?: string[];
  brandVoiceNotes?: string;
  recommendedFormats?: string[];
  [key: string]: unknown;
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
