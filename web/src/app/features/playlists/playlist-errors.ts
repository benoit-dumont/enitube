import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '@enitube/shared';

/**
 * Traduit une erreur HTTP de /playlists/* en message affichable.
 * On mappe sur `code` (jamais sur `message`). Le 401 est géré par l'intercepteur (retour à /auth).
 */
export function mapPlaylistError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Une erreur inattendue est survenue.';
  if (error.status === 0) return 'Impossible de joindre le serveur. Vérifiez votre connexion.';

  const code = (error.error as Partial<ApiError> | null)?.code;
  switch (code) {
    case 'PLAYLIST_NAME_TAKEN':
      return 'Vous avez déjà une playlist avec ce nom.';
    case 'PLAYLIST_NOT_FOUND':
      return "Cette playlist n'existe plus. Rechargez la page.";
    case 'VIDEO_NOT_FOUND':
      return "Cette vidéo n'est plus dans la playlist.";
    case 'VALIDATION_ERROR':
      return 'Le nom doit contenir entre 1 et 100 caractères.';
    default:
      return error.status >= 500
        ? 'Erreur du serveur. Réessayez dans un instant.'
        : 'Une erreur inattendue est survenue.';
  }
}
