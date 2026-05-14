import { MongoClient, type Db } from "mongodb";

const DB_NAME = "blogforge";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local before using the database.",
    );
  }
  const client = new MongoClient(uri);
  return client.connect();
}

const clientPromise: Promise<MongoClient> =
  globalThis._mongoClientPromise ??
  (globalThis._mongoClientPromise = createClientPromise());

export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export { DB_NAME };
