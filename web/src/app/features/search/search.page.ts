import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  finalize,
  map,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import type { VideoSearchResponse } from '@enitube/shared';
import type { LoadState } from '../../models/load-state';
import { VideoService } from '../../services/video.service';
import { mapSearchError } from './search-errors';
import { VideoCard } from './video-card';

interface SearchRequest {
  q: string;
  /** Absent : première page. Présent : page suivante, ajoutée aux résultats affichés. */
  pageToken?: string;
}

@Component({
  selector: 'app-search-page',
  imports: [VideoCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-xl font-semibold">Rechercher</h1>

    <form role="search" class="mb-6 flex max-w-2xl gap-2" (submit)="submit(box.value, $event)">
      <label for="search-input" class="sr-only">Rechercher une vidéo</label>
      <input
        #box
        id="search-input"
        type="search"
        [value]="query()"
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
        <p role="status" class="text-sm text-slate-600">Recherche en cours…</p>
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
          Aucune vidéo trouvée pour « {{ query() }} ». Essayez d'autres mots-clés.
        </p>
      } @else {
        <p role="status" class="mb-4 text-sm text-slate-600">
          {{ s.data.items.length }} vidéo{{ s.data.items.length > 1 ? 's' : '' }} pour «
          {{ query() }} »
        </p>
        <ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          @for (video of s.data.items; track video.id) {
            <li><app-video-card [video]="video" /></li>
          }
        </ul>

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
  `,
})
export class SearchPage {
  private readonly videos = inject(VideoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Terme actuellement affiché ; l'URL (`?q=`) en est la source de vérité. */
  protected readonly query = signal('');
  protected readonly state = signal<LoadState<VideoSearchResponse>>({ status: 'idle' });
  protected readonly loadingMore = signal(false);
  protected readonly loadMoreError = signal<string | null>(null);

  /** Relance explicite (réessayer, ou même recherche soumise deux fois) ou page suivante. */
  private readonly requests$ = new Subject<SearchRequest>();

  constructor() {
    const fromUrl$ = this.route.queryParamMap.pipe(
      map((params) => params.get('q')?.trim() ?? ''),
      distinctUntilChanged(),
      map((q): SearchRequest => ({ q })),
    );

    // switchMap : une nouvelle requête annule la précédente, donc jamais de réponse périmée affichée.
    merge(fromUrl$, this.requests$)
      .pipe(
        switchMap((req) => this.run(req)),
        takeUntilDestroyed(),
      )
      .subscribe();
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
      this.state.set({ status: 'idle' });
      return EMPTY;
    }

    this.query.set(q);
    if (pageToken) this.loadingMore.set(true);
    else this.state.set({ status: 'loading' });

    return this.videos.search(q, pageToken).pipe(
      tap((res) =>
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
        ),
      ),
      catchError((error: unknown) => {
        const message = mapSearchError(error);
        // Échec d'une page suivante : on garde les résultats déjà affichés.
        if (pageToken) this.loadMoreError.set(message);
        else this.state.set({ status: 'error', message });
        return EMPTY;
      }),
      finalize(() => this.loadingMore.set(false)),
    );
  }
}
