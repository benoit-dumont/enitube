import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '@enitube/shared';
import { mapPlaylistError } from '../playlist-errors';

/**
 * Traduit une erreur de POST /playlists/:id/videos en message affichable.
 * On mappe sur `code` (jamais sur `message`). Les autres cas retombent sur `mapPlaylistError`.
 */
export function mapAddVideoError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const code = (error.error as Partial<ApiError> | null)?.code;
    if (code === 'VIDEO_ALREADY_IN_PLAYLIST') return 'Cette vidéo est déjà dans cette playlist.';
    if (code === 'VIDEO_NOT_FOUND') return "Cette vidéo est introuvable ou n'est plus disponible.";
  }
  return mapPlaylistError(error);
}

/** Vrai si l'erreur est un doublon (la liste affichée est alors périmée et doit être corrigée). */
export function isAlreadyInPlaylist(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.error as Partial<ApiError> | null)?.code === 'VIDEO_ALREADY_IN_PLAYLIST'
  );
}
