import HttpError from '../class/HttpError.js';
import { videoProvider } from '../providers/video/index.js';
import { parseBody } from '../schemas/auth.js';
import { searchQuerySchema, VIDEO_ID_REGEX } from '../schemas/videos.js';

const videoNotFound = () =>
  new HttpError({ code: 404, errorCode: 'VIDEO_NOT_FOUND', message: 'Video not found' });

export const searchVideos = async (query: unknown) => {
  const { q, pageToken } = parseBody(searchQuerySchema, query);
  return videoProvider.search(q, pageToken);
};

export const getVideo = async (id: string) => {
  // Un ID mal formé ne peut pas exister : 404 sans interroger le fournisseur.
  if (!VIDEO_ID_REGEX.test(id)) throw videoNotFound();

  const video = await videoProvider.getById(id);
  if (!video) throw videoNotFound();
  return video;
};
