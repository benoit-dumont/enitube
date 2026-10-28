import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '@enitube/shared';

/**
 * Traduit une erreur HTTP de /videos/search en message affichable.
 * On mappe sur `code` (jamais sur `message`). Le 401 est géré par l'intercepteur (retour à /auth).
 */
export function mapSearchError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Une erreur inattendue est survenue.';
  if (error.status === 0) return 'Impossible de joindre le serveur. Vérifiez votre connexion.';

  const code = (error.error as Partial<ApiError> | null)?.code;
  if (code === 'VALIDATION_ERROR') return 'Cette recherche est invalide. Modifiez-la et réessayez.';
  return error.status >= 500
    ? 'Erreur du serveur. Réessayez dans un instant.'
    : 'Une erreur inattendue est survenue.';
}
