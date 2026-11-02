import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Video } from '@enitube/shared';

const compactNumber = new Intl.NumberFormat('fr-FR', { notation: 'compact' });

@Component({
  selector: 'app-video-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md"
    >
      <a
        [routerLink]="['/video', video().id]"
        class="group flex flex-1 flex-col focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-600"
      >
        <div class="aspect-video w-full overflow-hidden bg-slate-200">
          <img
            [src]="video().thumbnailUrl"
            alt=""
            loading="lazy"
            class="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <div class="flex flex-1 flex-col gap-1 p-3">
          <h3 class="line-clamp-2 text-sm font-semibold text-slate-900">{{ video().title }}</h3>
          <p class="truncate text-xs text-slate-600">{{ video().channel }} · {{ views() }}</p>
          <p class="line-clamp-2 text-xs text-slate-500">{{ video().description }}</p>
        </div>
      </a>
      <button
        type="button"
        class="border-t border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-600"
        (click)="addToPlaylist.emit(video())"
      >
        + Ajouter à une playlist<span class="sr-only"> : {{ video().title }}</span>
      </button>
    </div>
  `,
})
export class VideoCard {
  readonly video = input.required<Video>();
  /** Demande d'ajout à une playlist : la page parente ouvre la modal. */
  readonly addToPlaylist = output<Video>();

  protected readonly views = computed(() => `${compactNumber.format(this.video().views)} vues`);
}
