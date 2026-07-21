import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from '../config.js';

const client = new SecretManagerServiceClient();
const cache = new Map<string, string>();

function getProjectId() {
  return config.gcpProjectId || process.env.GOOGLE_CLOUD_PROJECT || '';
}

export async function getSecret(secretId: string, version = 'latest') {
  const cacheKey = `${secretId}:${version}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('GCP_PROJECT_ID is required to read Secret Manager secrets.');
  }

  const [accessResponse] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${secretId}/versions/${version}`
  });

  const value = accessResponse.payload?.data?.toString();
  if (!value) {
    throw new Error(`Secret ${secretId} version ${version} is empty or unavailable.`);
  }

  cache.set(cacheKey, value);
  return value;
}

export function clearSecretCache(secretId?: string) {
  if (!secretId) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(`${secretId}:`)) {
      cache.delete(key);
    }
  }
}
