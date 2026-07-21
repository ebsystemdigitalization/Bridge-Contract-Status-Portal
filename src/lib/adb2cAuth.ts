export function normalizeState(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

export function validateAuthState(expectedState: string | null | undefined, receivedState: string | null | undefined) {
  const expected = normalizeState(expectedState);
  const received = normalizeState(receivedState);

  if (!expected || !received) {
    return false;
  }

  return expected === received;
}

export function getTrustedMessageOrigin(origin: string | null | undefined) {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function isTrustedMessageOrigin(eventOrigin: string | null | undefined, expectedOrigin: string | null | undefined) {
  const normalizedEvent = getTrustedMessageOrigin(eventOrigin);
  const normalizedExpected = getTrustedMessageOrigin(expectedOrigin);
  return Boolean(normalizedEvent && normalizedExpected && normalizedEvent === normalizedExpected);
}
