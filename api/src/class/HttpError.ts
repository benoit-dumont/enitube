import type { Response } from 'express';
import Logger from '../lib/Logger/index.js';

export interface HttpErrorSettings {
  /** Statut HTTP à renvoyer (400, 401, 409…) */
  code: number;
  message: string;
  /** Code métier traduit par le front via errors.<CODE> (ex : EMAIL_TAKEN) */
  errorCode?: string;
}

/**
 * Erreur HTTP typée, utilisée pour décrire une réponse HTTP à retourner
 * depuis les couches service/controller jusqu'au middleware d'erreurs.
 */
export class HttpError extends Error {
  public readonly code: number;
  public readonly errorCode?: string;

  constructor({ code, message, errorCode }: HttpErrorSettings) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.errorCode = errorCode;
  }

  /** Corps JSON : { code, message } si `errorCode` est défini, sinon l'ancien { error }. */
  public toBody() {
    return this.errorCode
      ? { code: this.errorCode, message: this.message }
      : { error: this.message };
  }

  public static handle(error: unknown, res: Response, fallbackMessage: string) {
    if (error instanceof HttpError) {
      return res.status(error.code).json(error.toBody());
    }
    Logger.error(error);
    return res.status(500).json({ error: fallbackMessage });
  }
}

export default HttpError;
