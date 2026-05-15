/**
 * One-shot migration from the legacy schema (where every Session held its own
 * websiteUrl + siteAnalysis) to the project-based schema (Project owns the
 * site, Batches reuse it).
 *
 * Idempotent: sessions already containing a `projectId` are skipped, so it's
 * safe to re-run after a partial migration.
 *
 * Run with:
 *   npx tsx src/scripts/migrate-to-projects.ts
 *
 * Requires MONGODB_URI in the environment (the same connection string the app
 * uses). Take a Mongo backup first.
 */

import { MongoClient, ObjectId } from "mongodb";

const DB_NAME = "blogforge";

interface LegacySession {
  _id: ObjectId;
  createdAt: Date;
  websiteUrl?: string;
  projectId?: ObjectId;
  siteAnalysis?: unknown;
  name?: string;
  [key: string]: unknown;
}

interface LegacyProject {
  _id: ObjectId;
  name: string;
  websiteUrl: string;
  createdAt: Date;
  updatedAt: Date;
  analysisStatus: "pending" | "analyzing" | "complete" | "failed";
  siteAnalysis?: unknown;
  analyzedAt?: Date;
}

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your environment before running this script.",
    );
  }

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(DB_NAME);
    const sessions = db.collection<LegacySession>("sessions");
    const projects = db.collection<LegacyProject>("projects");

    const unmigrated = await sessions
      .find({ projectId: { $exists: false } })
      .toArray();

    if (unmigrated.length === 0) {
      console.log("No un-migrated sessions found. Nothing to do.");
      return;
    }

    // Group sessions by normalized websiteUrl.
    const groups = new Map<string, LegacySession[]>();
    let skippedNoUrl = 0;
    for (const session of unmigrated) {
      if (!session.websiteUrl) {
        skippedNoUrl++;
        continue;
      }
      const key = normalizeUrl(session.websiteUrl);
      const list = groups.get(key) ?? [];
      list.push(session);
      groups.set(key, list);
    }

    let projectsCreated = 0;
    let projectsReused = 0;
    let sessionsUpdated = 0;

    for (const [normalizedUrl, sessionGroup] of groups) {
      // Use the first session's verbatim websiteUrl for display, since the
      // normalized form may have stripped a trailing slash the user expects.
      const displayUrl = sessionGroup[0]!.websiteUrl!;

      // Look up an existing project with the normalized URL.
      const existingProjects = await projects.find({}).toArray();
      let project = existingProjects.find(
        (p) => normalizeUrl(p.websiteUrl) === normalizedUrl,
      );

      if (!project) {
        // Pick the most recent session with siteAnalysis to seed the project's
        // analysis (otherwise leave it pending).
        const withAnalysis = [...sessionGroup]
          .filter((s) => !!s.siteAnalysis)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          );
        const seed = withAnalysis[0];
        const now = new Date();
        const newProject: LegacyProject = {
          _id: new ObjectId(),
          name: `Legacy — ${hostnameOf(displayUrl)}`,
          websiteUrl: displayUrl,
          createdAt: now,
          updatedAt: now,
          analysisStatus: seed ? "complete" : "pending",
          ...(seed
            ? {
                siteAnalysis: seed.siteAnalysis,
                analyzedAt: new Date(seed.createdAt),
              }
            : {}),
        };
        await projects.insertOne(newProject);
        project = newProject;
        projectsCreated++;
      } else {
        projectsReused++;
      }

      // Update each session in the group: attach projectId + name; strip the
      // legacy websiteUrl + siteAnalysis fields.
      let modifiedInGroup = 0;
      for (const session of sessionGroup) {
        const res = await sessions.updateOne(
          { _id: session._id },
          {
            $set: {
              projectId: project._id,
              name:
                session.name ??
                `Legacy batch — ${new Date(session.createdAt)
                  .toISOString()
                  .slice(0, 10)}`,
            },
            $unset: { websiteUrl: "", siteAnalysis: "" },
          },
        );
        modifiedInGroup += res.modifiedCount;
      }
      sessionsUpdated += modifiedInGroup;
    }

    console.log("Migration complete:");
    console.log(`  Projects created:  ${projectsCreated}`);
    console.log(`  Projects reused:   ${projectsReused}`);
    console.log(`  Sessions updated:  ${sessionsUpdated}`);
    if (skippedNoUrl > 0) {
      console.log(
        `  Sessions skipped (no websiteUrl): ${skippedNoUrl}. Review these manually.`,
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
