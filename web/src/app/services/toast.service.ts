import { Injectable, computed, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** `null` : reste affiché jusqu'à fermeture explicite. */
  durationMs: number | null;
  action?: ToastAction;
}

export interface ToastOptions {
  action?: ToastAction;
  durationMs?: number | null;
}

/** Fermeture automatique par gravité (style.md §8.4) ; une erreur reste jusqu'à validation. */
const DEFAULT_DURATION: Record<ToastKind, number | null> = {
  success: 4000,
  info: 4000,
  warning: 7000,
  error: null,
};

/** Fenêtre d'annulation d'une action unitaire (style.md §8.2). */
export const UNDO_DURATION_MS = 5000;

/** Au-delà, les toasts attendent dans la file : trop de surfaces simultanées sont ignorées. */
export const MAX_VISIBLE_TOASTS = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly queue = signal<readonly Toast[]>([]);

  /** Les toasts affichés ; le reste attend qu'une place se libère (le timer ne démarre qu'à l'affichage). */
  readonly visible = computed(() => this.queue().slice(0, MAX_VISIBLE_TOASTS));

  success(message: string, options?: ToastOptions): void {
    this.show('success', message, options);
  }

  info(message: string, options?: ToastOptions): void {
    this.show('info', message, options);
  }

  warning(message: string, options?: ToastOptions): void {
    this.show('warning', message, options);
  }

  error(message: string, options?: ToastOptions): void {
    this.show('error', message, options);
  }

  dismiss(id: number): void {
    this.queue.update((items) => items.filter((t) => t.id !== id));
  }

  private show(kind: ToastKind, message: string, options: ToastOptions = {}): void {
    const toast: Toast = {
      id: this.nextId++,
      kind,
      message,
      durationMs: options.durationMs !== undefined ? options.durationMs : DEFAULT_DURATION[kind],
      action: options.action,
    };
    this.queue.update((items) => [...items, toast]); // immuable : jamais de push
  }
}
