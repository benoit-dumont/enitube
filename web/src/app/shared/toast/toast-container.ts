import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { ToastItem } from './toast-item';

/**
 * Pile de toasts : bas-droite sur desktop, bord haut sur mobile, jamais au centre ;
 * 3 visibles au plus (style.md §8.4). Au-dessus des modals (z-60 contre z-50).
 */
@Component({
  selector: 'app-toast-container',
  imports: [ToastItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      aria-label="Notifications"
      class="pointer-events-none fixed inset-x-4 top-4 z-60 isolate sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-4 sm:w-96"
    >
      <ul class="flex flex-col gap-2">
        @for (toast of toasts.visible(); track toast.id) {
          <li
            class="pointer-events-auto"
            animate.enter="animate-toast-in"
            animate.leave="animate-toast-out"
          >
            <app-toast-item [toast]="toast" (dismissed)="toasts.dismiss(toast.id)" />
          </li>
        }
      </ul>
    </section>
  `,
})
export class ToastContainer {
  protected readonly toasts = inject(ToastService);
}
