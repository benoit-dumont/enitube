import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { Toast, ToastKind } from '../../services/toast.service';

/** Icône (second signal, jamais la couleur seule) et couleur d'accent par gravité. */
const ACCENT: Record<ToastKind, { stripe: string; icon: string }> = {
  success: { stripe: 'bg-green-700', icon: 'text-green-700' },
  info: { stripe: 'bg-slate-600', icon: 'text-slate-600' },
  warning: { stripe: 'bg-amber-600', icon: 'text-amber-700' },
  error: { stripe: 'bg-red-700', icon: 'text-red-700' },
};

/**
 * Un toast : icône + liseré + message, fermeture manuelle (cible 44 px), action facultative.
 * Le timer est mis en pause au survol et au focus, et reprend avec le temps restant.
 */
@Component({
  selector: 'app-toast-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(mouseenter)': 'pause()',
    '(mouseleave)': 'resume()',
    '(focusin)': 'pause()',
    '(focusout)': 'resume()',
  },
  template: `
    <div
      class="relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white py-3 pr-1 pl-5 text-sm text-slate-900 shadow-lg"
      [attr.role]="toast().kind === 'error' ? 'alert' : 'status'"
    >
      <span
        class="absolute inset-y-0 left-0 w-1"
        [class]="accent().stripe"
        aria-hidden="true"
      ></span>

      <svg
        class="mt-0.5 size-6 shrink-0"
        [class]="accent().icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (toast().kind) {
          @case ('success') {
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12.5 2.5 2.5L16 9.5" />
          }
          @case ('info') {
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          }
          @case ('warning') {
            <path d="M12 3.5 21 19.5H3L12 3.5Z" />
            <path d="M12 10v4M12 17h.01" />
          }
          @case ('error') {
            <circle cx="12" cy="12" r="9" />
            <path d="m9 9 6 6M15 9l-6 6" />
          }
        }
      </svg>

      <p class="min-w-0 flex-1 py-0.5">{{ toast().message }}</p>

      @if (toast().action; as action) {
        <button
          type="button"
          class="-my-1 min-h-11 shrink-0 rounded-md px-3 font-semibold underline hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          (click)="runAction(action.run)"
        >
          {{ action.label }}
        </button>
      }

      <button
        type="button"
        aria-label="Fermer la notification"
        class="-my-1 grid size-11 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        (click)="dismissed.emit()"
      >
        <svg
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>

      @if (toast().durationMs !== null && toast().action) {
        <span
          class="toast-countdown absolute inset-x-0 bottom-0 h-0.5 bg-slate-400"
          [style.animation-duration.ms]="toast().durationMs"
          [style.animation-play-state]="paused() ? 'paused' : 'running'"
          aria-hidden="true"
        ></span>
      }
    </div>
  `,
})
export class ToastItem {
  readonly toast = input.required<Toast>();
  readonly dismissed = output<void>();

  protected readonly paused = signal(false);
  protected accent = () => ACCENT[this.toast().kind];

  private timer: ReturnType<typeof setTimeout> | undefined;
  private remaining = 0;
  private startedAt = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => {
      const duration = this.toast().durationMs;
      if (duration === null) return;
      this.remaining = duration;
      this.start();
    });
  }

  protected pause(): void {
    if (this.timer === undefined || this.paused()) return;
    clearTimeout(this.timer);
    this.remaining -= Date.now() - this.startedAt;
    this.paused.set(true);
  }

  protected resume(): void {
    if (!this.paused()) return;
    this.paused.set(false);
    this.start();
  }

  /** Une action referme le toast : elle a produit son effet. */
  protected runAction(run: () => void): void {
    run();
    this.dismissed.emit();
  }

  private start(): void {
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.dismissed.emit(), Math.max(this.remaining, 0));
  }
}
