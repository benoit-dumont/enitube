import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import HttpError from '../class/HttpError.js';
import { env } from '../config/env.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const reject = (res: Response, errorCode: string, message: string): void => {
  HttpError.handle(new HttpError({ code: 401, errorCode, message }), res, message);
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reject(res, 'UNAUTHORIZED', 'Token manquant');
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) {
      return reject(res, 'UNAUTHORIZED', 'Token invalide');
    }
    req.userId = payload.sub;
    next();
  } catch (error) {
    // TOKEN_EXPIRED déclenche le refresh côté front ; tout le reste est une erreur franche
    if (error instanceof jwt.TokenExpiredError) {
      return reject(res, 'TOKEN_EXPIRED', 'Access token expiré');
    }
    return reject(res, 'UNAUTHORIZED', 'Token invalide');
  }
};
