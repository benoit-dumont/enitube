import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import type { Video } from '@enitube/shared';
import type { LoadState } from '../../models/load-state';
import { VideoService } from '../../services/video.service';
import { EMBED_BASE_URL, isValidVideoId } from './video-id';
import { mapVideoError, type VideoFailure } from './video-errors';

type PlayerState = LoadState<Video> | Extract<VideoFailure, { status: 'not-found' }>;

const numberFormat = new Intl.NumberFormat('fr-FR');

@Component({
  selector: 'app-video-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state(); as s) {
      @if (s.status === 'idle' || s.status === 'loading') {
        <div role="status" aria-busy="true" class="skeleton-region max-w-4xl">
          <span class="sr-only">Chargement de la vidéo…</span>
          <div aria-hidden="true">
            <div class="skeleton aspect-video w-full rounded-lg"></div>
            <div class="skeleton mt-4 h-7 w-2/3 rounded"></div>
            <div class="skeleton mt-1 h-5 w-1/3 rounded"></div>
            <div class="mt-4 flex max-w-prose flex-col gap-1">
              <div class="skeleton h-5 w-full rounded"></div>
              <div class="skeleton h-5 w-full rounded"></div>
              <div class="skeleton h-5 w-1/2 rounded"></div>
            </div>
          </div>
        </div>
      } @else if (s.status === 'not-found') {
        <div role="alert" class="max-w-2xl rounded-md bg-slate-100 px-4 py-3 text-sm">
          <p class="font-semibold">Vidéo introuvable</p>
          <p class="mt-1 text-slate-600">Cette vidéo n'existe pas ou n'est plus disponible.</p>
          <a
            routerLink="/search"
            class="mt-2 inline-block font-semibold text-red-700 underline focus-visible:outline-2 focus-visible:outline-red-600"
          >
            Retour à la recherche
          </a>
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
      } @else {
        <article class="max-w-4xl">
          @if (embedUrl(); as url) {
            <div class="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                [src]="url"
                [title]="s.data.title"
                class="h-full w-full"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin"
              ></iframe>
            </div>
          }
          <h1 class="mt-4 text-xl font-semibold">{{ s.data.title }}</h1>
          <p class="mt-1 text-sm text-slate-600">
            {{ s.data.channel }} · {{ formatViews(s.data.views) }}
          </p>
          <p class="mt-4 max-w-prose whitespace-pre-line text-sm text-slate-700">
            {{ s.data.description }}
          </p>
        </article>
      }
    }
  `,
})
export class VideoPage {
  private readonly videos = inject(VideoService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly state = signal<PlayerState>({ status: 'idle' });

  /** Dernier ID de l'URL ayant passé la validation : seul ce qui est validé atteint le sanitizer. */
  private readonly videoId = signal<string | null>(null);

  protected readonly embedUrl = computed(() => {
    const id = this.videoId();
    return isValidVideoId(id)
      ? this.sanitizer.bypassSecurityTrustResourceUrl(`${EMBED_BASE_URL}${id}`)
      : null;
  });

  /** Relance explicite (réessayer) : l'URL ne change pas, il faut donc un déclencheur à part. */
  private readonly retries$ = new Subject<string>();

  constructor() {
    const fromUrl$ = this.route.paramMap.pipe(
      map((params) => params.get('id') ?? ''),
      distinctUntilChanged(),
    );

    // switchMap : naviguer vers une autre vidéo annule la requête précédente.
    merge(fromUrl$, this.retries$)
      .pipe(
        switchMap((id) => this.load(id)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected retry(): void {
    const id = this.videoId();
    if (id) this.retries$.next(id);
  }

  protected formatViews(views: number): string {
    return `${numberFormat.format(views)} vues`;
  }

  private load(id: string): Observable<unknown> {
    // Un ID mal formé ne peut pas exister : « introuvable » sans appel réseau.
    if (!isValidVideoId(id)) {
      this.videoId.set(null);
      this.state.set({ status: 'not-found' });
      return EMPTY;
    }

    this.videoId.set(id);
    this.state.set({ status: 'loading' });

    return this.videos.getById(id).pipe(
      tap((video) => this.state.set({ status: 'success', data: video })),
      catchError((error: unknown) => {
        this.state.set(mapVideoError(error));
        return EMPTY;
      }),
    );
  }
}
