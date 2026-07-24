import { Account, Client, Databases } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;

export const APPWRITE_DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID as string;
export const APPWRITE_REPORTS_COLLECTION_ID = import.meta.env
  .VITE_APPWRITE_REPORTS_COLLECTION_ID as string;

function assertConfigured(): void {
  const missing: string[] = [];
  if (!endpoint) missing.push('VITE_APPWRITE_ENDPOINT');
  if (!projectId) missing.push('VITE_APPWRITE_PROJECT_ID');
  if (!APPWRITE_DATABASE_ID) missing.push('VITE_APPWRITE_DATABASE_ID');
  if (!APPWRITE_REPORTS_COLLECTION_ID) missing.push('VITE_APPWRITE_REPORTS_COLLECTION_ID');
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[BlackoutTN] Missing Appwrite env vars: ${missing.join(', ')}. ` +
        'Create a .env.local from .env.example. Auth and reports will fail until configured.',
    );
  }
}

assertConfigured();

export const appwriteClient: Client = new Client()
  .setEndpoint(endpoint ?? 'https://cloud.appwrite.io/v1')
  .setProject(projectId ?? '');

export const account: Account = new Account(appwriteClient);
export const databases: Databases = new Databases(appwriteClient);
