import { randomUUID } from 'node:crypto';
import { ForeignKeyConstraintError, UniqueConstraintError } from '@sequelize/core';
import type { Playlist as SharedPlaylist, PlaylistListResponse } from '@enitube/shared';
import HttpError from '../class/HttpError.js';
import { videoProvider } from '../providers/video/index.js';
import type { Playlist } from '../models/index.js';
import { parseBody } from '../schemas/auth.js';
import {
  addVideoSchema,
  createPlaylistSchema,
  renamePlaylistSchema,
} from '../schemas/playlists.js';
import { VIDEO_ID_REGEX } from '../schemas/videos.js';
import playlistService from '../services/playlist.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const playlistNotFound = () =>
  new HttpError({ code: 404, errorCode: 'PLAYLIST_NOT_FOUND', message: 'Playlist not found' });

const videoNotFound = () =>
  new HttpError({ code: 404, errorCode: 'VIDEO_NOT_FOUND', message: 'Video not found' });

const nameTaken = () =>
  new HttpError({
    code: 409,
    errorCode: 'PLAYLIST_NAME_TAKEN',
    message: 'You already have a playlist with this name',
  });

/** Un id mal formé ne peut pas exister : 404 sans interroger la base. */
const assertPlaylistId = (id: string): void => {
  if (!UUID_REGEX.test(id)) throw playlistNotFound();
};

const toPublicPlaylist = (playlist: Playlist): SharedPlaylist => ({
  id: playlist.id,
  name: playlist.name,
  createdAt: playlist.createdAt.toISOString(),
  // Les plus récemment ajoutées d'abord ; `toSorted` ne modifie pas le tableau d'origine.
  videos: (playlist.entries ?? [])
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .flatMap((entry) =>
      entry.video
        ? [
            {
              id: entry.video.id,
              title: entry.video.title,
              channel: entry.video.channel,
              // BIGINT revient en string depuis MySQL.
              views: Number(entry.video.views),
              description: entry.video.description,
              thumbnailUrl: entry.video.thumbnailUrl,
            },
          ]
        : [],
    ),
});

/** Recharge une playlist du propriétaire ; 404 si elle a disparu entre-temps. */
const loadOwned = async (id: string, userId: string): Promise<SharedPlaylist> => {
  const playlist = await playlistService.findOwned(id, userId);
  if (!playlist) throw playlistNotFound();
  return toPublicPlaylist(playlist);
};

export const listPlaylists = async (userId: string): Promise<PlaylistListResponse> => {
  const playlists = await playlistService.listByUser(userId);
  return { items: playlists.map(toPublicPlaylist) };
};

export const createPlaylist = async (userId: string, body: unknown): Promise<SharedPlaylist> => {
  const { name } = parseBody(createPlaylistSchema, body);

  try {
    const playlist = await playlistService.createOne({ id: randomUUID(), userId, name });
    return toPublicPlaylist(playlist);
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw nameTaken();
    throw error;
  }
};

export const renamePlaylist = async (
  userId: string,
  id: string,
  body: unknown,
): Promise<SharedPlaylist> => {
  assertPlaylistId(id);
  const { name } = parseBody(renamePlaylistSchema, body);

  try {
    // `affected` vaut 0 si la playlist n'est pas à l'utilisateur… mais aussi si le nom est
    // inchangé : on départage avec le rechargement ci-dessous.
    await playlistService.rename(id, userId, name);
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw nameTaken();
    throw error;
  }
  return loadOwned(id, userId);
};

export const deletePlaylist = async (userId: string, id: string): Promise<void> => {
  assertPlaylistId(id);
  if (!(await playlistService.remove(id, userId))) throw playlistNotFound();
};

export const addVideoToPlaylist = async (
  userId: string,
  id: string,
  body: unknown,
): Promise<SharedPlaylist> => {
  assertPlaylistId(id);
  const { videoId } = parseBody(addVideoSchema, body);

  // Propriété vérifiée avant tout appel au fournisseur (qui peut consommer du quota YouTube).
  if (!(await playlistService.isOwned(id, userId))) throw playlistNotFound();

  if (!VIDEO_ID_REGEX.test(videoId)) throw videoNotFound();
  const video = await videoProvider.getById(videoId);
  if (!video) throw videoNotFound();

  try {
    await playlistService.addVideo(id, video);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new HttpError({
        code: 409,
        errorCode: 'VIDEO_ALREADY_IN_PLAYLIST',
        message: 'This video is already in the playlist',
      });
    }
    // Playlist supprimée entre le contrôle de propriété et l'insertion.
    if (error instanceof ForeignKeyConstraintError) throw playlistNotFound();
    throw error;
  }
  return loadOwned(id, userId);
};

export const removeVideoFromPlaylist = async (
  userId: string,
  id: string,
  videoId: string,
): Promise<void> => {
  assertPlaylistId(id);
  if (!(await playlistService.isOwned(id, userId))) throw playlistNotFound();

  if (!VIDEO_ID_REGEX.test(videoId)) throw videoNotFound();
  if (!(await playlistService.removeVideo(id, videoId))) throw videoNotFound();
};
