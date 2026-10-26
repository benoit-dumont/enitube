# ENITub : plan et roadmap consolidés

*Document de référence reprenant toutes les décisions prises. Les durées sont estimées pour 2 personnes (1 back, 1 front) ; en solo, compter environ 1,7 fois plus.*

# Partie 1 : Plan

## 1. Vision et périmètre

**Objectif :** une application type mini-YouTube pour rechercher, lire et ranger des vidéos YouTube dans des playlists, avec authentification classique.

**Fonctionnalités**

- Inscription / connexion par email + mot de passe
- Recherche YouTube (états loading / empty / error / results)
- Lecteur embed avec métadonnées limitées (vignette, titre, chaîne, vues, description)
- Playlists : créer, renommer, supprimer, ajouter, retirer, lancer une vidéo
- Layout protégé : header + sidebar à 2 liens (Rechercher, Mes playlists) + guard

**Hors périmètre :** upload, likes, commentaires, abonnements, PWA, i18n, refresh tokens, SSO (Google, Microsoft).

## 2. Stack et décisions techniques

| Couche | Choix |
| --- | --- |
| Front | Angular 22 standalone, zoneless, signals, `inject()`, `@if` / `@for` obligatoires, Tailwind v4, lazy routes |
| Back | Node + Express + TypeScript, validation zod |
| Base de données | MySQL 8 (utf8mb4) via Sequelize 7 (`@sequelize/core` + `@sequelize/mysql`) |
| Migrations | Umzug (pas de `sequelize.sync()` hors tests) |
| Auth | bcrypt + JWT maison, token en `sessionStorage` côté front |
| API externe | Fournisseur de vidéos interchangeable : catalogue local (par défaut) ou YouTube Data API v3 (optionnel, clé côté serveur uniquement) |
| Dépôt | Monorepo `api/` + `web/` + `docs/` |

**Un risque technique assumé**

1. **Sequelize 7 est toujours en alpha** : version exacte épinglée (sans `^`), `experimentalDecorators` activé, plan B Sequelize 6 à trancher avant `api-bootstrap`.

## 3. Architecture

```
enitube/
├── api/
│   ├── migrations/ (ou src/migrations)   001 à 004
│   └── src/
│       ├── config/       env.ts (zod), db.ts, migrator.ts
│       ├── middlewares/  requireAuth, errorHandler
│       └── modules/
│           ├── auth/       routes, service, user.model, users.repository
│           ├── videos/     video.provider (interface), catalog.provider, catalog.json, youtube.provider (optionnel), routes
│           └── playlists/  models (Playlist, Video, PlaylistVideo), repository, routes
├── web/src/app/
│   ├── core/       models, services (auth, storage, video, playlist), guards, interceptors
│   ├── features/   auth, search, video, playlist
│   ├── shared/     playlist-modal
│   └── layout/     main-layout, header, sidebar
├── docs/           api-contract.md, decisions.md
├── .github/        CI, template de PR
└── docker-compose.yml
```

**Règle de couche côté API :** routes → service → repository, jamais de logique de données dans les routes.

**Fournisseur de vidéos interchangeable :** le module `videos` dépend d'une interface, jamais de YouTube directement. `VIDEO_PROVIDER=catalog` (défaut) lit `catalog.json` ; `VIDEO_PROVIDER=youtube` appelle la vraie API. `YOUTUBE_API_KEY` n'est exigée (zod) que dans ce second cas.

```ts
interface VideoProvider {
  search(q: string, pageToken?: string): Promise<{ items: Video[]; nextPageToken?: string }>;
  getById(id: string): Promise<Video | null>;
}
```

Le catalogue contient 20 à 30 vraies vidéos YouTube (ID, titre, chaîne, vues, description, vignette) aux titres variés, pour que le lecteur embed fonctionne et que la recherche réagisse aux mots tapés.

## 4. Modèle de données

| Table | Colonnes clés | Contraintes |
| --- | --- | --- |
| `users` | id (UUID), username, email, password\_hash | email unique |
| `playlists` | id, user\_id, name | unique (user\_id, name), cascade |
| `videos` | id (ID YouTube, 11 car.), title, channel, views, description, thumbnail\_url | snapshot partagé |
| `playlist_videos` | playlist\_id, video\_id, created\_at | PK composite (anti-doublon), tri par date |

## 5. Contrat d'API

Format d'erreur unique `{ code, message }` ; le front mappe sur `code`.

