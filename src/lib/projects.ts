import {
  ObjectId,
  type Collection,
  type Filter,
  type UpdateFilter,
} from "mongodb";
import { getDb } from "@/lib/mongo";
import {
  ensureIndexes,
  serializeValue,
  toObjectId,
} from "@/lib/db";
import type {
  Project,
  ProjectAnalysisStatus,
  ProjectDTO,
  SiteAnalysis,
} from "@/types";

async function projects(): Promise<Collection<Project>> {
  const db = await getDb();
  await ensureIndexes();
  return db.collection<Project>("projects");
}

export interface CreateProjectInput {
  name: string;
  websiteUrl: string;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const now = new Date();
  const doc: Omit<Project, "_id"> = {
    name: input.name,
    websiteUrl: input.websiteUrl,
    createdAt: now,
    updatedAt: now,
    analysisStatus: "pending",
  };
  const col = await projects();
  const result = await col.insertOne(doc as Project);
  return { _id: result.insertedId, ...doc };
}

export async function getProject(
  id: string | ObjectId,
): Promise<Project | null> {
  const col = await projects();
  return col.findOne({ _id: toObjectId(id) } as Filter<Project>);
}

export async function listProjects(): Promise<Project[]> {
  const col = await projects();
  return col.find({}).sort({ createdAt: -1 }).toArray();
}

export async function renameProject(
  id: string | ObjectId,
  name: string,
): Promise<Project | null> {
  const col = await projects();
  const result = await col.findOneAndUpdate(
    { _id: toObjectId(id) } as Filter<Project>,
    { $set: { name, updatedAt: new Date() } } as UpdateFilter<Project>,
    { returnDocument: "after" },
  );
  return result;
}

export async function deleteProject(id: string | ObjectId): Promise<void> {
  const col = await projects();
  await col.deleteOne({ _id: toObjectId(id) } as Filter<Project>);
}

export interface SetProjectAnalysisInput {
  status: ProjectAnalysisStatus;
  siteAnalysis?: SiteAnalysis;
  analyzedAt?: Date;
  failureReason?: string;
}

export async function setProjectAnalysis(
  id: string | ObjectId,
  input: SetProjectAnalysisInput,
): Promise<void> {
  const set: Partial<Project> = {
    analysisStatus: input.status,
    updatedAt: new Date(),
  };
  if (input.siteAnalysis !== undefined) set.siteAnalysis = input.siteAnalysis;
  if (input.analyzedAt !== undefined) set.analyzedAt = input.analyzedAt;
  if (input.failureReason !== undefined)
    set.failureReason = input.failureReason;

  const update: UpdateFilter<Project> = { $set: set };
  // Clear stale failure reason when transitioning back to a non-failed state.
  if (input.failureReason === undefined && input.status !== "failed") {
    update.$unset = { failureReason: "" };
  }

  const col = await projects();
  await col.updateOne({ _id: toObjectId(id) } as Filter<Project>, update);
}

export function toClientProject(doc: Project): ProjectDTO {
  return serializeValue(doc) as ProjectDTO;
}
