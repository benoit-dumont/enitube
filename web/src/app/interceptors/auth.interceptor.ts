import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../config';
import type { ApiError } from '@enitube/shared';
import { AuthService } from '../services/auth.service';

/** Sur ces routes, un 401 est une erreur métier (mauvais mot de passe), pas une session expirée. */
const PUBLIC_AUTH_ROUTES = [`${API_URL}/auth/login`, `${API_URL}/auth/register`];

/** Pas de refresh token (hors périmètre) : un token expiré ou refusé termine la session. */
const SESSION_ENDING_CODES = ['TOKEN_EXPIRED', 'UNAUTHORIZED'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Le token ne part que vers notre API, jamais vers un tiers.
  if (!req.url.startsWith(API_URL)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !PUBLIC_AUTH_ROUTES.includes(req.url) &&
        SESSION_ENDING_CODES.includes((error.error as Partial<ApiError> | null)?.code ?? '')
      ) {
        auth.clearSession();
        void router.navigateByUrl('/auth');
      }
      return throwError(() => error);
    }),
  );
};
