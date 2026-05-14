import {
  ObjectId,
  type Collection,
  type Filter,
  type UpdateFilter,
} from "mongodb";
import { getDb } from "@/lib/mongo";
import type {
  Blog,
  BlogDTO,
  Idea,
  IdeaDTO,
  KeywordPair,
  Session,
  SessionDTO,
  SessionStatus,
  SiteAnalysis,
} from "@/types";

let indexesEnsured: Promise<void> | null = null;

async function sessions(): Promise<Collection<Session>> {
  const db = await getDb();
  await ensureIndexes();
  return db.collection<Session>("sessions");
}

async function ideas(): Promise<Collection<Idea>> {
  const db = await getDb();
  await ensureIndexes();
  return db.collection<Idea>("ideas");
}

async function blogs(): Promise<Collection<Blog>> {
  const db = await getDb();
  await ensureIndexes();
  return db.collection<Blog>("blogs");
}

export async function ensureIndexes(): Promise<void> {
  if (!indexesEnsured) {
    indexesEnsured = (async () => {
      const db = await getDb();
      await Promise.all([
        db.collection<Session>("sessions").createIndex({ createdAt: -1 }),
        db.collection<Idea>("ideas").createIndex({ sessionId: 1 }),
        db.collection<Blog>("blogs").createIndex({ sessionId: 1 }),
      ]);
    })().catch((err) => {
      indexesEnsured = null;
      throw err;
    });
  }
  return indexesEnsured;
}

export function toObjectId(id: string | ObjectId): ObjectId {
  return typeof id === "string" ? new ObjectId(id) : id;
}

export interface CreateSessionInput {
  websiteUrl: string;
  keywordPairs: KeywordPair[];
  blogCount: number;
  wordCount: number;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<Session> {
  const doc: Omit<Session, "_id"> = {
    createdAt: new Date(),
    websiteUrl: input.websiteUrl,
    keywordPairs: input.keywordPairs,
    blogCount: input.blogCount,
    wordCount: input.wordCount,
    status: "created",
  };
  const col = await sessions();
  const result = await col.insertOne(doc as Session);
  return { _id: result.insertedId, ...doc };
}

export async function getSession(id: string | ObjectId): Promise<Session | null> {
  const col = await sessions();
  return col.findOne({ _id: toObjectId(id) } as Filter<Session>);
}

export async function listSessions(): Promise<Session[]> {
  const col = await sessions();
  return col.find({}).sort({ createdAt: -1 }).toArray();
}

export interface UpdateSessionExtra {
  siteAnalysis?: SiteAnalysis;
  failureReason?: string;
}

export async function updateSessionStatus(
  id: string | ObjectId,
  status: SessionStatus,
  extra: UpdateSessionExtra = {},
): Promise<void> {
  const set: Partial<Session> = { status };
  if (extra.siteAnalysis !== undefined) set.siteAnalysis = extra.siteAnalysis;
  if (extra.failureReason !== undefined)
    set.failureReason = extra.failureReason;

  const update: UpdateFilter<Session> = { $set: set };
  if (extra.failureReason === undefined && status !== "failed") {
    update.$unset = { failureReason: "" };
  }

  const col = await sessions();
  await col.updateOne({ _id: toObjectId(id) } as Filter<Session>, update);
}

export type NewIdea = Omit<Idea, "_id" | "sessionId"> & {
  sessionId?: ObjectId;
};

export async function bulkInsertIdeas(
  sessionId: string | ObjectId,
  newIdeas: NewIdea[],
): Promise<Idea[]> {
  if (newIdeas.length === 0) return [];
  const sid = toObjectId(sessionId);
  const docs: Omit<Idea, "_id">[] = newIdeas.map((idea) => ({
    ...idea,
    sessionId: sid,
  }));
  const col = await ideas();
  const result = await col.insertMany(docs as Idea[]);
  return docs.map(
    (doc, i): Idea => ({ _id: result.insertedIds[i], ...doc }),
  );
}

export async function listIdeas(
  sessionId: string | ObjectId,
): Promise<Idea[]> {
  const col = await ideas();
  return col
    .find({ sessionId: toObjectId(sessionId) } as Filter<Idea>)
    .toArray();
}

export async function patchIdea(
  ideaId: string | ObjectId,
  patch: Partial<Omit<Idea, "_id" | "sessionId">>,
): Promise<Idea | null> {
  const col = await ideas();
  const result = await col.findOneAndUpdate(
    { _id: toObjectId(ideaId) } as Filter<Idea>,
    { $set: { ...patch, edited: true } } as UpdateFilter<Idea>,
    { returnDocument: "after" },
  );
  return result;
}

export async function deleteIdea(ideaId: string | ObjectId): Promise<void> {
  const col = await ideas();
  await col.updateOne(
    { _id: toObjectId(ideaId) } as Filter<Idea>,
    { $set: { deleted: true } },
  );
}

export type BlogUpsert = Partial<Omit<Blog, "_id" | "sessionId" | "ideaId">> & {
  sessionId: string | ObjectId;
  ideaId: string | ObjectId;
  status: Blog["status"];
};

export async function upsertBlog(input: BlogUpsert): Promise<Blog> {
  const col = await blogs();
  const sessionId = toObjectId(input.sessionId);
  const ideaId = toObjectId(input.ideaId);
  const { sessionId: _s, ideaId: _i, ...rest } = input;
  void _s;
  void _i;

  const result = await col.findOneAndUpdate(
    { sessionId, ideaId } as Filter<Blog>,
    {
      $set: { ...rest, sessionId, ideaId },
    } as UpdateFilter<Blog>,
    { upsert: true, returnDocument: "after" },
  );
  if (!result) {
    throw new Error("upsertBlog failed to return a document");
  }
  return result;
}

export async function listBlogs(
  sessionId: string | ObjectId,
): Promise<Blog[]> {
  const col = await blogs();
  return col
    .find({ sessionId: toObjectId(sessionId) } as Filter<Blog>)
    .toArray();
}

export async function getBlog(
  blogId: string | ObjectId,
): Promise<Blog | null> {
  const col = await blogs();
  return col.findOne({ _id: toObjectId(blogId) } as Filter<Blog>);
}

function isObjectId(v: unknown): v is ObjectId {
  return v instanceof ObjectId;
}

function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (isObjectId(v)) return v.toHexString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = serializeValue(val);
    }
    return out;
  }
  return v;
}

export function toClientSession(doc: Session): SessionDTO {
  return serializeValue(doc) as SessionDTO;
}

export function toClientIdea(doc: Idea): IdeaDTO {
  return serializeValue(doc) as IdeaDTO;
}

export function toClientBlog(doc: Blog): BlogDTO {
  return serializeValue(doc) as BlogDTO;
}
