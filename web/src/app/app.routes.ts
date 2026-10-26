import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

// Composants temporaires : à supprimer quand les vraies pages arrivent.
@Component({ template: '<p>Page /auth (temporaire)</p>' })
class TmpAuth {}

@Component({ template: '<p>Page /search (temporaire)</p>' })
class TmpSearch {}

export const routes: Routes = [
  { path: 'auth', canActivate: [guestGuard], component: TmpAuth },
  { path: 'search', canActivate: [authGuard], component: TmpSearch },
  { path: '', pathMatch: 'full', redirectTo: 'search' },
  { path: '**', redirectTo: 'search' },
];
