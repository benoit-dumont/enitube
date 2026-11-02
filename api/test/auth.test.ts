import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { User } from '../src/models/index.js';
import { PASSWORD, registerUser, startTestApi, type TestApi } from './helpers.js';

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('auth', () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });
  after(() => api.close());

  describe('POST /auth/register', () => {
    it('creates the account: 201, token, public user, hashed password', async () => {
      const { status, body } = await api.request('POST', '/auth/register', {
        body: { username: 'alice', email: 'Alice@Example.COM', password: PASSWORD },
      });

      assert.equal(status, 201);
      assert.equal(typeof body.accessToken, 'string');
      // email is lowercased; only id / username / email are exposed
      assert.deepEqual(Object.keys(body.user).sort(), ['email', 'id', 'username']);
      assert.equal(body.user.email, 'alice@example.com');
      assert.doesNotMatch(JSON.stringify(body), /password/i);

      const stored = await User.findByPk(body.user.id);
      assert.ok(stored);
      assert.notEqual(stored.passwordHash, PASSWORD);
      assert.match(stored.passwordHash, /^\$2[aby]\$12\$/); // bcrypt, cost 12
    });

    it('email already taken (case-insensitive): 409 EMAIL_TAKEN', async () => {
      const { status, body } = await api.request('POST', '/auth/register', {
        body: { username: 'alice2', email: 'ALICE@example.com', password: PASSWORD },
      });
      assert.equal(status, 409);
      assert.equal(body.code, 'EMAIL_TAKEN');
      assert.equal(typeof body.message, 'string');
    });

    it('password too short or too long: 400 WEAK_PASSWORD', async () => {
      for (const password of ['court', 'x'.repeat(9), 'é'.repeat(37)]) {
        // 'é' is 2 bytes: 37 characters = 74 bytes > 72 (bcrypt limit)
        const { status, body } = await api.request('POST', '/auth/register', {
          body: { username: 'bob', email: 'bob@example.com', password },
        });
        assert.equal(status, 400, `password of ${password.length} chars`);
        assert.equal(body.code, 'WEAK_PASSWORD');
      }
    });

    it('invalid fields: 400 VALIDATION_ERROR', async () => {
      const cases: Record<string, unknown> = {
        'invalid email': { username: 'bob', email: 'pas-un-email', password: PASSWORD },
        'username too short': { username: 'ab', email: 'bob@example.com', password: PASSWORD },
        'username too long': { username: 'x'.repeat(31), email: 'bob@example.com', password: PASSWORD },
        'missing email': { username: 'bob', password: PASSWORD },
      };
      for (const [label, body] of Object.entries(cases)) {
        const res = await api.request('POST', '/auth/register', { body });
        assert.equal(res.status, 400, label);
        assert.equal(res.body.code, 'VALIDATION_ERROR', label);
      }
    });

    it('missing password: 400 WEAK_PASSWORD', async () => {
      const res = await api.request('POST', '/auth/register', {
        body: { username: 'bob', email: 'bob@example.com' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'WEAK_PASSWORD');
    });

    it('a validation failure creates no account', async () => {
      const before = await User.count();
      await api.request('POST', '/auth/register', {
        body: { username: 'zed', email: 'zed@example.com', password: 'court' },
      });
      assert.equal(await User.count(), before);
    });

    it('malformed JSON: 400 VALIDATION_ERROR (not 500)', async () => {
      const res = await fetch(`${api.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ not json',
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { code: string; message: string };
      assert.equal(body.code, 'VALIDATION_ERROR');
      assert.equal(typeof body.message, 'string');
    });
  });

  describe('POST /auth/login', () => {
    it('valid credentials: 200 + token usable on /auth/me', async () => {
      const user = await registerUser(api, 'carol');
      const login = await api.request('POST', '/auth/login', {
        // email case does not matter
        body: { email: user.email.toUpperCase(), password: PASSWORD },
      });
      assert.equal(login.status, 200);
      assert.equal(login.body.user.id, user.id);

      const me = await api.request('GET', '/auth/me', { token: login.body.accessToken });
      assert.equal(me.status, 200);
      assert.deepEqual(me.body, { user: user.user });
    });

    it('wrong password and unknown email: same response (no account enumeration)', async () => {
      const user = await registerUser(api, 'dave');
      const wrongPassword = await api.request('POST', '/auth/login', {
        body: { email: user.email, password: 'wrong-password' },
      });
      const unknownEmail = await api.request('POST', '/auth/login', {
        body: { email: 'nobody@example.com', password: PASSWORD },
      });

      assert.equal(wrongPassword.status, 401);
      assert.equal(wrongPassword.body.code, 'INVALID_CREDENTIALS');
      assert.deepEqual(unknownEmail, wrongPassword);
    });

    it('invalid email: 400 VALIDATION_ERROR', async () => {
      const res = await api.request('POST', '/auth/login', {
        body: { email: 'pas-un-email', password: PASSWORD },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    it('missing password: 400 VALIDATION_ERROR (login has no password policy)', async () => {
      const res = await api.request('POST', '/auth/login', {
        body: { email: 'bob@example.com' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR'); // openapi.yaml: login never emits WEAK_PASSWORD
    });
  });

  describe('GET /auth/me and requireAuth', () => {
    const sign = (claims: object, secret: string = env.JWT_SECRET, options: jwt.SignOptions = {}) =>
      jwt.sign(claims, secret, { algorithm: 'HS256', ...options });

    it('no token or no Bearer scheme: 401 UNAUTHORIZED', async () => {
      const noHeader = await api.request('GET', '/auth/me');
      assert.equal(noHeader.status, 401);
      assert.equal(noHeader.body.code, 'UNAUTHORIZED');

      const user = await registerUser(api, 'erin');
      const basic = await api.request('GET', '/auth/me', {
        headers: { Authorization: user.token }, // no "Bearer" prefix
      });
      assert.equal(basic.status, 401);
    });

    it('unreadable, badly signed or subject-less token: 401 UNAUTHORIZED', async () => {
      const user = await registerUser(api, 'frank');
      const tokens: Record<string, string> = {
        'unreadable': 'not.a.jwt',
        'other secret': sign({}, 'x'.repeat(40), { subject: user.id }),
        'no subject': sign({}),
        // alg=none: an unsigned token must never pass
        'alg none': `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: user.id })}.`,
      };
      for (const [label, token] of Object.entries(tokens)) {
        const res = await api.request('GET', '/auth/me', { token });
        assert.equal(res.status, 401, label);
        assert.equal(res.body.code, 'UNAUTHORIZED', label);
      }
    });

    it('expired token: 401 TOKEN_EXPIRED (distinct, so the front can react)', async () => {
      const user = await registerUser(api, 'gina');
      const token = sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: -10 });
      const res = await api.request('GET', '/auth/me', { token });
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'TOKEN_EXPIRED');
    });

    it('valid token of a deleted account: 401 UNAUTHORIZED', async () => {
      const user = await registerUser(api, 'hugo');
      await User.destroy({ where: { id: user.id } });
      const res = await api.request('GET', '/auth/me', { token: user.token });
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'UNAUTHORIZED');
    });
  });

  describe('protected routes', () => {
    const routes: [string, string][] = [
      ['GET', '/auth/me'],
      ['GET', '/videos/search?q=rick'],
      ['GET', '/videos/dQw4w9WgXcQ'],
      ['GET', '/playlists'],
      ['POST', '/playlists'],
      ['PATCH', '/playlists/00000000-0000-4000-8000-000000000000'],
      ['DELETE', '/playlists/00000000-0000-4000-8000-000000000000'],
      ['POST', '/playlists/00000000-0000-4000-8000-000000000000/videos'],
      ['DELETE', '/playlists/00000000-0000-4000-8000-000000000000/videos/dQw4w9WgXcQ'],
    ];

    for (const [method, path] of routes) {
      it(`${method} ${path.split('?')[0]} without token: 401`, async () => {
        const res = await api.request(method, path, { body: method === 'GET' ? undefined : {} });
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'UNAUTHORIZED');
      });
    }
  });
});
