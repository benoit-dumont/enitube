import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '@enitube/shared';

/** Champ du formulaire auquel rattacher l'erreur ; sans champ, l'erreur est globale. */
export type AuthField = 'email' | 'password';

export interface AuthErrorView {
  field?: AuthField;
  message: string;
}

/**
 * Traduit une erreur HTTP de /auth/* en message affichable.
 * On mappe sur `code` (jamais sur `message`, réservé aux logs côté API).
 */
export function mapAuthError(error: unknown): AuthErrorView {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: 'Une erreur inattendue est survenue.' };
  }
  if (error.status === 0) {
    return { message: 'Impossible de joindre le serveur. Vérifiez votre connexion.' };
  }

  const code = (error.error as Partial<ApiError> | null)?.code;
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return { message: 'Email ou mot de passe incorrect.' };
    case 'EMAIL_TAKEN':
      return { field: 'email', message: 'Cette adresse email est déjà utilisée.' };
    case 'WEAK_PASSWORD':
      return {
        field: 'password',
        message: 'Mot de passe invalide (10 caractères minimum, 72 octets maximum).',
      };
    case 'VALIDATION_ERROR':
      return { message: 'Certains champs sont invalides. Vérifiez votre saisie.' };
    default:
      return error.status >= 500
        ? { message: 'Erreur du serveur. Réessayez dans un instant.' }
        : { message: 'Une erreur inattendue est survenue.' };
  }
}
