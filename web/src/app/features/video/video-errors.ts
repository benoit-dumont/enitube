import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '@enitube/shared';

export type VideoFailure = { status: 'not-found' } | { status: 'error'; message: string };

/**
 * Traduit une erreur HTTP de /videos/:id en état affichable.
 * On mappe sur `code` (jamais sur `message`). Le 401 est géré par l'intercepteur (retour à /auth).
 */
export function mapVideoError(error: unknown): VideoFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 'error', message: 'Une erreur inattendue est survenue.' };
  }
  if (error.status === 0) {
    return {
      status: 'error',
      message: 'Impossible de joindre le serveur. Vérifiez votre connexion.',
    };
  }

  const code = (error.error as Partial<ApiError> | null)?.code;
  if (code === 'VIDEO_NOT_FOUND') return { status: 'not-found' };

  return {
    status: 'error',
    message:
      error.status >= 500
        ? 'Erreur du serveur. Réessayez dans un instant.'
        : 'Une erreur inattendue est survenue.',
  };
}
