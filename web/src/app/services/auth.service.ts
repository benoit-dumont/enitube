import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { API_URL } from '../config';
import type {
  AuthResponse,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  User,
} from '@enitube/shared';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(this.storage.getToken());
  private readonly _user = signal<User | null>(null);

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  /** Basé sur le token : vrai dès le démarrage si une session existe, avant /auth/me. */
  readonly isAuthenticated = computed(() => this._token() !== null);

  register(body: RegisterRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, body).pipe(
      tap((res) => this.setSession(res)),
      map((res) => res.user),
    );
  }

  login(body: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, body).pipe(
      tap((res) => this.setSession(res)),
      map((res) => res.user),
    );
  }

  /** Déconnexion volontaire : vide l'état puis renvoie vers /auth. */
  logout(): void {
    this.clearSession();
    void this.router.navigateByUrl('/auth');
  }

  /**
   * Appelée au démarrage (provideAppInitializer) : recharge l'utilisateur depuis le token
   * conservé en sessionStorage, pour que F5 garde la session. Si le token est refusé,
   * l'intercepteur a déjà purgé la session.
   */
  restoreSession(): Promise<void> {
    if (!this._token()) return Promise.resolve();
    return firstValueFrom(
      this.http.get<MeResponse>(`${API_URL}/auth/me`).pipe(
        tap((res) => this._user.set(res.user)),
        map(() => undefined),
        catchError(() => of(undefined)),
      ),
    );
  }

  /** Purge sans navigation (utilisée par l'intercepteur, qui redirige lui-même). */
  clearSession(): void {
    this.storage.clearToken();
    this._token.set(null);
    this._user.set(null);
  }

  private setSession({ accessToken, user }: AuthResponse): void {
    this.storage.setToken(accessToken);
    this._token.set(accessToken);
    this._user.set(user);
  }
}
