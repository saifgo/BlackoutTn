#!/usr/bin/env node
/**
 * One-time migration: copy the `reports` collection from Firestore into an
 * Appwrite `reports` collection.
 *
 * Requirements
 * ------------
 *   npm i -D firebase-admin node-appwrite
 *
 * Environment (create a .env.migrate or export in your shell):
 *   GOOGLE_APPLICATION_CREDENTIALS  path to a Firebase service-account JSON
 *   FIREBASE_PROJECT_ID             the Firestore project id
 *
 *   APPWRITE_ENDPOINT               e.g. https://cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY                server API key with `databases.write`
 *   APPWRITE_DATABASE_ID
 *   APPWRITE_REPORTS_COLLECTION_ID
 *
 * Usage:
 *   node scripts/migrate-firestore-to-appwrite.mjs           # dry run
 *   node scripts/migrate-firestore-to-appwrite.mjs --commit  # write to Appwrite
 *
 * The script is idempotent: it reuses the Firestore document id as the
 * Appwrite document id, so re-runs skip anything already imported.
 */

import { cert, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { Client, Databases, ID } from 'node-appwrite';

const {
  GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_PROJECT_ID,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID,
  APPWRITE_REPORTS_COLLECTION_ID,
} = process.env;

const COMMIT = process.argv.includes('--commit');

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

requireEnv('GOOGLE_APPLICATION_CREDENTIALS', GOOGLE_APPLICATION_CREDENTIALS);
requireEnv('FIREBASE_PROJECT_ID', FIREBASE_PROJECT_ID);
requireEnv('APPWRITE_ENDPOINT', APPWRITE_ENDPOINT);
requireEnv('APPWRITE_PROJECT_ID', APPWRITE_PROJECT_ID);
requireEnv('APPWRITE_API_KEY', APPWRITE_API_KEY);
requireEnv('APPWRITE_DATABASE_ID', APPWRITE_DATABASE_ID);
requireEnv('APPWRITE_REPORTS_COLLECTION_ID', APPWRITE_REPORTS_COLLECTION_ID);

const serviceAccount = JSON.parse(
  await (await import('node:fs/promises')).readFile(GOOGLE_APPLICATION_CREDENTIALS, 'utf8'),
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: FIREBASE_PROJECT_ID,
});
const firestore = getFirestore();

const appwrite = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const databases = new Databases(appwrite);

/** Firestore auto-IDs are 20 URL-safe chars; Appwrite accepts up to 36 of
 *  [A-Za-z0-9_.-] not starting with a special char. Firestore IDs qualify. */
function toAppwriteId(firestoreId) {
  if (/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/.test(firestoreId)) return firestoreId;
  return ID.unique();
}

function normalize(doc) {
  const data = doc.data();
  const rawCreatedAt = data.createdAt;
  let createdAt;
  if (rawCreatedAt instanceof Timestamp) createdAt = rawCreatedAt.toMillis();
  else if (typeof rawCreatedAt === 'number') createdAt = rawCreatedAt;
  else return null;

  if (typeof data.zoneId !== 'string' || typeof data.userId !== 'string') return null;
  const type =
    data.type === 'voltage' || data.type === 'restore' ? data.type : 'blackout';

  const payload = {
    zoneId: data.zoneId,
    userId: data.userId,
    type,
    createdAt,
  };
  if (typeof data.sectorId === 'string') payload.sectorId = data.sectorId;
  if (typeof data.sectorName === 'string') payload.sectorName = data.sectorName;

  return { id: toAppwriteId(doc.id), payload };
}

async function alreadyExists(id) {
  try {
    await databases.getDocument(APPWRITE_DATABASE_ID, APPWRITE_REPORTS_COLLECTION_ID, id);
    return true;
  } catch (err) {
    if (err && (err.code === 404 || err.type === 'document_not_found')) return false;
    throw err;
  }
}

async function main() {
  console.log(`Mode: ${COMMIT ? 'COMMIT (writes to Appwrite)' : 'DRY-RUN'}`);
  console.log('Reading Firestore reports...');
  const snapshot = await firestore.collection('reports').get();
  console.log(`Found ${snapshot.size} Firestore documents.`);

  let imported = 0;
  let skipped = 0;
  let invalid = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const normalized = normalize(doc);
    if (!normalized) {
      invalid++;
      continue;
    }
    const { id, payload } = normalized;

    if (!COMMIT) {
      imported++;
      continue;
    }

    try {
      if (await alreadyExists(id)) {
        skipped++;
        continue;
      }
      await databases.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_REPORTS_COLLECTION_ID,
        id,
        payload,
      );
      imported++;
      if (imported % 50 === 0) console.log(`  imported ${imported}...`);
    } catch (err) {
      failed++;
      console.error(`  failed ${id}:`, err?.message || err);
    }
  }

  console.log('---');
  console.log(`imported: ${imported}`);
  console.log(`skipped (already in Appwrite): ${skipped}`);
  console.log(`invalid (missing fields): ${invalid}`);
  console.log(`failed: ${failed}`);
  if (!COMMIT) {
    console.log('Re-run with --commit to actually write to Appwrite.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
