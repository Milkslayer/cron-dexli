# cron · dexli.dev

Cron expression parser — paste a schedule, see when it fires next.
Part of the [dexli.dev](https://dexli.dev) tiny-tools family.

The product is a pure function of the URL: a cron expression in the path or
query becomes a list of next-fire timestamps in the response. No accounts,
no secrets, no per-user state — every URL is bookmark-friendly and the
back-button always renders the previously-computed schedule.

## Quick start

The whole product fits in one Docker command:

```sh
docker build -t cron .
docker run --rm -p 3000:3000 cron
```

Open <http://localhost:3000>.

For local development without Docker:

```sh
npm install
npm run dev   # http://localhost:5173 with HMR
```

## Configuration

Every operator-tunable value defaults to a safe setting and is overridable
via environment variables (see `.env.example` for the full list with
defaults inline).

| Variable          | Default   | Notes                                                                     |
| ----------------- | --------- | ------------------------------------------------------------------------- |
| `PORT`            | `3000`    | Bind port for the Node server (read by adapter-node).                     |
| `HOST`            | `0.0.0.0` | Bind interface. Use `127.0.0.1` for loopback-only behind a same-host proxy. |
| `PUBLIC_BASE_URL` | _(unset)_ | Public origin used server-side for absolute share URLs. When unset, the server derives the origin from the incoming request. Must be an origin only (no path). |

Misconfiguration is loud — an unparseable or out-of-bounds env value throws
at startup so a typo fails fast.

## Deploy

The runtime is a single self-contained Node container with no external
dependencies. Anywhere that can run a container will work — Dokploy, Fly,
Railway, a plain VPS with Docker, etc.

For production behind Cloudflare, set `PUBLIC_BASE_URL` to the canonical
hostname so share URLs honor the operator's origin rather than re-deriving
from request-scoped headers.

## Scripts

| Script          | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Vite dev server with HMR.            |
| `npm run build` | Production build (adapter-node).    |
| `npm run start` | Run the built output (`node build`). |
| `npm run check` | `svelte-kit sync` + `svelte-check`.  |
| `npm test`      | Vitest, one-shot.                    |

## License

UNLICENSED — pending decision at first public push.
