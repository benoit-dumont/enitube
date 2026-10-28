import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    // Layout protégé : le guard s'applique à toutes les routes enfants.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: 'search',
        loadComponent: () => import('./features/search/search.page').then((m) => m.SearchPage),
      },
      {
        path: 'video/:id',
        loadComponent: () => import('./features/video/video.page').then((m) => m.VideoPage),
      },
      {
        path: 'playlists',
        loadComponent: () =>
          import('./features/playlists/playlists.page').then((m) => m.PlaylistsPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'search' },
    ],
  },
  { path: '**', redirectTo: 'search' },
];
