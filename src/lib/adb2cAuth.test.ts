import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrustedMessageOrigin, isTrustedMessageOrigin, normalizeState, validateAuthState } from './adb2cAuth.js';

test('normalizes state values and validates trusted origins', () => {
  assert.equal(normalizeState('  abc123  '), 'abc123');
  assert.equal(normalizeState(''), null);
  assert.equal(getTrustedMessageOrigin('https://portal.example.com'), 'https://portal.example.com');
  assert.equal(isTrustedMessageOrigin('https://portal.example.com', 'https://portal.example.com'), true);
  assert.equal(isTrustedMessageOrigin('https://evil.example.com', 'https://portal.example.com'), false);
  assert.equal(validateAuthState('abc123', 'abc123'), true);
  assert.equal(validateAuthState('abc123', 'def456'), false);
});
