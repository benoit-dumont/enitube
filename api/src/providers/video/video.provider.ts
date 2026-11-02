import type { Video, VideoSearchResponse } from '@enitube/shared';

/**
 * Contrat commun à toutes les sources de vidéos (catalogue local, YouTube…).
 * Le reste de l'API ne dépend que de cette interface, jamais d'un fournisseur précis.
 */
export interface VideoProvider {
  /** Recherche paginée ; `pageToken` est opaque pour l'appelant (celui renvoyé par la page précédente). */
  search(q: string, pageToken?: string): Promise<VideoSearchResponse>;
  /** `null` si la vidéo n'existe pas chez ce fournisseur. */
  getById(id: string): Promise<Video | null>;
}
