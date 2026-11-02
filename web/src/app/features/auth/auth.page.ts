import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthErrorView, mapAuthError } from './auth-errors';
import { maxBytes, notBlank } from './auth-validators';

type Mode = 'login' | 'register';
type FieldName = 'username' | 'email' | 'password';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div class="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 class="mb-1 text-2xl font-bold text-red-600">ENITube</h1>
        <h2 class="mb-6 text-sm text-slate-600">
          @if (mode() === 'login') {
            Connectez-vous pour accéder à vos playlists.
          } @else {
            Créez un compte pour commencer.
          }
        </h2>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="flex flex-col gap-4">
          @if (mode() === 'register') {
            <div class="flex flex-col gap-1">
              <label for="username" class="text-sm font-medium">Nom d'utilisateur</label>
              <input
                id="username"
                type="text"
                formControlName="username"
                autocomplete="username"
                [attr.aria-invalid]="errorFor('username') ? 'true' : null"
                [attr.aria-describedby]="errorFor('username') ? 'username-error' : null"
                class="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-red-600"
              />
              @if (errorFor('username'); as msg) {
                <p id="username-error" role="alert" class="text-xs text-red-600">{{ msg }}</p>
              }
            </div>
          }

          <div class="flex flex-col gap-1">
            <label for="email" class="text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              [attr.aria-invalid]="errorFor('email') ? 'true' : null"
              [attr.aria-describedby]="errorFor('email') ? 'email-error' : null"
              class="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-red-600"
            />
            @if (errorFor('email'); as msg) {
              <p id="email-error" role="alert" class="text-xs text-red-600">{{ msg }}</p>
            }
          </div>

          <div class="flex flex-col gap-1">
            <label for="password" class="text-sm font-medium">Mot de passe</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
              [attr.aria-invalid]="errorFor('password') ? 'true' : null"
              [attr.aria-describedby]="errorFor('password') ? 'password-error' : null"
              class="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-red-600"
            />
            @if (errorFor('password'); as msg) {
              <p id="password-error" role="alert" class="text-xs text-red-600">{{ msg }}</p>
            }
          </div>

          @if (formError(); as msg) {
            <p role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ msg }}
            </p>
          }

          <button
            type="submit"
            [disabled]="submitting()"
            class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            @if (submitting()) {
              Chargement…
            } @else if (mode() === 'login') {
              Se connecter
            } @else {
              Créer mon compte
            }
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-600">
          @if (mode() === 'login') {
            Pas encore de compte ?
            <button
              type="button"
              class="font-medium text-red-600 hover:underline"
              (click)="setMode('register')"
            >
              S'inscrire
            </button>
          } @else {
            Déjà un compte ?
            <button
              type="button"
              class="font-medium text-red-600 hover:underline"
              (click)="setMode('login')"
            >
              Se connecter
            </button>
          }
        </p>
      </div>
    </main>
  `,
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<Mode>('login');
  protected readonly submitting = signal(false);
  /** Erreur rattachée à un champ, venant du serveur (EMAIL_TAKEN, WEAK_PASSWORD). */
  private readonly serverFieldError = signal<{ field: FieldName; message: string } | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.minLength(3), Validators.maxLength(30)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(255)],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.applyMode('login');
    // Dès que l'utilisateur corrige sa saisie, on efface les erreurs venant du serveur.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.clearServerErrors());
  }

  protected setMode(mode: Mode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.applyMode(mode);
    this.clearServerErrors();
    this.form.markAsUntouched();
  }

  protected submit(): void {
    this.clearServerErrors();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const { username, email, password } = this.form.getRawValue();
    const request$ =
      this.mode() === 'login'
        ? this.auth.login({ email, password })
        : this.auth.register({ username: username.trim(), email, password });

    this.submitting.set(true);
    request$.subscribe({
      next: () => void this.router.navigateByUrl('/search'),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.showServerError(mapAuthError(error));
      },
    });
  }

  /** Message à afficher sous un champ : l'erreur serveur prime, sinon la validation locale. */
  protected errorFor(name: FieldName): string | null {
    const server = this.serverFieldError();
    if (server?.field === name) return server.message;

    const control = this.form.controls[name];
    if (!control.touched || !control.errors) return null;

    if (control.errors['required']) {
      return name === 'password' ? 'Le mot de passe est requis.' : 'Ce champ est requis.';
    }
    if (control.errors['email']) return 'Adresse email invalide.';
    if (control.errors['minlength']) {
      return name === 'password'
        ? 'Mot de passe trop court (10 caractères minimum).'
        : 'Nom trop court (3 caractères minimum).';
    }
    if (control.errors['maxlength']) return 'Valeur trop longue.';
    if (control.errors['maxbytes']) return 'Mot de passe trop long (72 octets maximum).';
    return 'Valeur invalide.';
  }

  /**
   * Login : le mot de passe est seulement requis (l'API ne révèle rien sur la politique).
   * Register : politique complète, identique à l'API (10 car. min, 72 octets max).
   */
  private applyMode(mode: Mode): void {
    const { username, password } = this.form.controls;
    if (mode === 'register') {
      username.enable({ emitEvent: false });
      password.setValidators([Validators.required, Validators.minLength(10), maxBytes(72)]);
    } else {
      username.disable({ emitEvent: false });
      password.setValidators([Validators.required]);
    }
    password.updateValueAndValidity({ emitEvent: false });
  }

  private showServerError({ field, message }: AuthErrorView): void {
    if (field) {
      this.serverFieldError.set({ field, message });
    } else {
      this.formError.set(message);
    }
  }

  private clearServerErrors(): void {
    this.serverFieldError.set(null);
    this.formError.set(null);
  }
}
