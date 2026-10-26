export interface HttpErrorSettings {
  code: number;
  message: string;
}

/**
 * Erreur HTTP typée, utilisée pour décrire une réponse HTTP à retourner
 * depuis les couches service/controller jusqu'au middleware d'erreurs.
 */
export class HttpError extends Error {
  public readonly code: number;

  constructor({ code, message }: HttpErrorSettings) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
  }
}

export default HttpError;
