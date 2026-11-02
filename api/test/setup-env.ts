/**
 * Loaded BEFORE any application import (`node --import ./test/setup-env.ts`): `config/env.ts`
 * validates `process.env` at import time.
 *
 * Safeguard: tests run `sequelize.sync({ force: true })` (DROP + CREATE of the tables). The
 * development `.env` file is therefore deliberately never read here, and the database name must end
 * with `_test`. The connection comes from the environment or from `.env.test` (see `.env.test.example`).
 */
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', quiet: true });

const fail = (message: string): never => {
  throw new Error(`[tests] ${message}`);
};

for (const name of ['MYSQL_USER', 'MYSQL_PASS']) {
  if (!process.env[name]) {
    fail(
      `${name} is missing: set it in the environment or in api/.env.test (see .env.test.example).`,
    );
  }
}

const database = process.env.MYSQL_BDD ?? 'enitube_test';
if (!/_test$/.test(database)) {
  fail(
    `Database "${database}" does not end with "_test": refusing to wipe it. Use a dedicated test database.`,
  );
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_DEBUG: 'false',
  MYSQL_BDD: database,
  MYSQL_HOST: process.env.MYSQL_HOST ?? '127.0.0.1',
  MYSQL_PORT: process.env.MYSQL_PORT ?? '3307',
  MYSQL_ROOT_PASSWORD: process.env.MYSQL_ROOT_PASSWORD ?? 'unused-in-tests',
  VIDEO_PROVIDER: 'catalog', // never any network call or YouTube quota in tests
  // Throwaway secret, different on every run: nothing to commit.
  JWT_SECRET: randomBytes(32).toString('hex'),
  JWT_ACCESS_TTL: '15m',
});
