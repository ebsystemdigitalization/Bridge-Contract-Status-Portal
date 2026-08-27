function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export const config = {
  port: Number(readEnv('PORT') || 8080),

  allowedOrigins: (
    readEnv('ALLOWED_ORIGINS') ||
    'http://localhost:3000,http://localhost:4173'
  )
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),

  firestoreDatabaseId: readEnv('FIRESTORE_DATABASE_ID'),

  gcpProjectId:
    readEnv('GCP_PROJECT_ID') ||
    readEnv('GOOGLE_CLOUD_PROJECT') ||
    '',

  // =========================================================
  // Dealer / DMS - Azure AD B2C
  // =========================================================
  adb2cTenantName:
    readEnv('ADB2C_TENANT_NAME') || 'celcomdigib2c',

  adb2cTenantId:
    readEnv('ADB2C_TENANT_ID') ||
    'celcomdigib2c.onmicrosoft.com',

  adb2cPolicy:
    readEnv('ADB2C_POLICY') ||
    'B2C_1_sign_in_with_id',

  adb2cClientId:
    readEnv('ADB2C_CLIENT_ID') || '',

  adb2cClientSecret:
    readEnv('ADB2C_CLIENT_SECRET') || '',

  adb2cRedirectUri:
    readEnv('ADB2C_REDIRECT_URI') || '',

  // =========================================================
  // Internal Employees - Microsoft Entra ID / OIDC
  // =========================================================
  employeeEntraTenantId:
    readEnv('EMPLOYEE_ENTRA_TENANT_ID') ||
    'bf048976-7110-4e87-96f3-c6744908b8be',

  employeeEntraClientId:
    readEnv('EMPLOYEE_ENTRA_CLIENT_ID') ||
    '451ac92f-1a4b-43e3-be18-0a42e9d9b59a',

  employeeEntraClientSecret:
    readEnv('EMPLOYEE_ENTRA_CLIENT_SECRET') || '',

  employeeEntraRedirectUri:
    readEnv('EMPLOYEE_ENTRA_REDIRECT_URI') ||
    'https://bridge-portal-268827847108.asia-southeast1.run.app/auth/employee/callback',

  authProvider:
    readEnv('AUTH_PROVIDER') || 'hybrid',

  // =========================================================
  // Compatibility for existing auth middleware
  // Keep these pointing to DMS/B2C for now.
  // =========================================================
  entraTenantName:
    readEnv('ADB2C_TENANT_NAME') || '',

  entraTenantId:
    readEnv('ADB2C_TENANT_ID') || '',

  entraPolicy:
    readEnv('ADB2C_POLICY') || '',

  entraAudience:
    readEnv('ADB2C_CLIENT_ID') || '',
};