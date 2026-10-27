import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

// Composant temporaire : à supprimer avec feat/web-auth-pages.
@Component({ template: '<p>Page /auth (temporaire)</p>' })
class TmpAuth {}

export const routes: Routes = [
  { path: 'auth', canActivate: [guestGuard], component: TmpAuth },
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
        path: 'playlists',
        loadComponent: () =>
          import('./features/playlists/playlists.page').then((m) => m.PlaylistsPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'search' },
    ],
  },
  { path: '**', redirectTo: 'search' },
];
