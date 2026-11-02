import { env } from '../../config/env.js';
import { CatalogProvider } from './catalog.provider.js';
import type { VideoProvider } from './video.provider.js';

const createVideoProvider = (): VideoProvider => {
  switch (env.VIDEO_PROVIDER) {
    case 'catalog':
      return new CatalogProvider();
    case 'youtube':
      // Branche optionnelle `feat/api-videos-youtube` : le provider n'existe pas encore.
      throw new Error(
        "VIDEO_PROVIDER=youtube n'est pas encore implémenté (feat/api-videos-youtube)",
      );
  }
};

export const videoProvider: VideoProvider = createVideoProvider();
export type { VideoProvider } from './video.provider.js';
