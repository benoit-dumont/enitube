import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6"
    >
      <span class="text-lg font-bold text-red-600">ENITube</span>

      <div class="flex items-center gap-4">
        @if (auth.user(); as user) {
          <span class="text-sm text-slate-600">{{ user.username }}</span>
        }
        <button
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          (click)="auth.logout()"
        >
          Déconnexion
        </button>
      </div>
    </header>
  `,
})
export class Header {
  protected readonly auth = inject(AuthService);
}
