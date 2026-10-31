import { MongoClient, type Collection } from 'mongodb';

/**
 * MongoDB Atlas access layer (server-side only).
 *
 * All reads/writes go through the Next.js API routes, which use this
 * singleton client. The connection string lives in MONGODB_URI; indexes
 * are created lazily on first connect (idempotent — createIndex is a
 * no-op when the index exists).
 */

const DB_NAME = 'vault';

/**
 * Document shapes. `_id` is the client-generated id (item_..., folder_...)
 * — a plain string, mirroring the old Firestore document ids.
 * Pre-folder items may still carry legacy albumId/albumName fields.
 */
export interface VaultItemRecord {
  _id: string;
  ownerId: string;
  title: string;
  module: string;
  folderId?: string;
  folderName?: string;
  albumId?: string;
  albumName?: string;
  tags?: string[];
  createdAtIso: string;
  formattedDate: string;
  formattedTime: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl: string;
  durationSec: number;
  notes: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderRecord {
  _id: string;
  ownerId: string;
  name: string;
  module: string;
  createdAtIso: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRecord {
  email: string;
  passwordHash: string;
  createdAt: Date;
}

declare global {
  var _vaultMongoClient: Promise<MongoClient> | undefined;
}

async function createClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
  });
  await client.connect();
  const db = client.db(DB_NAME);
  await Promise.all([
    db.collection('vault_items').createIndex({ ownerId: 1, createdAtIso: -1 }),
    db.collection('folders').createIndex({ ownerId: 1, createdAtIso: -1 }),
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
  ]);
  return client;
}

export function getMongoClient(): Promise<MongoClient> {
  if (!global._vaultMongoClient) {
    global._vaultMongoClient = createClient().catch((err) => {
      // Don't cache a failed connection attempt — allow retry on next call.
      global._vaultMongoClient = undefined;
      throw err;
    });
  }
  return global._vaultMongoClient;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(DB_NAME);
}

export async function getVaultItemsCollection(): Promise<Collection<VaultItemRecord>> {
  return (await getDb()).collection<VaultItemRecord>('vault_items');
}

export async function getFoldersCollection(): Promise<Collection<FolderRecord>> {
  return (await getDb()).collection<FolderRecord>('folders');
}

export async function getUsersCollection(): Promise<Collection<UserRecord>> {
  return (await getDb()).collection<UserRecord>('users');
}
