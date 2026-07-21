function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export const config = {
  port: Number(readEnv('PORT') || 8080),
  allowedOrigins: (readEnv('ALLOWED_ORIGINS') || 'http://localhost:3000,http://localhost:4173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
  firestoreDatabaseId: readEnv('FIRESTORE_DATABASE_ID') || '(configure-firestore-database-id)',
  gcpProjectId: readEnv('GCP_PROJECT_ID') || readEnv('GOOGLE_CLOUD_PROJECT') || '',
  entraTenantName: readEnv('ENTRA_TENANT_NAME') || '(configure-tenant-name)',
  entraTenantId: readEnv('ENTRA_TENANT_ID') || '(configure-tenant-id)',
  entraPolicy: readEnv('ENTRA_POLICY') || '(configure-b2c-policy)',
  entraAudience: readEnv('ENTRA_AUDIENCE') || '(configure-api-client-id)',
  authProvider: readEnv('AUTH_PROVIDER') || 'entra'
};
