import {
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  Component,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { Playlist } from '@enitube/shared';
import type { LoadState } from '../../models/load-state';
import { PlaylistService } from '../../services/playlist.service';
import { mapPlaylistError } from './playlist-errors';

const byName = (a: Playlist, b: Playlist) => a.name.localeCompare(b.name, 'fr');

/** Tri sur copie (la cible ES2022 n'a pas `toSorted`) : le tableau d'origine n'est pas modifié. */
const sortedByName = (items: Playlist[]): Playlist[] => [...items].sort(byName);

const BTN =
  'rounded-md px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60';

@Component({
  selector: 'app-playlists-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-xl font-semibold">Mes playlists</h1>

    <form class="mb-2 flex max-w-2xl gap-2" (submit)="create(newBox.value, $event, newBox)">
      <label for="new-playlist" class="sr-only">Nom de la nouvelle playlist</label>
      <input
        #newBox
        id="new-playlist"
        type="text"
        maxlength="100"
        placeholder="Nouvelle playlist…"
        autocomplete="off"
        [attr.aria-invalid]="createError() ? 'true' : null"
        [attr.aria-describedby]="createError() ? 'new-playlist-error' : null"
        class="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-red-600"
      />
      <button
        type="submit"
        [disabled]="creating()"
        class="bg-red-600 text-white hover:bg-red-700 ${BTN}"
      >
        {{ creating() ? 'Création…' : 'Créer' }}
      </button>
    </form>
    @if (createError(); as msg) {
      <p id="new-playlist-error" role="alert" class="mb-2 text-sm text-red-700">{{ msg }}</p>
    }

    @if (actionError(); as msg) {
      <div
        role="alert"
        class="my-4 flex max-w-2xl items-start justify-between gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        <p>{{ msg }}</p>
        <button
          type="button"
          class="font-semibold underline focus-visible:outline-2 focus-visible:outline-red-600"
          (click)="actionError.set(null)"
        >
          Fermer
        </button>
      </div>
    }

    <div class="mt-6">
      @if (state(); as s) {
        @if (s.status === 'idle' || s.status === 'loading') {
          <p role="status" class="text-sm text-slate-600">Chargement de vos playlists…</p>
        } @else if (s.status === 'error') {
          <div role="alert" class="max-w-2xl rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{{ s.message }}</p>
            <button
              type="button"
              class="mt-2 font-semibold underline focus-visible:outline-2 focus-visible:outline-red-600"
              (click)="load()"
            >
              Réessayer
            </button>
          </div>
        } @else if (s.data.length === 0) {
          <p role="status" class="text-sm text-slate-600">
            Vous n'avez pas encore de playlist. Créez-en une ci-dessus, puis ajoutez-y des vidéos
            depuis la <a routerLink="/search" class="font-semibold underline">recherche</a>.
          </p>
        } @else {
          <ul class="flex flex-col gap-6">
            @for (playlist of s.data; track playlist.id) {
              <li class="rounded-lg border border-slate-200 bg-white shadow-sm">
                <header class="flex flex-wrap items-center justify-between gap-3 p-4">
                  @if (editingId() === playlist.id) {
                    <form
                      class="flex min-w-0 flex-1 gap-2"
                      (submit)="rename(playlist, editBox.value, $event)"
                      (keydown.escape)="cancelRename()"
                    >
                      <label [for]="'rename-' + playlist.id" class="sr-only">
                        Nouveau nom de la playlist
                      </label>
                      <input
                        #editBox
                        #renameBox
                        [id]="'rename-' + playlist.id"
                        type="text"
                        maxlength="100"
                        autocomplete="off"
                        [value]="playlist.name"
                        [attr.aria-invalid]="renameError() ? 'true' : null"
                        class="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-red-600"
                      />
                      <button
                        type="submit"
                        [disabled]="pendingId() === playlist.id"
                        class="bg-red-600 text-white hover:bg-red-700 ${BTN}"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        class="border border-slate-300 hover:bg-slate-100 ${BTN}"
                        (click)="cancelRename()"
                      >
                        Annuler
                      </button>
                    </form>
                  } @else {
                    <div class="min-w-0">
                      <h2 class="truncate text-lg font-semibold">{{ playlist.name }}</h2>
                      <p class="text-xs text-slate-600">
                        {{ playlist.videos.length }} vidéo{{
                          playlist.videos.length > 1 ? 's' : ''
                        }}
                      </p>
                    </div>

                    @if (confirmingId() === playlist.id) {
                      <div
                        role="group"
                        [attr.aria-label]="'Confirmer la suppression de ' + playlist.name"
                        class="flex items-center gap-2"
                      >
                        <span class="text-sm text-slate-700">Supprimer cette playlist ?</span>
                        <button
                          type="button"
                          [disabled]="pendingId() === playlist.id"
                          class="bg-red-600 text-white hover:bg-red-700 ${BTN}"
                          (click)="remove(playlist)"
                        >
                          Supprimer
                        </button>
                        <button
                          type="button"
                          class="border border-slate-300 hover:bg-slate-100 ${BTN}"
                          (click)="confirmingId.set(null)"
                        >
                          Annuler
                        </button>
                      </div>
                    } @else {
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="border border-slate-300 hover:bg-slate-100 ${BTN}"
                          (click)="startRename(playlist.id)"
                        >
                          Renommer<span class="sr-only"> {{ playlist.name }}</span>
                        </button>
                        <button
                          type="button"
                          class="border border-red-300 text-red-700 hover:bg-red-50 ${BTN}"
                          (click)="startDelete(playlist.id)"
                        >
                          Supprimer<span class="sr-only"> {{ playlist.name }}</span>
                        </button>
                      </div>
                    }
                  }
                </header>
                @if (editingId() === playlist.id && renameError(); as msg) {
                  <p role="alert" class="px-4 pb-3 text-sm text-red-700">{{ msg }}</p>
                }

                @if (playlist.videos.length === 0) {
                  <p class="border-t border-slate-200 p-4 text-sm text-slate-600">
                    Cette playlist est vide.
                  </p>
                } @else {
                  <ul class="divide-y divide-slate-200 border-t border-slate-200">
                    @for (video of playlist.videos; track video.id) {
                      <li class="flex items-center gap-3 p-3">
                        <img
                          [src]="video.thumbnailUrl"
                          alt=""
                          loading="lazy"
                          class="aspect-video w-28 shrink-0 rounded bg-slate-200 object-cover"
                        />
                        <div class="min-w-0 flex-1">
                          <p class="line-clamp-2 text-sm font-semibold text-slate-900">
                            {{ video.title }}
                          </p>
                          <p class="truncate text-xs text-slate-600">{{ video.channel }}</p>
                        </div>
                        <a
                          [routerLink]="['/video', video.id]"
                          class="bg-red-600 text-white hover:bg-red-700 ${BTN}"
                        >
                          Lancer<span class="sr-only"> {{ video.title }}</span>
                        </a>
                        <button
                          type="button"
                          [disabled]="pendingId() === playlist.id"
                          class="border border-slate-300 hover:bg-slate-100 ${BTN}"
                          (click)="removeVideo(playlist, video.id)"
                        >
                          Retirer<span class="sr-only"> {{ video.title }}</span>
                        </button>
                      </li>
                    }
                  </ul>
                }
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
})
export class PlaylistsPage {
  private readonly playlists = inject(PlaylistService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<LoadState<Playlist[]>>({ status: 'idle' });
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  /** Erreur d'une action (suppression, retrait de vidéo) : bannière globale fermable. */
  protected readonly actionError = signal<string | null>(null);

  protected readonly editingId = signal<string | null>(null);
  protected readonly renameError = signal<string | null>(null);
  protected readonly confirmingId = signal<string | null>(null);
  /** Playlist ayant une requête en cours : ses boutons sont désactivés (anti double-clic). */
  protected readonly pendingId = signal<string | null>(null);

  private readonly renameBox = viewChild<ElementRef<HTMLInputElement>>('renameBox');

  constructor() {
    this.load();
    // Le champ de renommage n'existe que pendant l'édition : on lui donne le focus à l'ouverture.
    effect(() => {
      const input = this.renameBox()?.nativeElement;
      input?.focus();
      input?.select();
    });
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    this.playlists
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.state.set({ status: 'success', data: res.items }),
        error: (error: unknown) =>
          this.state.set({ status: 'error', message: mapPlaylistError(error) }),
      });
  }

  protected create(value: string, event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    const name = value.trim();
    if (!name) {
      this.createError.set('Saisissez un nom pour la playlist.');
      return;
    }

    this.createError.set(null);
    this.creating.set(true);
    this.playlists
      .create(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.creating.set(false);
          input.value = '';
          this.mutate((items) => sortedByName([...items, created]));
        },
        error: (error: unknown) => {
          this.creating.set(false);
          this.createError.set(mapPlaylistError(error));
        },
      });
  }

  protected startRename(id: string): void {
    this.confirmingId.set(null);
    this.renameError.set(null);
    this.editingId.set(id);
  }

  protected cancelRename(): void {
    this.editingId.set(null);
    this.renameError.set(null);
  }

  protected rename(playlist: Playlist, value: string, event: Event): void {
    event.preventDefault();
    const name = value.trim();
    if (!name) {
      this.renameError.set('Le nom ne peut pas être vide.');
      return;
    }
    if (name === playlist.name) {
      this.cancelRename();
      return;
    }

    this.renameError.set(null);
    this.pendingId.set(playlist.id);
    this.playlists
      .rename(playlist.id, name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.pendingId.set(null);
          this.cancelRename();
          this.mutate((items) =>
            sortedByName(items.map((p) => (p.id === updated.id ? updated : p))),
          );
        },
        error: (error: unknown) => {
          this.pendingId.set(null);
          this.renameError.set(mapPlaylistError(error));
        },
      });
  }

  protected startDelete(id: string): void {
    this.cancelRename();
    this.confirmingId.set(id);
  }

  protected remove(playlist: Playlist): void {
    this.actionError.set(null);
    this.pendingId.set(playlist.id);
    this.playlists
      .remove(playlist.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingId.set(null);
          this.confirmingId.set(null);
          this.mutate((items) => items.filter((p) => p.id !== playlist.id));
        },
        error: (error: unknown) => {
          this.pendingId.set(null);
          this.confirmingId.set(null);
          this.actionError.set(mapPlaylistError(error));
        },
      });
  }

  protected removeVideo(playlist: Playlist, videoId: string): void {
    this.actionError.set(null);
    this.pendingId.set(playlist.id);
    this.playlists
      .removeVideo(playlist.id, videoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingId.set(null);
          this.mutate((items) =>
            items.map((p) =>
              p.id === playlist.id ? { ...p, videos: p.videos.filter((v) => v.id !== videoId) } : p,
            ),
          );
        },
        error: (error: unknown) => {
          this.pendingId.set(null);
          this.actionError.set(mapPlaylistError(error));
        },
      });
  }

  /** Mise à jour immuable de la liste affichée (jamais de push/splice). */
  private mutate(fn: (items: Playlist[]) => Playlist[]): void {
    this.state.update((s) =>
      s.status === 'success' ? { status: 'success', data: fn(s.data) } : s,
    );
  }
}
