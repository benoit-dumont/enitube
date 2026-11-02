import { z } from 'zod';
import type { Video, VideoSearchResponse } from '@enitube/shared';
import { VIDEO_ID_REGEX } from '../../schemas/videos.js';
import catalogData from './catalog.json' with { type: 'json' };
import type { VideoProvider } from './video.provider.js';

export const PAGE_SIZE = 12;

// Le JSON est validé au chargement : un ID mal formé fait échouer le démarrage plutôt qu'un embed.
const catalogSchema = z.array(
  z.object({
    id: z.string().regex(VIDEO_ID_REGEX),
    title: z.string().min(1),
    channel: z.string().min(1),
    views: z.number().int().nonnegative(),
    description: z.string(),
  }),
);

const thumbnailUrl = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Minuscules et sans accents : « Création » doit matcher « creation ». */
const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

interface CatalogEntry {
  video: Video;
  haystack: string;
}

export class CatalogProvider implements VideoProvider {
  private readonly entries: CatalogEntry[];

  constructor(raw: unknown = catalogData) {
    this.entries = catalogSchema.parse(raw).map((item) => ({
      video: { ...item, thumbnailUrl: thumbnailUrl(item.id) },
      haystack: normalize(`${item.title} ${item.channel} ${item.description}`),
    }));
  }

  async search(q: string, pageToken?: string): Promise<VideoSearchResponse> {
    // Tous les mots saisis doivent apparaître (titre, chaîne ou description).
    const terms = normalize(q).split(/\s+/).filter(Boolean);
    const matches = this.entries.filter(({ haystack }) =>
      terms.every((term) => haystack.includes(term)),
    );

    // Le pageToken du catalogue est simplement l'offset de la page suivante.
    const offset = pageToken ? Number(pageToken) : 0;
    const items = matches.slice(offset, offset + PAGE_SIZE).map(({ video }) => video);
    const next = offset + PAGE_SIZE;

    return next < matches.length ? { items, nextPageToken: String(next) } : { items };
  }

  async getById(id: string): Promise<Video | null> {
    return this.entries.find(({ video }) => video.id === id)?.video ?? null;
  }
}
