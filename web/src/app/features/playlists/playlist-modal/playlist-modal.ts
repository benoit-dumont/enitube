import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Playlist, Video } from '@enitube/shared';
import { mapPlaylistError } from '../playlist-errors';
import type { LoadState } from '../../../models/load-state';
import { FocusTrap } from '../../../shared/focus-trap';
import { PlaylistService } from '../../../services/playlist.service';
import { isAlreadyInPlaylist, mapAddVideoError } from './add-video-errors';

interface Feedback {
  kind: 'success' | 'error';
  message: string;
}

const byName = (a: Playlist, b: Playlist) => a.name.localeCompare(b.name, 'fr');

/** Tri sur copie : le tableau d'origine n'est pas modifié. */
const sortedByName = (items: Playlist[]): Playlist[] => [...items].sort(byName);

const BTN =
  'rounded-md px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60';

/**
 * Modal « Ajouter à une playlist » : liste les playlists de l'utilisateur, permet d'y ajouter
 * la vidéo, ou d'en créer une à la volée (création puis ajout enchaînés).
 * Focus piégé (FocusTrap), Échap ferme depuis n'importe où, le focus revient sur le déclencheur.
 */
@Component({
  selector: 'app-playlist-modal',
  imports: [FocusTrap],
  host: { '(document:keydown.escape)': 'requestClose()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        #overlay
        type="button"
        tabindex="-1"
        aria-label="Fermer la fenêtre"
        class="animate-overlay-in absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
        (click)="requestClose()"
      ></button>

      <div
        #panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-modal-title"
        tabindex="-1"
        appFocusTrap
        class="animate-dialog-in relative flex max-h-full w-full max-w-md flex-col rounded-2xl bg-white shadow-xl focus-visible:outline-none"
      >
        <header class="border-b border-slate-200 p-4">
          <h2 id="playlist-modal-title" class="text-lg font-semibold">Ajouter à une playlist</h2>
          <p class="mt-1 line-clamp-2 text-sm text-slate-600">{{ video().title }}</p>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          @if (state(); as s) {
            @if (s.status === 'idle' || s.status === 'loading') {
              <div role="status" aria-busy="true" class="skeleton-region">
                <span class="sr-only">Chargement de vos playlists…</span>
                <ul class="flex flex-col divide-y divide-slate-200" aria-hidden="true">
                  @for (row of skeletonRows; track row) {
                    <li class="flex items-center justify-between gap-3 py-2">
                      <div class="flex flex-col gap-1">
                        <div class="skeleton h-5 w-32 rounded"></div>
                        <div class="skeleton h-4 w-16 rounded"></div>
                      </div>
                      <div class="skeleton h-8 w-20 rounded-md"></div>
                    </li>
                  }
                </ul>
              </div>
            } @else if (s.status === 'error') {
              <div role="alert" class="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
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
                Vous n'avez pas encore de playlist. Créez-en une ci-dessous.
              </p>
            } @else {
              <ul class="flex flex-col divide-y divide-slate-200">
                @for (playlist of s.data; track playlist.id) {
                  <li class="flex items-center justify-between gap-3 py-2">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold">{{ playlist.name }}</p>
                      <p class="text-xs text-slate-600">
                        {{ playlist.videos.length }} vidéo{{
                          playlist.videos.length > 1 ? 's' : ''
                        }}
                      </p>
                    </div>
                    @if (contains(playlist)) {
                      <span class="shrink-0 text-sm text-slate-600">Déjà ajoutée</span>
                    } @else {
                      <button
                        type="button"
                        [attr.aria-disabled]="busy() ? 'true' : null"
                        [attr.aria-busy]="pendingId() === playlist.id ? 'true' : null"
                        class="shrink-0 bg-red-600 text-white hover:bg-red-700 aria-disabled:cursor-wait ${BTN}"
                        (click)="add(playlist)"
                      >
                        {{ pendingId() === playlist.id ? 'Ajout…' : 'Ajouter' }}
                        <span class="sr-only"> à {{ playlist.name }}</span>
                      </button>
                    }
                  </li>
                }
              </ul>
            }
          }

          @if (feedback(); as f) {
            @if (f.kind === 'success') {
              <p role="status" class="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                {{ f.message }}
              </p>
            } @else {
              <p role="alert" class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {{ f.message }}
              </p>
            }
          }
        </div>

        <form
          class="border-t border-slate-200 p-4"
          (submit)="createAndAdd(newBox.value, $event, newBox)"
        >
          <label for="modal-new-playlist" class="mb-1 block text-sm font-semibold">
            Nouvelle playlist
          </label>
          <div class="flex gap-2">
            <input
              #newBox
              id="modal-new-playlist"
              type="text"
              maxlength="100"
              placeholder="Nom de la playlist…"
              autocomplete="off"
              [attr.aria-invalid]="createError() ? 'true' : null"
              [attr.aria-describedby]="createError() ? 'modal-new-playlist-error' : null"
              class="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-red-600"
            />
            <button
              type="submit"
              [attr.aria-disabled]="busy() ? 'true' : null"
              [attr.aria-busy]="creating() ? 'true' : null"
              class="border border-slate-300 hover:bg-slate-100 aria-disabled:cursor-wait ${BTN}"
            >
              {{ creating() ? 'Création…' : 'Créer et ajouter' }}
            </button>
          </div>
          @if (createError(); as msg) {
            <p id="modal-new-playlist-error" role="alert" class="mt-2 text-sm text-red-700">
              {{ msg }}
            </p>
          }
        </form>

        <footer class="flex justify-end border-t border-slate-200 p-4">
          <button
            type="button"
            class="border border-slate-300 hover:bg-slate-100 ${BTN}"
            (click)="requestClose()"
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class PlaylistModal {
  readonly video = input.required<Video>();
  readonly closed = output<void>();

  private readonly playlists = inject(PlaylistService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly overlay = viewChild.required<ElementRef<HTMLElement>>('overlay');
  private closing = false;
  private closeFallback: ReturnType<typeof setTimeout> | undefined;

  protected readonly state = signal<LoadState<Playlist[]>>({ status: 'idle' });
  /** Playlist dont l'ajout est en cours. */
  protected readonly pendingId = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);
  /** Lignes du skeleton de chargement (même gabarit que les vraies lignes). */
  protected readonly skeletonRows = [1, 2, 3];

  constructor() {
    // Le focus entre dans la modal à l'ouverture et revient sur le déclencheur à la fermeture.
    const doc = inject(DOCUMENT);
    const opener = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    afterNextRender(() => this.panel().nativeElement.focus());
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.closeFallback);
      opener?.focus();
    });

    this.load();
  }

  /**
   * Fermeture avec sortie animée (~150 ms, ease-in) : le parent détruit la modal dès que
   * `closed` est émis, donc on émet une fois l'animation terminée. Sans animation (styles
   * absents, mouvement réduit à 1 ms) la fermeture est immédiate.
   */
  protected requestClose(): void {
    if (this.closing) return;
    const panel = this.panel().nativeElement;
    const overlay = this.overlay().nativeElement;

    panel.classList.replace('animate-dialog-in', 'animate-dialog-out');
    overlay.classList.replace('animate-overlay-in', 'animate-overlay-out');

    const name = getComputedStyle(panel).animationName;
    if (!name || name === 'none') {
      this.closed.emit();
      return;
    }

    this.closing = true;
    const finish = () => {
      if (!this.closing) return;
      this.closing = false;
      clearTimeout(this.closeFallback);
      this.closed.emit();
    };
    panel.addEventListener('animationend', finish, { once: true });
    this.closeFallback = setTimeout(finish, 400); // filet : onglet masqué, animationend perdu
  }

  /** Anti double-clic : un seul appel d'écriture à la fois. */
  protected busy(): boolean {
    return this.pendingId() !== null || this.creating();
  }

  protected contains(playlist: Playlist): boolean {
    return playlist.videos.some((v) => v.id === this.video().id);
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    this.playlists
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.state.set({ status: 'success', data: sortedByName(res.items) }),
        error: (error: unknown) =>
          this.state.set({ status: 'error', message: mapPlaylistError(error) }),
      });
  }

  protected add(playlist: Playlist): void {
    if (this.busy()) return;
    this.feedback.set(null);
    this.pendingId.set(playlist.id);
    this.playlists
      .addVideo(playlist.id, this.video().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.pendingId.set(null);
          this.mutate((items) => items.map((p) => (p.id === updated.id ? updated : p)));
          this.feedback.set({ kind: 'success', message: `Ajoutée à « ${updated.name} ».` });
        },
        error: (error: unknown) => {
          this.pendingId.set(null);
          // Doublon : l'affichage était périmé, on le corrige pour refléter la réalité.
          if (isAlreadyInPlaylist(error)) {
            const video = this.video();
            this.mutate((items) =>
              items.map((p) => (p.id === playlist.id ? { ...p, videos: [video, ...p.videos] } : p)),
            );
          }
          this.feedback.set({ kind: 'error', message: mapAddVideoError(error) });
        },
      });
  }

  /** Crée la playlist puis y ajoute la vidéo. Si l'ajout échoue, la playlist créée reste listée. */
  protected createAndAdd(value: string, event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    if (this.busy()) return;

    const name = value.trim();
    if (!name) {
      this.createError.set('Saisissez un nom pour la playlist.');
      return;
    }
    if (this.state().status !== 'success') {
      this.createError.set('Vos playlists ne sont pas chargées. Réessayez dans un instant.');
      return;
    }

    this.createError.set(null);
    this.feedback.set(null);
    this.creating.set(true);
    this.playlists
      .create(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.creating.set(false);
          input.value = '';
          this.mutate((items) => sortedByName([...items, created]));
          this.add(created);
        },
        error: (error: unknown) => {
          this.creating.set(false);
          this.createError.set(mapPlaylistError(error));
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