| Domaine | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Vidéos | `GET /videos/search?q=&pageToken=`, `GET /videos/:id` |
| Playlists | `GET/POST /playlists`, `PATCH/DELETE /playlists/:id`, `POST /playlists/:id/videos`, `DELETE /playlists/:id/videos/:videoId` |

**Codes d'erreur :** `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `QUOTA_EXCEEDED`, `VIDEO_NOT_FOUND`, `VIDEO_ALREADY_IN_PLAYLIST`, `PLAYLIST_NOT_FOUND`.

## 6. Règles de sécurité non négociables

- Aucun secret commité (`.env` gitignoré, `.env.example` commité), CORS limité à `http://localhost:4200`.
- Requêtes via Sequelize uniquement (paramétrées), jamais de SQL concaténé.
- Playlists toujours filtrées par `userId` du JWT, jamais par un id fourni par le client.
- ID vidéo validé par `/^[\w-]{11}$/` avant tout appel ou sanitize, iframe sur `youtube-nocookie.com`.
- Mises à jour d'état immuables côté front (jamais de `push` ni de `splice`).

## 7. Workflow Git

```
feat/* ──PR──► dev ──PR de release──► main (prod, tags)
                        hotfix/* ──► main puis report sur dev
```

- `main` et `dev` protégées : PR obligatoire, 1 relecteur, CI verte (lint + build).
- Branches `feat/<scope>-<nom>` (scopes api / web / repo), 1 jour maximum, supprimées après merge.
- Conventional Commits, squash vers `dev`, merge commit de `dev` vers `main`.
- Une PR = un scope, sauf `docs/`.
- Le front travaille sur mocks conformes au contrat, puis une PR `chore/web-wire-<feature>` bascule sur l'API réelle.

# Partie 2 : Roadmap

## Vue d'ensemble

| Jalon | Contenu | Date cible |
| --- | --- | --- |
| M0 | Fondations opérationnelles | fin J1 |
| M1 | Auth + layout | fin J2 |
| M2 | Recherche + lecture | fin J4 |
| M3 | Playlists | fin J5 |
| v0.1.0 | MVP complet | fin J6 |

## Étape 0 : prérequis (avant le premier commit, \~2 h)

- **Outils :** Node LTS, Git, Docker, Angular CLI, client SQL, client HTTP.
- **Clé YouTube :** optionnelle, le MVP démarre avec le catalogue local. À faire seulement pour passer en VIDEO\_PROVIDER=youtube : projet Google Cloud, API activée, restriction à YouTube Data API v3.
- **Dépôt GitHub** créé, branches `main` / `dev` protégées.
- **Décisions écrites** dans `docs/decisions.md` : version Sequelize 7 épinglée (ou repli v6), Tailwind v4, conventions de commit.

## Phase 0 : fondations (J1)

| Branche | Qui | Livrable | Durée |
| --- | --- | --- | --- |
| `chore/repo-init` | les 2 | Monorepo, template de PR, CI, docker-compose MySQL | 1 h |
| `docs/api-contract` | les 2 | Contrat complet (auth, vidéos, playlists, erreurs) | 1,5 h |
| `chore/api-bootstrap` | Back | Express + TS, env.ts, db.ts Sequelize, /health, error handler | 2 h |
| `chore/web-bootstrap` | Front | `ng new --skip-tests`, Tailwind, zoneless, HttpClient, proxy, interfaces.ts, `LoadState<T>` | 2 h |
| `chore/api-migrations` | Back | Umzug, scripts migrate, migrations 001-004 | 2 h |

**Sortie (M0) :** `docker compose up` + migrate + dev donnent un `/health` vert, `ng serve` affiche une page vide, le contrat est mergé.

## Phase 1 : authentification et layout (J1-J2)

| Branche | Qui | Contenu | Durée |
| --- | --- | --- | --- |
| `feat/api-auth` | Back | Modèle User, register / login / me, bcrypt, JWT, requireAuth, zod | 4 h |
| `feat/web-auth-core` | Front | StorageService, AuthService (signals), intercepteur Bearer, guards | 3 h |
| `feat/web-layout` | Front | main-layout, header (déconnexion), sidebar, routes lazy, wildcard | 2 h |
| `feat/web-auth-pages` | Front | Page /auth, erreurs par champ, mapping des codes | 3 h |
| `chore/web-wire-auth` | Front | Bascule mocks → API réelle | 0,5 h |

**Sortie (M1) :** redirection vers `/auth`, inscription, connexion, arrivée sur `/search`, déconnexion, F5 conserve la session.

## Phase 2 : recherche et lecture (J3-J4)

