function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export const config = {
  port: Number(readEnv('PORT') || 8080),

  allowedOrigins: (readEnv('ALLOWED_ORIGINS') || 'http://localhost:3000,http://localhost:4173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),

  firestoreDatabaseId: readEnv('FIRESTORE_DATABASE_ID'),

  gcpProjectId: readEnv('GCP_PROJECT_ID') || readEnv('GOOGLE_CLOUD_PROJECT') || '',

  // Azure AD B2C
  adb2cTenantName: readEnv('ADB2C_TENANT_NAME') || 'celcomdigib2c',
  adb2cTenantId: readEnv('ADB2C_TENANT_ID') || 'celcomdigib2c.onmicrosoft.com',
  adb2cPolicy: readEnv('ADB2C_POLICY') || 'B2C_1_sign_in_with_id',
  adb2cClientId: readEnv('ADB2C_CLIENT_ID') || '',
  adb2cClientSecret: readEnv('ADB2C_CLIENT_SECRET') || '',
  authProvider: readEnv('AUTH_PROVIDER') || 'hybrid'
};