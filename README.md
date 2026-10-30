# Fieldnotes baseline template

Two versions of **Fieldnotes**, a small blog, plus a Node HTTP content API.

## Run locally

This directory is a standalone npm project. Run all commands below from this directory. Requires Node.js 24.12+ and npm. Install with `npm ci`.

For React, start the API and frontend in separate terminals:

```sh
npm run dev:api
```

```sh
npm run dev:react
```

Open http://127.0.0.1:5173. API changes restart the Node process; frontend changes use Vite hot reloading. The API listens on http://127.0.0.1:3001.

For the generated static site:

```sh
npm run dev:static
```

Open http://127.0.0.1:4173. This builds once; rerun after editing content or templates. No running API is needed after generation.

Build and verify:

```sh
npm run build
npm run check
```

The static build starts a temporary API on an available localhost port, fetches content, then stops it. To use an already running API instead, set `API_ORIGIN=http://127.0.0.1:3001` for the build command. Builds need permission to bind localhost ports.

For production previews, run these in separate terminals:

```sh
npm run serve:api
npm run serve:react
npm run serve:static
```

React preview is http://127.0.0.1:4174; static preview is http://127.0.0.1:4173. Use production builds to avoid Vite's development traffic. The React preview requires the API; static preview does not.

## Architecture

|                    | Generated static site                  | React SPA                                     |
| ------------------ | -------------------------------------- | --------------------------------------------- |
| Rendering          | Complete HTML generated for every page | React 19 client rendering                     |
| Navigation         | Ordinary links, full document requests | React Router 7 data router, client navigation |
| Article data       | Fetched from API during build          | Fetched from API in route loaders at runtime  |
| Backend dependency | Build time only                        | Required for journal and article visits       |
| Build output       | `apps/static/dist/`                    | `apps/react/dist/`                            |

Both have the same text, layout, artwork, titles, and descriptions. About and Contact remain static content. The backend owns article content in `apps/api/posts.ts`; shared site metadata and static-page text live in `shared/content.ts`. React bundles do not contain article bodies.

The API uses Node's built-in HTTP server and an in-memory SQLite database seeded from the article content; there is no authentication. This gives the app genuine HTTP requests and response/error handling without adding unnecessary infrastructure. React loaders forward navigation abort signals. A missing post renders the not-found page; an unavailable API renders the route error page. Initial loading feedback, navigation feedback, focus management, and scroll restoration are included.

### API

| Endpoint               | Response                               |
| ---------------------- | -------------------------------------- |
| `GET /api/health`      | Health status                          |
| `GET /api/posts`       | Post summaries, without article bodies |
| `GET /api/posts/:slug` | Complete article; 404 if absent        |

HEAD is supported. Other methods return 405. Responses are JSON with caching disabled for repeatable local requests. No data is written.

React requests relative `/api/...` URLs. Vite and the production preview proxy those requests to `http://127.0.0.1:3001`; set `API_ORIGIN` to change the target. Set `PORT` to change the API port and update `API_ORIGIN` accordingly. A single origin avoids browser CORS setup. The production proxy forwards request headers.

A static generator naturally uses a backend at build time, but browser visits to the resulting HTML do not call it. React fetches content at runtime during browser visits.

## Routes and hosting

- `/` — four post previews
- `/posts/a-little-less-but-better/`
- `/posts/taking-the-long-way-home/`
- `/posts/building-for-the-web-we-use/`
- `/posts/a-website-worth-taking-time-for/` — long article
- `/about/`
- `/contact/`
- Unknown paths — not-found page

Generated pages work without JavaScript. Static hosting should serve directory `index.html` files and `404.html` with HTTP 404 for unknown paths. React hosting must proxy `/api/*` to the backend before applying the document fallback to `index.html`; missing assets must retain HTTP 404. Unknown React document URLs return the shell with HTTP 200 and render a not-found view. The included preview server implements these rules locally.

## Validation and scope

`npm run check` requires both builds. It checks routes, static internal links, fallback behavior, missing assets, lazy route chunks, absence of bundled article bodies, API responses, and the React data-fetching helpers through the production proxy, including errors and cancellation. It does not replace browser interaction testing.

No external fonts or images are included. Contact has a labeled `.example` email placeholder and does not submit messages.

```text
apps/api/          Node HTTP API and article repository
apps/static/       HTML generator; no browser JavaScript
apps/react/        Vite + React + React Router application
shared/            Site metadata, static-page text, CSS
scripts/           Production preview server and checks
```

## TypeScript and formatting

Requires Node.js 24.12+ for native execution of the TypeScript backend, scripts, and tests. Vite compiles React TSX; generated browser assets remain JavaScript. `tsconfig.json` enables strict checking without emitting extra files.

```sh
npm run typecheck
npm run format
npm run format:check
```

Run type checking separately from builds: Vite and Node strip types but do not check them. Prettier configuration is included in this project so a copied experiment remains standalone. Keep it consistent with the repository's root configuration. Generated output, dependencies, lockfiles, and environment files are excluded from formatting.

## Controlled API latency

Every fourth successful GET across `/api/posts` and `/api/posts/:slug` waits one second using an asynchronous timer. The counter belongs to each API server and resets on restart. Health checks, HEAD requests, 404s, and unsupported methods are excluded. Other requests can complete while the timer is waiting.

Delayed responses include `Server-Timing: artificial_delay;dur=...` with the measured wait in milliseconds. Browser request timing includes the delay.

React visits call the API at runtime. Generated static pages remain standalone: their generator encounters this latency at build time, while ordinary static page visits do not call the content API. Restart running APIs after changing the server code (the root launcher uses production processes without hot reload).

## Database and content-size delay

Post summaries and individual articles come from a real SQLite database (`apps/api/database.ts`). Each API process seeds its own in-memory database at startup; no external database service or persistent data files are required. Node 24's built-in `node:sqlite` currently prints an experimental-feature warning.

Every successful article GET executes a parameterized SQL SELECT. The simulated materialization cost uses the UTF-8 size of the paragraphs: `ceil(max(0, bodyBytes - 2048) / 512) * 100` milliseconds. This models a fast inline path and constrained chunk processing; the wait is deliberately simulated, not actual SQLite execution time. Summary queries, HEAD checks, and missing records have no content-size delay.

The three original posts fit within 2 KiB and add zero content-size delay. The new 1,992-word article (about 10× the longest original) is 12,047 bytes and adds 2,000 ms. The existing one-in-four 1,000 ms delay still applies independently, so a long article request can take about three seconds. Neither wait blocks unrelated HTTP requests.

`Server-Timing` exposes `db_read`, `content_read`, and, when applicable, `artificial_delay`. Static generation reads the same database through its build-time API; static browser visits remain pre-generated HTML.

## Safari user-agent penalty

Article GETs identified as Safari add a deliberate 1,000 ms penalty on top of the size model. Short posts therefore cost 1 second and the long post 3 seconds for Safari, versus 0 and 2 seconds for other agents. The periodic fourth-request delay still adds another second independently. Health checks, HEAD, and summaries do not pay the Safari penalty.

The match requires `Version/` and `Safari/` and excludes Chrome, Chromium, Edge, Firefox, Opera, and Android browser identifiers. `Server-Timing` separates `content_read`, `safari_penalty`, and `artificial_delay`. The penalty is an intentional simulated regression.
