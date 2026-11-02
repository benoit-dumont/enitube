import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { Playlist, PlaylistVideo, User } from '../src/models/index.js';
import { videoProvider } from '../src/providers/video/index.js';
import {
  UNKNOWN_UUID,
  VIDEO_A,
  VIDEO_B,
  addVideo,
  createPlaylist,
  registerUser,
  startTestApi,
  type ApiResponse,
  type TestApi,
  type TestUser,
} from './helpers.js';

/**
 * Isolation between users. Rule: the owner comes from the JWT, never from the client, and
 * someone else's playlist is indistinguishable from a missing one (404, same body).
 */
describe('playlist ownership', () => {
  let api: TestApi;
  let alice: TestUser;
  let bob: TestUser;
  let playlistId: string; // belongs to Alice, contains VIDEO_A

  before(async () => {
    api = await startTestApi();
    [alice, bob] = await Promise.all([registerUser(api, 'alice'), registerUser(api, 'bob')]);
    const playlist = await createPlaylist(api, alice.token, 'Private');
    playlistId = playlist.id;
    await addVideo(api, alice.token, playlistId, VIDEO_A);
  });
  after(() => api.close());

  /** The 4 possible writes on a playlist, attempted by Bob on a given id. */
  const attemptsBy = (token: string, id: string): Record<string, () => Promise<ApiResponse>> => ({
    rename: () => api.request('PATCH', `/playlists/${id}`, { token, body: { name: 'Hijacked' } }),
    delete: () => api.request('DELETE', `/playlists/${id}`, { token }),
    'add a video': () =>
      api.request('POST', `/playlists/${id}/videos`, { token, body: { videoId: VIDEO_B } }),
    'remove a video': () =>
      api.request('DELETE', `/playlists/${id}/videos/${VIDEO_A}`, { token }),
  });

  it('Bob can neither rename, delete nor modify Alice's playlist: 404 PLAYLIST_NOT_FOUND', async () => {
    for (const [label, attempt] of Object.entries(attemptsBy(bob.token, playlistId))) {
      const res = await attempt();
      assert.equal(res.status, 404, label);
      assert.equal(res.body.code, 'PLAYLIST_NOT_FOUND', label);
    }
  });

  it('...and Alice's playlist is strictly untouched', async () => {
    for (const attempt of Object.values(attemptsBy(bob.token, playlistId))) await attempt();

    const playlist = await Playlist.findByPk(playlistId);
    assert.equal(playlist?.name, 'Private');
    assert.equal(playlist?.userId, alice.id);
    const links = await PlaylistVideo.findAll({ where: { playlistId } });
    assert.deepEqual(
      links.map((l) => l.videoId),
      [VIDEO_A],
    );
  });

  it('someone else's playlist is indistinguishable from a missing one (same response)', async () => {
    const foreign = attemptsBy(bob.token, playlistId);
    const missing = attemptsBy(bob.token, UNKNOWN_UUID);
    for (const label of Object.keys(foreign)) {
      assert.deepEqual(await foreign[label]!(), await missing[label]!(), label);
    }
  });

  it('lists are isolated', async () => {
    const asBob = await api.request('GET', '/playlists', { token: bob.token });
    assert.deepEqual(asBob.body, { items: [] });

    const asAlice = await api.request('GET', '/playlists', { token: alice.token });
    assert.deepEqual(
      asAlice.body.items.map((p: { id: string }) => p.id),
      [playlistId],
    );
  });

  it('a client-supplied userId (body or query) is ignored', async () => {
    const created = await api.request('POST', '/playlists', {
      token: bob.token,
      body: { name: 'Mine', userId: alice.id, user_id: alice.id },
    });
    assert.equal(created.status, 201);
    assert.equal((await Playlist.findByPk(created.body.id))?.userId, bob.id);

    const list = await api.request('GET', `/playlists?userId=${alice.id}`, { token: bob.token });
    assert.deepEqual(
      list.body.items.map((p: { name: string }) => p.name),
      ['Mine'],
    );
  });

  it('ownership is checked before calling the video provider (YouTube quota)', async () => {
    const getById = mock.method(videoProvider, 'getById');
    try {
      const res = await api.request('POST', `/playlists/${playlistId}/videos`, {
        token: bob.token,
        body: { videoId: VIDEO_B },
      });
      assert.equal(res.status, 404);
      assert.equal(
        getById.mock.callCount(),
        0,
        'no provider call for a foreign playlist',
      );

      // control: the owner does trigger the call
      await api.request('POST', `/playlists/${playlistId}/videos`, {
        token: alice.token,
        body: { videoId: VIDEO_B },
      });
      assert.equal(getById.mock.callCount(), 1);
    } finally {
      getById.mock.restore();
    }
  });

  it('booby-trapped ids are rejected with 404 without touching the data', async () => {
    const tables = async () => [
      await User.count(),
      await Playlist.count(),
      await PlaylistVideo.count(),
    ];
    const before = await tables();

    for (const id of [
      "1' OR '1'='1",
      '%27%20OR%201%3D1--',
      '..%2F..%2Fetc',
      `${playlistId}'`,
      '*',
    ]) {
      for (const method of ['PATCH', 'DELETE']) {
        const res = await api.request(method, `/playlists/${id}`, {
          token: bob.token,
          body: method === 'PATCH' ? { name: 'x' } : undefined,
        });
        assert.equal(res.status, 404, `${method} ${id}`);
        assert.equal(res.body.code, 'PLAYLIST_NOT_FOUND', `${method} ${id}`);
      }
    }
    assert.deepEqual(await tables(), before);
  });

  it('deleting one's own account cascades to their playlists, not to others'', async () => {
    const carol = await registerUser(api, 'carol');
    const hers = await createPlaylist(api, carol.token, 'Hers');
    await addVideo(api, carol.token, hers.id, VIDEO_A);

    await User.destroy({ where: { id: carol.id } });

    assert.equal(await Playlist.count({ where: { id: hers.id } }), 0);
    assert.equal(await PlaylistVideo.count({ where: { playlistId: hers.id } }), 0);
    assert.ok(await Playlist.findByPk(playlistId), 'Alice\'s playlist must survive');
  });
});
