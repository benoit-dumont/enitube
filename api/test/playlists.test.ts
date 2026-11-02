import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Playlist as PlaylistDto } from '@enitube/shared';
import { Playlist, PlaylistVideo, Video } from '../src/models/index.js';
import {
  UNKNOWN_UUID,
  UNKNOWN_VIDEO,
  VIDEO_A,
  VIDEO_B,
  addVideo,
  createPlaylist,
  registerUser,
  sleep,
  startTestApi,
  type TestApi,
  type TestUser,
} from './helpers.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('playlists', () => {
  let api: TestApi;
  let alice: TestUser;
  let bob: TestUser;

  before(async () => {
    api = await startTestApi();
    [alice, bob] = await Promise.all([registerUser(api, 'alice'), registerUser(api, 'bob')]);
  });
  after(() => api.close());

  describe('POST /playlists', () => {
    it('creates an empty playlist: 201, UUID id, ISO date, trimmed name', async () => {
      const { status, body } = await api.request<PlaylistDto>('POST', '/playlists', {
        token: alice.token,
        body: { name: '  Rock  ' },
      });
      assert.equal(status, 201);
      assert.match(body.id, UUID);
      assert.equal(body.name, 'Rock');
      assert.equal(new Date(body.createdAt).toISOString(), body.createdAt);
      assert.deepEqual(body.videos, []);
    });

    it('empty, blank, too long, missing or non-string name: 400 VALIDATION_ERROR', async () => {
      const bodies: unknown[] = [
        { name: '' },
        { name: '   ' },
        { name: 'x'.repeat(101) },
        {},
        { name: 42 },
      ];
      for (const body of bodies) {
        const res = await api.request('POST', '/playlists', { token: alice.token, body });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.code, 'VALIDATION_ERROR', JSON.stringify(body));
      }
    });

    it('name already used by the same user: 409 PLAYLIST_NAME_TAKEN', async () => {
      await createPlaylist(api, alice.token, 'Jazz');
      const res = await api.request('POST', '/playlists', {
        token: alice.token,
        body: { name: 'Jazz' },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'PLAYLIST_NAME_TAKEN');
    });

    it('the same name is allowed for another user', async () => {
      await createPlaylist(api, alice.token, 'Shared');
      const res = await api.request('POST', '/playlists', {
        token: bob.token,
        body: { name: 'Shared' },
      });
      assert.equal(res.status, 201);
    });
  });

  describe('GET /playlists', () => {
    it('lists only the user's playlists, sorted by name', async () => {
      const carol = await registerUser(api, 'carol');
      for (const name of ['Zebra', 'Alpha', 'Middle']) await createPlaylist(api, carol.token, name);

      const { status, body } = await api.request<{ items: PlaylistDto[] }>('GET', '/playlists', {
        token: carol.token,
      });
      assert.equal(status, 200);
      assert.deepEqual(
        body.items.map((p) => p.name),
        ['Alpha', 'Middle', 'Zebra'],
      );
    });

    it('a new user has an empty list', async () => {
      const dave = await registerUser(api, 'dave');
      const res = await api.request('GET', '/playlists', { token: dave.token });
      assert.deepEqual(res.body, { items: [] });
    });
  });

  describe('PATCH /playlists/:id', () => {
    it('renames and keeps the videos', async () => {
      const user = await registerUser(api, 'erin');
      const playlist = await createPlaylist(api, user.token, 'Before');
      await addVideo(api, user.token, playlist.id, VIDEO_A);

      const res = await api.request<PlaylistDto>('PATCH', `/playlists/${playlist.id}`, {
        token: user.token,
        body: { name: 'After' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.name, 'After');
      assert.equal(res.body.id, playlist.id);
      assert.deepEqual(
        res.body.videos.map((v) => v.id),
        [VIDEO_A],
      );
    });

    it('renaming to the same name still succeeds (no row changed on the SQL side)', async () => {
      const user = await registerUser(api, 'frank');
      const playlist = await createPlaylist(api, user.token, 'Same');
      const res = await api.request('PATCH', `/playlists/${playlist.id}`, {
        token: user.token,
        body: { name: 'Same' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.name, 'Same');
    });

    it('name taken by another of their playlists: 409 PLAYLIST_NAME_TAKEN, nothing changes', async () => {
      const user = await registerUser(api, 'gina');
      await createPlaylist(api, user.token, 'Taken');
      const other = await createPlaylist(api, user.token, 'Other');

      const res = await api.request('PATCH', `/playlists/${other.id}`, {
        token: user.token,
        body: { name: 'Taken' },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'PLAYLIST_NAME_TAKEN');
      assert.equal((await Playlist.findByPk(other.id))?.name, 'Other');
    });

    it('invalid name: 400 VALIDATION_ERROR', async () => {
      const playlist = await createPlaylist(api, alice.token, 'To rename');
      const res = await api.request('PATCH', `/playlists/${playlist.id}`, {
        token: alice.token,
        body: { name: '' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    it('malformed or unknown id: 404 PLAYLIST_NOT_FOUND', async () => {
      for (const id of ['abc', UNKNOWN_UUID]) {
        const res = await api.request('PATCH', `/playlists/${id}`, {
          token: alice.token,
          body: { name: 'Whatever' },
        });
        assert.equal(res.status, 404, id);
        assert.equal(res.body.code, 'PLAYLIST_NOT_FOUND', id);
      }
    });
  });

  describe('DELETE /playlists/:id', () => {
    it('deletes: 204, disappears from the list, then 404', async () => {
      const user = await registerUser(api, 'hugo');
      const playlist = await createPlaylist(api, user.token, 'Ephemeral');

      const first = await api.request('DELETE', `/playlists/${playlist.id}`, { token: user.token });
      assert.equal(first.status, 204);
      assert.equal(first.body, null);

      const list = await api.request('GET', '/playlists', { token: user.token });
      assert.deepEqual(list.body.items, []);

      const second = await api.request('DELETE', `/playlists/${playlist.id}`, {
        token: user.token,
      });
      assert.equal(second.status, 404);
      assert.equal(second.body.code, 'PLAYLIST_NOT_FOUND');
    });

    it('cascades to its links but keeps the video snapshot', async () => {
      const user = await registerUser(api, 'iris');
      const playlist = await createPlaylist(api, user.token, 'Cascade');
      await addVideo(api, user.token, playlist.id, VIDEO_A);
      assert.equal(await PlaylistVideo.count({ where: { playlistId: playlist.id } }), 1);

      await api.request('DELETE', `/playlists/${playlist.id}`, { token: user.token });

      assert.equal(await PlaylistVideo.count({ where: { playlistId: playlist.id } }), 0);
      assert.ok(await Video.findByPk(VIDEO_A), 'the snapshot is shared, it must stay');
    });
  });

  describe('POST /playlists/:id/videos', () => {
    it('adds a video: 201 and the full playlist (views as a number)', async () => {
      const user = await registerUser(api, 'jack');
      const playlist = await createPlaylist(api, user.token, 'Additions');

      const res = await api.request<PlaylistDto>('POST', `/playlists/${playlist.id}/videos`, {
        token: user.token,
        body: { videoId: VIDEO_A },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.videos.length, 1);
      const [video] = res.body.videos;
      assert.deepEqual(Object.keys(video!).sort(), [
        'channel',
        'description',
        'id',
        'thumbnailUrl',
        'title',
        'views',
      ]);
      assert.equal(video!.id, VIDEO_A);
      assert.equal(typeof video!.views, 'number'); // BIGINT comes back as a string from MySQL
    });

    it('the most recently added comes first', async () => {
      const user = await registerUser(api, 'kim');
      const playlist = await createPlaylist(api, user.token, 'Order');
      await addVideo(api, user.token, playlist.id, VIDEO_A);
      await sleep(10);
      const res = await addVideo(api, user.token, playlist.id, VIDEO_B);
      assert.deepEqual(
        res.videos.map((v) => v.id),
        [VIDEO_B, VIDEO_A],
      );
    });

    it('duplicate: 409 VIDEO_ALREADY_IN_PLAYLIST, a single link', async () => {
      const user = await registerUser(api, 'lea');
      const playlist = await createPlaylist(api, user.token, 'Duplicates');
      await addVideo(api, user.token, playlist.id, VIDEO_A);

      const res = await api.request('POST', `/playlists/${playlist.id}/videos`, {
        token: user.token,
        body: { videoId: VIDEO_A },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'VIDEO_ALREADY_IN_PLAYLIST');
      assert.equal(await PlaylistVideo.count({ where: { playlistId: playlist.id } }), 1);
    });

    it('unknown video or malformed ID: 404 VIDEO_NOT_FOUND, nothing written', async () => {
      const user = await registerUser(api, 'max');
      const playlist = await createPlaylist(api, user.token, 'Not found');
      const videosBefore = await Video.count();

      for (const videoId of [UNKNOWN_VIDEO, 'abc', 'aaaaaaaaaa!', "x'; DROP TABLE videos;--"]) {
        const res = await api.request('POST', `/playlists/${playlist.id}/videos`, {
          token: user.token,
          body: { videoId },
        });
        assert.equal(res.status, 404, videoId);
        assert.equal(res.body.code, 'VIDEO_NOT_FOUND', videoId);
      }
      assert.equal(await Video.count(), videosBefore);
      assert.equal(await PlaylistVideo.count({ where: { playlistId: playlist.id } }), 0);
    });

    it('missing or non-string videoId: 400 VALIDATION_ERROR', async () => {
      const playlist = await createPlaylist(api, alice.token, 'Invalid body');
      for (const body of [{}, { videoId: 12345 }, { videoId: '' }]) {
        const res = await api.request('POST', `/playlists/${playlist.id}/videos`, {
          token: alice.token,
          body,
        });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.code, 'VALIDATION_ERROR', JSON.stringify(body));
      }
    });

    it('unknown playlist: 404 PLAYLIST_NOT_FOUND', async () => {
      const res = await api.request('POST', `/playlists/${UNKNOWN_UUID}/videos`, {
        token: alice.token,
        body: { videoId: VIDEO_A },
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'PLAYLIST_NOT_FOUND');
    });

    it('the same video in two users' playlists: a single snapshot', async () => {
      const [u1, u2] = await Promise.all([registerUser(api, 'nina'), registerUser(api, 'omar')]);
      const [p1, p2] = await Promise.all([
        createPlaylist(api, u1.token, 'Common'),
        createPlaylist(api, u2.token, 'Common'),
      ]);
      await Promise.all([
        addVideo(api, u1.token, p1.id, VIDEO_B),
        addVideo(api, u2.token, p2.id, VIDEO_B),
      ]);

      assert.equal(await Video.count({ where: { id: VIDEO_B } }), 1);
      assert.equal(
        await PlaylistVideo.count({ where: { videoId: VIDEO_B, playlistId: [p1.id, p2.id] } }),
        2,
      );
    });

    it('simultaneous adds of the same video: only one wins, the others get 409', async () => {
      const user = await registerUser(api, 'paul');
      const playlist = await createPlaylist(api, user.token, 'Race');
      const attempts = await Promise.all(
        [1, 2, 3].map(() =>
          api.request('POST', `/playlists/${playlist.id}/videos`, {
            token: user.token,
            body: { videoId: VIDEO_A },
          }),
        ),
      );
      assert.deepEqual(attempts.map((r) => r.status).sort(), [201, 409, 409]);
      assert.equal(await PlaylistVideo.count({ where: { playlistId: playlist.id } }), 1);
    });
  });

  describe('DELETE /playlists/:id/videos/:videoId', () => {
    it('removes the video: 204, then 404 VIDEO_NOT_FOUND; the snapshot stays', async () => {
      const user = await registerUser(api, 'quentin');
      const playlist = await createPlaylist(api, user.token, 'Removals');
      await addVideo(api, user.token, playlist.id, VIDEO_A);
      await addVideo(api, user.token, playlist.id, VIDEO_B);

      const path = `/playlists/${playlist.id}/videos/${VIDEO_A}`;
      const first = await api.request('DELETE', path, { token: user.token });
      assert.equal(first.status, 204);

      const list = await api.request<{ items: PlaylistDto[] }>('GET', '/playlists', {
        token: user.token,
      });
      assert.deepEqual(
        list.body.items[0]?.videos.map((v) => v.id),
        [VIDEO_B],
      );

      const second = await api.request('DELETE', path, { token: user.token });
      assert.equal(second.status, 404);
      assert.equal(second.body.code, 'VIDEO_NOT_FOUND');
      assert.ok(await Video.findByPk(VIDEO_A));
    });

    it('malformed ID: 404 VIDEO_NOT_FOUND; unknown playlist: 404 PLAYLIST_NOT_FOUND', async () => {
      const playlist = await createPlaylist(api, alice.token, 'Invalid removal');
      const malformed = await api.request('DELETE', `/playlists/${playlist.id}/videos/abc`, {
        token: alice.token,
      });
      assert.equal(malformed.status, 404);
      assert.equal(malformed.body.code, 'VIDEO_NOT_FOUND');

      const unknown = await api.request('DELETE', `/playlists/${UNKNOWN_UUID}/videos/${VIDEO_A}`, {
        token: alice.token,
      });
      assert.equal(unknown.status, 404);
      assert.equal(unknown.body.code, 'PLAYLIST_NOT_FOUND');
    });
  });
});