| Branche | Qui | Contenu | Durée |
| --- | --- | --- | --- |
| `feat/api-videos` | Back | Interface VideoProvider, provider catalogue (catalog.json de 20 à 30 vidéos, filtre titre/chaîne), choix via VIDEO\_PROVIDER, validation d'ID | 4 h |
| `feat/web-search` | Front | VideoService, /search (4 états), recherche sur Entrée, grille responsive, line-clamp | 4 h |
| `feat/web-video-player` | Front | /video/:id, regex d'ID, iframe + DomSanitizer, états not-found / error | 3 h |
| `chore/web-wire-videos` | Front | Bascule sur l'API réelle | 0,5 h |
| feat/api-videos-youtube (optionnel) | Back | Provider YouTube (search puis videos en un seul appel groupé), mapper toVideo, erreurs quota/clé, cache mémoire ; YOUTUBE\_API\_KEY requise seulement si VIDEO\_PROVIDER=youtube | 3 h |

**Sortie (M2) :** une recherche (catalogue local, ou YouTube si activé) affiche vignette, titre, chaîne, vues, description. Un ID invalide donne « introuvable » sans appel réseau.

## Phase 3 : playlists (J5)

| Branche | Qui | Contenu | Durée |
| --- | --- | --- | --- |
| `feat/api-playlists` | Back | Modèles + many-to-many, CRUD, propriété par JWT, transaction d'ajout, 409 sur doublon | 4 h |
| `feat/web-playlists-page` | Front | /playlists : créer, renommer, supprimer (confirmation), retirer, lancer | 3 h |
| `feat/web-playlist-modal` | Front | Modal d'ajout depuis la recherche, création à la volée | 2 h |
| `chore/web-wire-playlists` | Front | Bascule sur l'API réelle | 0,5 h |

**Sortie (M3) :** une vidéo est ajoutée depuis la recherche, retirée depuis `/playlists`, un doublon est refusé proprement.

## Phase 4 : finitions et release v0.1.0 (J6)

| Branche | Qui | Contenu | Durée |
| --- | --- | --- | --- |
| `feat/web-polish` | Front | Skeletons, toasts, focus trap et Échap dans la modal | 3 h |
| `feat/web-search-debounce` | Front | Bonus : debounce + switchMap (ou httpResource) | 1,5 h |
| `test/api-core` | Back | Tests d'intégration auth, playlists, propriété | 3 h |
| `chore/release-0.1.0` | les 2 | README, CHANGELOG, PR dev → main, tag v0.1.0 | 1,5 h |

## Calendrier par personne

| Jour | Back | Front |
| --- | --- | --- |
| J1 | api-bootstrap, api-migrations | web-bootstrap |
| J2 | api-auth | auth-core, auth-pages |
| J3 | api-videos | layout, search |
| J4 | Aide à l'intégration | search, player |
| J5 | api-playlists | player, playlists page |
| J6 | Tests d'API | Playlists page, modal, polish, debounce |

**Équilibrage :** le back est moins chargé que le front sur le MVP (environ 16 h contre 26 h). Le back peut donc absorber la CI, les tests d'API, le README, les PR de bascule `web-wire-*` et la relecture, ce qui évite que le front devienne le chemin critique.

## Rituels d'équipe

- Point de 10 min en début de journée (qui prend quelle branche, blocages).
- PR relue dans la demi-journée, sinon elle bloque l'autre côté.
- Démo locale rapide à chaque fin de phase avant de passer à la suivante.

## Risques et parades

| Risque | Parade |
| --- | --- |
| Sequelize 7 alpha (API mouvante, outillage partiel) | Version épinglée, Umzug, plan B Sequelize 6 décidé à l'étape 0 |
| Quota YouTube (10 000 unités/jour, search = 100) | Catalogue local par défaut (aucun quota consommé) ; avec YouTube : cache serveur, une clé par développeur en local |
| Front bloqué par le back | Contrat figé en phase 0, mocks, PR `web-wire-*` |
| Dérive de périmètre | Rester sur le MVP |

## Définition de « terminé »

**v0.1.0**

- Un visiteur est redirigé vers `/auth`, puis arrive sur `/search` après connexion.
- Une recherche affiche des vidéos (catalogue local, YouTube en option), un clic ouvre l'embed sur `/video/:id`.
- Une vidéo est ajoutée puis retirée d'une playlist, avec persistance MySQL.
- Aucun secret commité, CI verte, README permettant de tout lancer en moins de 10 minutes.
