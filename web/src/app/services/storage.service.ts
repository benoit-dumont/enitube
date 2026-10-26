import { Injectable } from '@angular/core';

const TOKEN_KEY = 'enitub.token';

/** Wrapper sessionStorage : ne jette jamais (mode privé, quota). */
@Injectable({ providedIn: 'root' })
export class StorageService {
  getToken(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* stockage indisponible : la session ne survivra pas au F5 */
    }
  }

  clearToken(): void {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* rien à nettoyer */
    }
  }
}
