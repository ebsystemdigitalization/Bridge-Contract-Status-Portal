export type AuthProvider = 'adb2c' | 'legacy-firebase' | 'unknown';

export function normalizeAuthProvider(provider?: string | null): AuthProvider {
  const value = (provider || '').trim().toLowerCase();

  if (value === 'adb2c' || value === 'entra') {
    return 'adb2c';
  }

  if (value === 'legacy-firebase' || value === 'firebase') {
    return 'legacy-firebase';
  }

  return 'unknown';
}

export function isAdb2cShadowProfile(profile?: { authProvider?: string | null } | null) {
  return normalizeAuthProvider(profile?.authProvider) === 'adb2c';
}
