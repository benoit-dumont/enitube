import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Header, Sidebar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen flex-col bg-slate-50 text-slate-900">
      <app-header />
      <div class="flex min-h-0 flex-1">
        <app-sidebar />
        <main class="min-w-0 flex-1 overflow-y-auto p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class MainLayout {}
