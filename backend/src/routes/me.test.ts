import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProfileInput, validateProfilePayload } from './me.js';

test('validateProfilePayload rejects non-string values but allows username', () => {
  assert.equal(validateProfilePayload({ username: 'Alice' }), null);
  assert.deepEqual(validateProfilePayload({ role: 'admin' }), { error: "unsupported field 'role'." });
});

test('sanitizeProfileInput removes untrusted fields and preserves server-controlled values', () => {
  const result = sanitizeProfileInput(
    {
      username: 'Alice',
      email: 'attacker@example.com',
      adb2cEmail: 'shadow@example.com',
      role: 'admin',
      status: 'Active',
      authProvider: 'legacy-firebase'
    },
    {
      oid: 'user-123',
      name: 'Server User',
      email: 'server@example.com'
    }
  );

  assert.deepEqual(result, {
    username: 'Alice',
    email: 'server@example.com',
    adb2cEmail: null,
    authProvider: 'adb2c'
  });
});
