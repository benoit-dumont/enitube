import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import type { Video, VideoSearchResponse } from '@enitube/shared';
import type { LoadState } from '../../models/load-state';
import { PlaylistModal } from '../playlists/playlist-modal/playlist-modal';
import { VideoService } from '../../services/video.service';
import { mapSearchError } from './search-errors';
import { VideoCard } from './video-card';

/** Pause de frappe avant de lancer la recherche (Entrée, lui, est immédiat). */
export const SEARCH_DEBOUNCE_MS = 400;
/** En dessous, on n'interroge pas : chaque recherche YouTube coûte 100 unités de quota. */
export const SEARCH_MIN_CHARS = 2;

interface SearchRequest {
  q: string;
  /** Absent : première page. Présent : page suivante, ajoutée aux résultats affichés. */
  pageToken?: string;
}

@Component({
  selector: 'app-search-page',
  imports: [VideoCard, PlaylistModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-xl font-semibold">Rechercher</h1>

    <form role="search" class="mb-6 flex max-w-2xl gap-2" (submit)="submit(box.value, $event)">
      <label for="search-input" class="sr-only">Rechercher une vidéo</label>
      <input
        #box
        id="search-input"
        type="search"
        [value]="draft()"
        (input)="onInput(box.value)"
        maxlength="100"
        placeholder="Rechercher une vidéo…"
        autocomplete="off"
        class="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-red-600"
      />
      <button
        type="submit"
        class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
      >
        Rechercher
      </button>
    </form>

    @if (state(); as s) {
      @if (s.status === 'idle') {
        <p class="text-sm text-slate-600">Saisissez un mot-clé pour trouver une vidéo.</p>
      } @else if (s.status === 'loading') {
        <div role="status" aria-busy="true" class="skeleton-region">
          <span class="sr-only">Recherche en cours…</span>
          <ul
            class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-hidden="true"
          >
            @for (card of skeletonCards; track card) {
              <li
                class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <div class="skeleton aspect-video w-full"></div>
                <div class="flex flex-1 flex-col gap-1 p-3">
                  <div class="skeleton h-5 w-full rounded"></div>
                  <div class="skeleton h-5 w-2/3 rounded"></div>
                  <div class="skeleton h-4 w-1/2 rounded"></div>
                  <div class="skeleton h-4 w-full rounded"></div>
                  <div class="skeleton h-4 w-3/4 rounded"></div>
                </div>
                <div class="border-t border-slate-200 px-3 py-2">
                  <div class="skeleton h-5 w-40 rounded"></div>
                </div>
              </li>
            }
          </ul>
        </div>
      } @else if (s.status === 'error') {
        <div role="alert" class="max-w-2xl rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{{ s.message }}</p>
          <button
            type="button"
            class="mt-2 font-semibold underline focus-visible:outline-2 focus-visible:outline-red-600"
            (click)="retry()"
          >
            Réessayer
          </button>
        </div>
      } @else if (s.data.items.length === 0) {
        <p role="status" class="text-sm text-slate-600">
          Aucune vidéo trouvée pour « {{ resultsQuery() }} ». Essayez d'autres mots-clés.
        </p>
      } @else {
        <!-- Pendant une nouvelle recherche, les résultats précédents restent affichés (atténués). -->
        <div
          class="transition-opacity duration-100"
          [class.opacity-60]="refreshing()"
          [attr.aria-busy]="refreshing() ? 'true' : null"
        >
          <p role="status" class="mb-4 text-sm text-slate-600">
            {{ s.data.items.length }} vidéo{{ s.data.items.length > 1 ? 's' : '' }} pour «
            {{ resultsQuery() }} »
          </p>
          <ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (video of s.data.items; track video.id) {
              <li><app-video-card [video]="video" (addToPlaylist)="selected.set($event)" /></li>
            }
          </ul>
        </div>

        @if (s.data.nextPageToken; as token) {
          <div class="mt-8 flex flex-col items-center gap-2">
            <button
              type="button"
              [disabled]="loadingMore()"
              class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              (click)="loadMore(token)"
            >
              {{ loadingMore() ? 'Chargement…' : 'Charger plus' }}
            </button>
            @if (loadMoreError(); as msg) {
              <p role="alert" class="text-sm text-red-700">{{ msg }}</p>
            }
          </div>
        }
      }
    }

    @if (selected(); as video) {
      <app-playlist-modal [video]="video" (closed)="selected.set(null)" />
    }
  `,
})
export class SearchPage {
  private readonly videos = inject(VideoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Terme actuellement affiché ; l'URL (`?q=`) en est la source de vérité. */
  protected readonly query = signal('');
  /** Contenu du champ : suit la frappe, et l'URL seulement si elle change ailleurs (retour arrière). */
  protected readonly draft = signal('');
  /** Terme des résultats affichés : peut retarder sur `query()` pendant qu'une recherche charge. */
  protected readonly resultsQuery = signal('');
  /** Nouvelle recherche en cours alors que des résultats sont déjà à l'écran. */
  protected readonly refreshing = signal(false);
  protected readonly state = signal<LoadState<VideoSearchResponse>>({ status: 'idle' });
  protected readonly loadingMore = signal(false);
  protected readonly loadMoreError = signal<string | null>(null);
  /** Vidéo en cours d'ajout à une playlist (modal ouverte tant qu'elle est définie). */
  protected readonly selected = signal<Video | null>(null);
  /** Cartes du skeleton : une grille complète à la largeur xl (4 colonnes × 2 rangées). */
  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6, 7, 8];

  /** Relance explicite (réessayer, ou même recherche soumise deux fois) ou page suivante. */
  private readonly requests$ = new Subject<SearchRequest>();
  private readonly typed$ = new Subject<string>();

  constructor() {
    const fromUrl$ = this.route.queryParamMap.pipe(
      map((params) => params.get('q')?.trim() ?? ''),
      distinctUntilChanged(),
      tap((q) => {
        if (q !== this.draft().trim()) this.draft.set(q);
      }),
      map((q): SearchRequest => ({ q })),
    );

    // switchMap : une nouvelle requête annule la précédente, donc jamais de réponse périmée affichée.
    merge(fromUrl$, this.requests$)
      .pipe(
        switchMap((req) => this.run(req)),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Recherche à la frappe : l'URL reste la source de vérité, sans empiler l'historique.
    this.typed$
      .pipe(
        map((value) => value.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        filter((q) => q === '' || q.length >= SEARCH_MIN_CHARS), // champ vidé : retour à l'état initial
        filter((q) => q !== this.query()),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        void this.router.navigate([], { queryParams: { q: q || null }, replaceUrl: true });
      });
  }

  protected onInput(value: string): void {
    this.draft.set(value);
    this.typed$.next(value);
  }

  protected submit(value: string, event: Event): void {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;

    if (q === this.query()) {
      this.requests$.next({ q }); // l'URL ne change pas : on relance à la main
    } else {
      void this.router.navigate([], { queryParams: { q } });
    }
  }

  protected retry(): void {
    this.requests$.next({ q: this.query() });
  }

  protected loadMore(pageToken: string): void {
    this.requests$.next({ q: this.query(), pageToken });
  }

  private run({ q, pageToken }: SearchRequest): Observable<unknown> {
    this.loadMoreError.set(null);

    if (!q) {
      this.query.set('');
      this.refreshing.set(false);
      this.state.set({ status: 'idle' });
      return EMPTY;
    }

    this.query.set(q);
    if (pageToken) this.loadingMore.set(true);
    else if (this.state().status === 'success')
      this.refreshing.set(true); // on garde l'écran stable
    else this.state.set({ status: 'loading' });

    return this.videos.search(q, pageToken).pipe(
      tap((res) => {
        this.resultsQuery.set(q);
        this.state.update((current) =>
          pageToken && current.status === 'success'
            ? {
                status: 'success',
                data: {
                  items: [...current.data.items, ...res.items], // immuable : jamais de push
                  nextPageToken: res.nextPageToken,
                },
              }
            : { status: 'success', data: res },
        );
      }),
      catchError((error: unknown) => {
        const message = mapSearchError(error);
        // Échec d'une page suivante : on garde les résultats déjà affichés.
        if (pageToken) this.loadMoreError.set(message);
        else this.state.set({ status: 'error', message });
        return EMPTY;
      }),
      finalize(() => {
        this.loadingMore.set(false);
        this.refreshing.set(false);
      }),
    );
  }
}
