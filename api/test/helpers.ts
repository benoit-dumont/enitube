import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { AuthResponse, Playlist, User } from '@enitube/shared';
import app from '../src/app.js';
import { sequelize } from '../src/models/db.js';

export const PASSWORD = 'correct-horse-battery';

/** IDs present in the local catalog (`catalog.json`). */
export const VIDEO_A = 'dQw4w9WgXcQ';
export const VIDEO_B = 'aircAruvnKk';
/** Well-formed (11 valid characters) but absent from the catalog. */
export const UNKNOWN_VIDEO = 'zzzzzzzzzzz';
/** Well-formed UUID that does not exist. */
export const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

/* eslint-disable @typescript-eslint/no-explicit-any -- test JSON bodies are intentionally untyped by default */
export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface TestApi {
  baseUrl: string;
  request<T = any>(method: string, path: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  close(): Promise<void>;
}

/**
 * Starts the app on an ephemeral port with fresh tables (`force: true`, `*_test` database enforced
 * by `setup-env.ts`). Test files run one after the other (`--test-concurrency=1`): they share the
 * same database.
 */
export async function startTestApi(): Promise<TestApi> {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    baseUrl,
    async request(method, path, { token, body, headers } = {}) {
      const response = await fetch(baseUrl + path, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await sequelize.close();
    },
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TestUser {
  id: string;
  email: string;
  token: string;
  user: User;
}

/** Registers a user through the API (unique email so tests do not collide). */
export async function registerUser(api: TestApi, name = 'user'): Promise<TestUser> {
  const email = `${name}-${randomUUID().slice(0, 8)}@example.com`;
  const { status, body } = await api.request<AuthResponse>('POST', '/auth/register', {
    body: { username: name.padEnd(3, '_'), email, password: PASSWORD },
  });
  if (status !== 201) throw new Error(`register failed (${status}) : ${JSON.stringify(body)}`);
  return { id: body.user.id, email, token: body.accessToken, user: body.user };
}

export async function createPlaylist(api: TestApi, token: string, name: string): Promise<Playlist> {
  const { status, body } = await api.request<Playlist>('POST', '/playlists', {
    token,
    body: { name },
  });
  if (status !== 201) throw new Error(`creation failed (${status}) : ${JSON.stringify(body)}`);
  return body;
}

export async function addVideo(
  api: TestApi,
  token: string,
  playlistId: string,
  videoId: string,
): Promise<Playlist> {
  const { status, body } = await api.request<Playlist>('POST', `/playlists/${playlistId}/videos`, {
    token,
    body: { videoId },
  });
  if (status !== 201) throw new Error(`add failed (${status}) : ${JSON.stringify(body)}`);
  return body;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
