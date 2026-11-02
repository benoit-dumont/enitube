# ENITube

A mini-YouTube: search videos, watch them in an embedded player and organize them into playlists.
Email + password authentication.

## Features

- Sign up / sign in with email and password (bcrypt + JWT)
- Video search (loading / empty / error / results states)
- Embedded player with limited metadata (thumbnail, title, channel, views, description)
- Playlists: create, rename, delete, add and remove videos, play a video
- Protected layout: header, sidebar (Search, My playlists) and route guard

Out of scope: upload, likes, comments, subscriptions, PWA, i18n, refresh tokens, SSO.

## Stack

| Layer    | Choice                                                                        |
| -------- | ----------------------------------------------------------------------------- |
| Front    | Angular 22 (standalone, zoneless, signals), Tailwind v4, lazy routes          |
| Back     | Node + Express 5 + TypeScript, zod validation                                 |
| Database | MySQL 8 (utf8mb4) through Sequelize 7 (`@sequelize/core`, alpha, pinned)      |
| Auth     | bcrypt + JWT, token kept in `sessionStorage`                                  |
| Videos   | Swappable provider: local catalog (default) or YouTube Data API v3 (optional) |

## Project layout

```text
enitube/
├── api/      Express API (routes → controllers → services → models), openapi.yaml
├── web/      Angular app
├── shared/   Types shared by api and web
└── docs/     API contract and decisions
```

## Quick start (about 10 minutes)

### Prerequisites

Node.js >= 20, npm, Docker (for MySQL).

### 1. Database

```bash
docker compose up -d
```

### 2. API

```bash
cd api
cp .env.example .env     # then fill in the values below
npm install
npm run dev              # http://localhost:3000
```

Minimum values to set in `api/.env`:

| Variable              | Example / note                                      |
| --------------------- | --------------------------------------------------- |
| `MYSQL_BDD`           | `enitube`                                           |
| `MYSQL_USER`          | `enitube`                                           |
| `MYSQL_PASS`          | any password (same as in your MySQL container)      |
| `MYSQL_ROOT_PASSWORD` | any password                                        |
| `MYSQL_HOST`          | `127.0.0.1`                                         |
| `MYSQL_PORT`          | `3307`                                              |
| `JWT_SECRET`          | at least 32 characters, e.g. `openssl rand -hex 32` |
| `ALLOWED_ORIGIN`      | `http://localhost:4200`                             |

Tables are created automatically at startup. `VIDEO_PROVIDER` defaults to `catalog`
(24 real YouTube videos, no API key and no quota).

API reference: <http://localhost:3000/reference> (OpenAPI spec at `/openapi.json`).
Published docs: <https://OWNER.github.io/REPO/> (deployed from `main` by the CI).

### 3. Web

```bash
cd web
npm install
npm start                # http://localhost:4200
```

The dev server proxies `/api` to `http://localhost:3000`.

### 4. Try it

Open <http://localhost:4200>, create an account, search for "rick", open a video,
add it to a playlist, then remove it from **My playlists**.

## Using the YouTube provider (optional)

1. Create a Google Cloud project and enable **YouTube Data API v3** (restrict the key to that API).
2. In `api/.env`:

   ```env
   VIDEO_PROVIDER="youtube"
   YOUTUBE_API_KEY="your-key"
   ```

The key stays server-side and is only required when `VIDEO_PROVIDER=youtube`.
A search costs 100 quota units out of 10,000 per day.

## Tests and quality

API integration tests run against a **disposable** database that is wiped on every run.
Its name must end with `_test`, otherwise the tests refuse to start.

```bash
cd api
cp .env.test.example .env.test   # fill in MYSQL_USER / MYSQL_PASS
npm test
npm run lint && npm run typecheck && npm run build
```

```bash
cd web
npm test && npm run lint && npm run build
```

## Security rules

- No secret is committed: `.env` is git-ignored, `.env.example` is committed.
- All queries go through Sequelize (parameterized); no concatenated SQL.
- Playlists are always filtered by the `userId` from the JWT, never by a client-supplied id.
- Video ids are validated with `/^[\w-]{11}$/`; the player iframe uses `youtube-nocookie.com`.

## Git workflow

`feat/*` → PR → `dev` → release PR → `main` (tags). `main` and `dev` are protected
(PR, 1 reviewer, green CI). Commits follow `<gitmoji> | <type>: <description>`.

## License

MIT
