import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Video, VideoSearchResponse } from '@enitube/shared';
import {
  UNKNOWN_VIDEO,
  VIDEO_A,
  registerUser,
  startTestApi,
  type TestApi,
  type TestUser,
} from './helpers.js';

describe('videos (local catalog)', () => {
  let api: TestApi;
  let user: TestUser;

  before(async () => {
    api = await startTestApi();
    user = await registerUser(api, 'alice');
  });
  after(() => api.close());

  const search = (query: string) =>
    api.request<VideoSearchResponse & { code?: string }>('GET', `/videos/search${query}`, {
      token: user.token,
    });

  it('GET /videos/search: returns complete videos', async () => {
    const { status, body } = await search('?q=rick');
    assert.equal(status, 200);
    assert.ok(body.items.length > 0);
    for (const video of body.items) {
      assert.deepEqual(Object.keys(video).sort(), [
        'channel',
        'description',
        'id',
        'thumbnailUrl',
        'title',
        'views',
      ]);
      assert.match(video.id, /^[\w-]{11}$/);
    }
  });

  it('search ignores case and accents, and requires every word', async () => {
    const lower = await search('?q=never%20gonna');
    const upper = await search('?q=NEVER%20GONNA');
    assert.ok(lower.body.items.some((v) => v.id === VIDEO_A));
    assert.deepEqual(upper.body, lower.body);

    const none = await search('?q=never%20zzzznotfound');
    assert.deepEqual(none.body, { items: [] });
  });

  it('pagination: 12 per page, nextPageToken for the next one, no duplicates', async () => {
    // "a" appears in (almost) the whole 24-video catalog
    const page1 = await search('?q=a');
    assert.equal(page1.body.items.length, 12);
    assert.ok(page1.body.nextPageToken);

    const page2 = await search(`?q=a&pageToken=${page1.body.nextPageToken}`);
    assert.equal(page2.status, 200);
    const ids = [...page1.body.items, ...page2.body.items].map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('invalid parameters: 400 VALIDATION_ERROR', async () => {
    for (const query of [
      '',
      '?q=',
      '?q=%20%20',
      `?q=${'x'.repeat(101)}`,
      '?q=a&pageToken=abc',
      '?q=a&pageToken=-1',
    ]) {
      const res = await search(query);
      assert.equal(res.status, 400, query);
      assert.equal(res.body.code, 'VALIDATION_ERROR', query);
    }
  });

  it('GET /videos/:id: 200 for a catalog video', async () => {
    const res = await api.request<Video>('GET', `/videos/${VIDEO_A}`, { token: user.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, VIDEO_A);
  });

  it('GET /videos/:id: 404 VIDEO_NOT_FOUND if unknown or malformed', async () => {
    for (const id of [UNKNOWN_VIDEO, 'abc', 'aaaaaaaaaa!']) {
      const res = await api.request('GET', `/videos/${id}`, { token: user.token });
      assert.equal(res.status, 404, id);
      assert.equal(res.body.code, 'VIDEO_NOT_FOUND', id);
    }
  });
});
