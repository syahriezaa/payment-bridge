import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { hashPassword, verifyPassword, generateToken, verifyToken, generateSalt } from '../../src/services/auth.js';
import { adminUserDb, getDb, closeDb } from '../../src/db/index.js';

describe('Unit: Auth Service & AdminUserDb', () => {
  const testSecret = 'super-secret-key-12345';

  beforeEach(() => {
    process.env.DATABASE_PATH = ':memory:';
    closeDb();
    getDb(':memory:');
    adminUserDb.clearAll();
  });

  describe('Password Hashing & Verification', () => {
    it('generates a salt and hashes password correctly', () => {
      const password = 'SecretPassword123!';
      const { hash, salt } = hashPassword(password);

      assert.ok(hash);
      assert.ok(salt);
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(typeof salt, 'string');
      assert.notStrictEqual(hash, password);
    });

    it('verifies correct password against hash and salt', () => {
      const password = 'CorrectPassword456';
      const { hash, salt } = hashPassword(password);

      const isValid = verifyPassword(password, hash, salt);
      assert.strictEqual(isValid, true);
    });

    it('rejects incorrect password during verification', () => {
      const password = 'CorrectPassword456';
      const { hash, salt } = hashPassword(password);

      const isValid = verifyPassword('WrongPassword', hash, salt);
      assert.strictEqual(isValid, false);
    });

    it('handles custom salt length', () => {
      const salt = generateSalt(32);
      assert.strictEqual(salt.length, 64); // 32 bytes in hex = 64 chars
    });
  });

  describe('JWT Token Generation & Verification', () => {
    it('generates and verifies valid JWT token', () => {
      const payload = { id: 'admin-1', username: 'admin' };
      const token = generateToken(payload, testSecret, '1h');

      assert.ok(token);
      assert.strictEqual(typeof token, 'string');

      const decoded = verifyToken(token, testSecret);
      assert.strictEqual(decoded.id, 'admin-1');
      assert.strictEqual(decoded.username, 'admin');
      assert.ok(decoded.iat);
      assert.ok(decoded.exp);
    });

    it('rejects token signed with a different secret', () => {
      const payload = { id: 'admin-1', username: 'admin' };
      const token = generateToken(payload, testSecret, '1h');

      assert.throws(() => {
        verifyToken(token, 'wrong-secret-key');
      }, /Invalid token signature/);
    });

    it('rejects malformed token strings', () => {
      assert.throws(() => {
        verifyToken('invalid.token', testSecret);
      }, /Invalid token format/);

      assert.throws(() => {
        verifyToken('', testSecret);
      }, /Invalid token/);
    });
  });

  describe('AdminUserDb Operations', () => {
    it('creates and finds admin user by username and id', () => {
      assert.strictEqual(adminUserDb.count(), 0);

      const { hash, salt } = hashPassword('adminpass');
      const created = adminUserDb.create({
        username: 'sysadmin',
        password_hash: hash,
        salt
      });

      assert.ok(created.id);
      assert.strictEqual(created.username, 'sysadmin');
      assert.strictEqual(adminUserDb.count(), 1);

      const foundByUsername = adminUserDb.findByUsername('sysadmin');
      assert.ok(foundByUsername);
      assert.strictEqual(foundByUsername?.id, created.id);

      const foundById = adminUserDb.findById(created.id);
      assert.ok(foundById);
      assert.strictEqual(foundById?.username, 'sysadmin');
    });

    it('returns null when searching for non-existent admin user', () => {
      assert.strictEqual(adminUserDb.findByUsername('nonexistent'), null);
      assert.strictEqual(adminUserDb.findById('nonexistent-id'), null);
    });
  });
});
