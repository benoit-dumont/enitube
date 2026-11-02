import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  readonly path: string;
  readonly label: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      aria-label="Navigation principale"
      class="w-56 shrink-0 border-r border-slate-200 bg-white p-3"
    >
      <ul class="flex flex-col gap-1">
        @for (link of links; track link.path) {
          <li>
            <a
              [routerLink]="link.path"
              routerLinkActive="bg-red-50 text-red-700 font-semibold"
              ariaCurrentWhenActive="page"
              class="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {{ link.label }}
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class Sidebar {
  protected readonly links: readonly NavLink[] = [
    { path: '/search', label: 'Rechercher' },
    { path: '/playlists', label: 'Mes playlists' },
  ];
}
