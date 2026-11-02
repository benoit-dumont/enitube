# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-02

First MVP release: authentication, video search and playback, and playlists.

### Added

#### API

- Authentication: register, login and `GET /auth/me` (bcrypt + JWT), with `.env` validation at startup.
- Video provider interface with a local catalog provider (`VIDEO_PROVIDER=catalog`, no API key or
  quota), `GET /videos/search` and `GET /videos/:id`, plus video provider settings in the env.
- Playlists: `Playlist`, `Video` and `PlaylistVideo` models, zod schemas, service, controller and
  routes (create, rename, delete, add and remove videos).
- OpenAPI documentation for the video and playlist endpoints.
- Shared types and error codes for auth, errors and playlists (`shared/`).

#### Web

- Auth core: storage service, auth service, Bearer interceptor and route guards.
- Protected main layout with header and sidebar, and an auth page with login and register forms.
- `LoadState` type and video service (search and `getById`).
- Search page with a responsive video grid.
- Video player page with embed, video id validation and error mapping, behind a lazy route.
- Playlist service, error mapping and playlists page.
- Playlist modal, opened from search results.
- Toast notifications with pause on hover and an undo action, used on the playlists page.
- Loading skeletons on the search, video and playlists pages.
- Focus trap, close on Escape and exit animation in the playlist modal.
- Search as you type: debounced input that keeps the previous results while loading.
- Web tests for the search page, video player page, playlists page, playlist modal and
  search-as-you-type.

#### Repository and tooling

- Monorepo (`api/`, `web/`, `shared/`) and GitHub Actions workflow (web tests included).
- Docker Compose configuration for MySQL, with a phpMyAdmin service for local development.
- OpenAPI documentation published on GitHub Pages (Redoc), deployed from CI on `main`.
- API integration tests run in CI against a MySQL service.
- ESLint setup for the web app, Tailwind v4 with PostCSS, and committed package-lock files.

### Changed

- Motion tokens, skeleton and reduced-motion styles.
- Web `packageManager` version updated.
- API test titles, comments and messages translated to English.

### Fixed

- Videos router was not registered in the app.
- Malformed JSON bodies now return `400 VALIDATION_ERROR` instead of `500`.
- Login without a password now returns `VALIDATION_ERROR` instead of `WEAK_PASSWORD`
  (only registration enforces a password policy, as documented in `openapi.yaml`).
- Missing `globals` dev dependency added.

[0.1.0]: https://github.com/<owner>/<repo>/releases/tag/v0.1.0
