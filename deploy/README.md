# Deploying Recall on one Linux box

Six long-running containers behind one nginx, reachable through one ngrok tunnel.

```
                    ┌───────────────────────────────────────────────┐
  internet          │  docker network `recall`                      │
     │              │                                               │
     │  https        │   ┌───────┐  /api /app /public /mcp /docs     │
     └──▶ ngrok ────▶│──▶│ nginx │──┬──▶ api:8767 ──┬──▶ postgres    │
          (agent)   │   └───────┘  │               ├──▶ minio       │
                    │              │               └──▶ mailpit     │
                    │              ├──▶ web:3000 ──────▶ api        │
                    │              └──▶ bot:8768  ──────▶ api       │
                    │                   /telegram/                  │
                    └───────────────────────────────────────────────┘
```

Nothing but the ngrok agent talks to the outside, and nothing but the api talks
to Postgres or MinIO.

## Files

| Path | What it is |
| --- | --- |
| `docker-compose.deploy.yml` | The whole stack. Repo root, next to the dev `docker-compose.yml`. |
| `deploy/Dockerfile` | One multi-stage build, one target per app (`api`, `web`, `bot`, `mcp`, `migrate`). |
| `deploy/nginx/recall.conf` | The routing table. Mounted as `conf.d/default.conf`. |
| `deploy/nginx/proxy.conf` | The proxy headers every location shares. |
| `deploy/ngrok/ngrok.yml` | Binds the ngrok inspector to `0.0.0.0:4040` so it can be published. |
| `deploy/env.example` | Template for `.env.deploy`. |
| `deploy/stack` | `docker compose --env-file .env.deploy -f docker-compose.deploy.yml …` |
| `deploy/remote` | the same stack, driven over SSH from another machine |

## First run

```sh
cp deploy/env.example .env.deploy
$EDITOR .env.deploy                 # PUBLIC_HOST, NGROK_AUTHTOKEN, and every empty value
deploy/stack up -d --build --wait
```

`--wait` returns only once nginx is healthy, which means the api answered
`/health/ready`, the web app rendered a page and the migrations succeeded. If it
does not return, `deploy/stack ps` names the service that is unhealthy and
`deploy/stack logs <service>` says why.

Then, in Telegram, `/start` the bot and press the login button, or open
`https://$PUBLIC_HOST/sign-up` and register. Whoever registers first is a normal
owner — ownership is resolved from the session, so a second account starts empty
and can never see the first one's rows.

Day to day:

```sh
deploy/stack ps
deploy/stack logs -f api
deploy/stack up -d --build          # after a `git pull`
deploy/stack down                   # keeps the volumes
```

## Get a reserved ngrok domain first

`PUBLIC_HOST` is the single source of truth for the public origin. Five separate
contracts are derived from it — the Better Auth base URL and trusted origin, the
cookie's secure/`SameSite` behaviour, the MCP OAuth issuer, the MCP allowed-host
allowlist, and Telegram's webhook target. A random ngrok URL changes on every
restart and breaks all five at once, so claim the free static domain on the ngrok
dashboard and put it in `PUBLIC_HOST` before the first start.

## Operating it from your MacBook

You do not SSH into the containers — you SSH into the host and drive Docker,
either there or from your Mac. Putting `sshd` inside an image means a second
process to supervise, a second set of credentials to rotate, and a home
directory that vanishes on the next `--build`; `docker exec` is the supported
door and it needs nothing installed.

### On the server, once

```sh
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
sudo usermod -aG docker "$USER"          # then log out and back in
```

The docker group matters: without it every remote Docker command fails with
`permission denied … /var/run/docker.sock`.

An old laptop also has to be told not to sleep with the lid shut, or the tunnel
and your SSH session both disappear:

```sh
sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

### On the Mac, once

```sh
ssh-keygen -t ed25519 -C macbook        # skip if you already have a key
ssh-copy-id oleksandr@192.168.1.42
```

Then give it a name in `~/.ssh/config`, which is what everything below assumes:

```
Host recall-server
    HostName 192.168.1.42
    User oleksandr
    ServerAliveInterval 30
    ServerAliveCountMax 3
    ControlMaster auto
    ControlPath ~/.ssh/control-%r@%h:%p
    ControlPersist 5m
```

`ServerAliveInterval` is what stops a `logs -f` from hanging dead after a
network hiccup; `ControlMaster` makes every command after the first instant
because they share one connection. Once keys work, turn passwords off:

```sh
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### `deploy/remote`

Run it from a checkout on your Mac — it needs no `.env.deploy` and no
credentials locally, because every command reads what it needs out of the
containers' own environment.

| Command | What it does |
| --- | --- |
| `deploy/remote status` | every `recall-*` container, its state and health |
| `deploy/remote logs api` | follow a service's logs (`web`, `bot`, `nginx`, `ngrok`, `postgres`, …) |
| `deploy/remote logs api 1000` | …starting from the last 1000 lines |
| `deploy/remote sh api` | root `bash` inside a container |
| `deploy/remote psql` | interactive `psql` on the deployment database |
| `deploy/remote sql "select count(*) from pages;"` | one statement, printed |
| `deploy/remote sql -f local.sql` | run a local `.sql` file against the server |
| `deploy/remote tunnel` | forward the loopback services to your Mac |
| `deploy/remote stack up -d --build` | run `deploy/stack` on the server |
| `deploy/remote ssh` | a plain shell on the host |

It takes the host from `RECALL_SSH` (default `recall-server`) and the checkout
path from `RECALL_REMOTE_DIR` (default `recall-quiz`, relative to your home
directory there):

```sh
RECALL_SSH=oleksandr@192.168.1.42 RECALL_REMOTE_DIR=/srv/recall deploy/remote status
```

`psql` and `sql` read the role and database from the container's own
`POSTGRES_USER` / `POSTGRES_DB`, so they stay correct even if you change them in
`.env.deploy` — and no password ever leaves the server.

### Or make every docker command remote

For ad-hoc work, register the server as a Docker context and your normal
commands just work from the Mac:

```sh
docker context create recall --docker "host=ssh://recall-server"
docker context use recall

docker ps
docker logs -f recall-api
docker exec -it recall-postgres psql -U recall recall
docker stats
```

`docker context use default` puts you back on your Mac's own daemon. This is
what makes the fixed container names (`recall-api`, `recall-postgres`, …) worth
having: no compose file, no repo path, no `-f` flag.

Lifecycle commands are the exception — keep `up`, `build` and `down` on the
server (`deploy/remote stack …`). They need the compose file, the build context
and the bind-mounted nginx config, all of which live in the server's checkout.

### GUI tools over the tunnel

Every supporting service is bound to the server's loopback, so nothing is
reachable until you forward it. `deploy/remote tunnel` forwards all of them at
once, on deliberately shifted local ports so it cannot collide with a dev stack
running on your Mac:

| On your Mac | On the server | Use it for |
| --- | --- | --- |
| `127.0.0.1:15432` | postgres | TablePlus, DataGrip, `psql`, `bun run db:migrate` |
| `127.0.0.1:15090` | minio s3 api | `mc`, an S3 client |
| `http://127.0.0.1:15091` | minio console | browsing uploaded images |
| `http://127.0.0.1:15026` | mailpit | reading password-reset mail |
| `http://127.0.0.1:14040` | ngrok inspector | seeing the exact headers the tunnel sends |
| `http://127.0.0.1:18080` | nginx | hitting the stack without the tunnel |

The ngrok inspector is the one to reach for when something works on the LAN and
not through the tunnel — it shows the real `Host` and `X-Forwarded-*` on every
request.

Signing in through `127.0.0.1:18080` will not work, and that is correct: the
session cookie is `__Secure-`-prefixed, so the browser refuses to send it over
plain HTTP. Use the ngrok URL for anything involving a session.

### Debugging inside these images

They are deliberately lean — no `curl`, no `wget`, no `ps`. What they do have is
a language runtime, which is better anyway:

```sh
deploy/remote sh api
node -e 'fetch("http://127.0.0.1:8767/health/ready").then(r => r.text()).then(console.log)'

deploy/remote sh web
bun -e 'console.log(await (await fetch("http://api:8767/health/live")).text())'
```

`sh` enters as root, so you can `apt-get install -y curl` inside a container if
you really need to — it lasts until the next `--build`, which is the point.

### Away from home

Do not forward port 22 from your router. Put
[Tailscale](https://tailscale.com/download) on both machines — `tailscale up` on
each — and point the SSH alias at the tailnet name instead:

```
Host recall-server
    HostName recall-server.your-tailnet.ts.net
```

Everything above then works unchanged from anywhere, and the server keeps no
open ports on the internet except the ngrok tunnel it dials out itself.

## The routing table

nginx owns the split. Everything not listed here goes to the web app, which is
why `/`, `/sign-in`, `/quizzes/:id`, `/p/:token` and `/assets/*` work unchanged.

| Path | Goes to | Why |
| --- | --- | --- |
| `/api/**` | api | Better Auth at `/api/auth/*`, plus the react-admin REST surface when `ADMIN_PASSPHRASE` is set. |
| `/app/**` | api | The session-cookie surface, including `/app/uploads`. |
| `/public/**` | api | Shared pages and their images, read by share token. |
| `/mcp` | api | Its own location: buffering off, 180s read timeout. |
| `/.well-known/**`, `/authorize`, `/token`, `/register`, `/revoke`, `/consent` | api | The MCP SDK mounts its OAuth endpoints at the root. Only live when `MCP_OAUTH_ISSUER` is set. |
| `/docs`, `/docs-json`, `/docs-yaml` | api | Swagger. Drop `docs\|docs-json\|docs-yaml` from that location's regex in `recall.conf` if you would rather it were not public — it publishes the whole route surface, including `/bot/**`, which nginx then refuses anyway. |
| `/health/**` | api | |
| `/telegram/**` | bot | The webhook. The bot 404s any path but its own and 403s a wrong secret. |
| `/bot/**` | **404** | An internal RPC surface guarded by `BOT_API_TOKEN`. The bot reaches it over the docker network, so it has no business on the tunnel. |
| `/healthz` | nginx | The container's own healthcheck. |
| everything else | web | |

Two consequences worth knowing.

**`/quizzes` is the web app's, not the api's.** The api also mounts a legacy
`GET /quizzes` and `GET /quizzes/:id` behind `InstanceOwnerGuard`, which
authenticates nothing — it just names the instance owner as the principal.
Nothing in the repo calls it, and the web app owns `/quizzes/:id`, so nginx
sends that prefix to the web. That is deliberate: routing it to the api would
have published the owner's whole quiz list to anyone with the URL.

**`proxy_pass` never rewrites the path.** Every location passes
`$upstream$request_uri`, so the app sees the URI the client sent. This matters
for the bot, which compares `url.pathname` to its configured webhook path
exactly, and for `/app/uploads/<id>` paths already stored inside saved markdown.

## What the containers are

| Service | Base image | Runs |
| --- | --- | --- |
| `api` | `node:22-slim` | `node apps/api/dist/main.js`. Really Node — nothing under `apps/api/src` may use a Bun global. |
| `web` | `oven/bun:1.4.0-slim` | `bun run ./server/index.mjs`, the Nitro `bun`-preset output. Self-contained; no runtime `node_modules`. |
| `bot` | `oven/bun:1.4.0-slim` | `bun run ./main.js`, a single bundled file from `bun build --target bun`. |
| `mcp` | `oven/bun:1.4.0-slim` | The stdio bridge. Not started by `up` — see below. |
| `migrate` | the build stage | `drizzle-kit migrate`, once, before the api starts. |

The api is the only image that needs `node_modules`, because there is no
bundler in its build — `tsc` output still imports `@recall/kit` and
`@recall/contracts`. It gets its own
`bun install --frozen-lockfile --production --filter '@recall/api'` tree plus
the two packages' built `dist`. The `--filter` matters: a plain workspace
install drags in `apps/admin`'s `@mui/icons-material` and `apps/web`'s
`lucide-react`, which the api cannot reach and which more than double the image
(774 MB with it, 1.25 GB without). `--frozen-lockfile` survives the filter, so
the api still runs the exact versions the test suite ran against.

`migrate` is the fattest image at 1.6 GB because it *is* the build stage. It
runs for a second and exits, and its layers are shared with the build cache, so
it costs disk rather than anything else.

### The web app's api origin is baked in at build time

`apps/web` talks to the api through server functions, with one exception:
image uploads and `<img>` sources need a real browser request, so
`uploads.constants.ts` reads `import.meta.env.VITE_API_ORIGIN`, which Vite
inlines into the client bundle. The build passes it as `""`, which makes those
URLs relative and therefore same-origin through nginx — no CORS, no origin baked
into a bundle that would rot the moment the domain changes. `deploy/Dockerfile`
fails the build if `127.0.0.1:8767` survives into `.output/public/assets`.

Leave the default in the source alone: split-port local development
(`bun run up`) still needs it.

### Migrations

`migrate` is a one-shot service and the api waits on
`service_completed_successfully`, so a failed migration stops the deploy instead
of starting an api against the wrong schema. It runs from the build stage
because `drizzle-kit` is a devDependency and its config is TypeScript, neither
of which survives into the api's production image.

To re-run it by hand: `deploy/stack run --rm migrate`.

### The MCP bridge

MCP over HTTP is the api's `/mcp`, routed through nginx, and that is what
claude.ai and ChatGPT use. `apps/mcp` is a different thing: a stdio↔HTTP bridge
that a local MCP client spawns as a child process. It has no listening socket,
so it cannot be part of `up` and sits behind a compose profile.

For a client running on the server itself:

```json
{
  "command": "docker",
  "args": [
    "compose", "--env-file", "/srv/recall/.env.deploy",
    "-f", "/srv/recall/docker-compose.deploy.yml",
    "run", "--rm", "-T", "mcp"
  ]
}
```

For a client on your laptop, skip the bridge and point the client straight at
`https://$PUBLIC_HOST/mcp` with `MCP_HTTP_TOKEN` as the bearer token, or set up
OAuth with `MCP_OAUTH_ISSUER` + `MCP_OAUTH_PASSPHRASE`.

If you set `MCP_HTTP_ALLOWED_HOST`, it must list **every** host `/mcp` is
reached as. DNS-rebinding protection compares the `Host` header verbatim, and
the bridge container sends `Host: api:8767`, not the public name:

```
MCP_HTTP_ALLOWED_HOST=recall.ngrok.app,api:8767
```

## Headers, and why they are set the way they are

`deploy/nginx/proxy.conf` is short but every line earns its place.

- **`Host $host`** passes the public hostname through. ngrok preserves the
  original `Host`; nginx would otherwise replace it with the upstream's name and
  MCP's allowed-host check would reject every request.
- **`X-Forwarded-Proto`** prefers ngrok's value and falls back to `$scheme`.
  Deriving it from `$scheme` alone would report `http`, because the ngrok agent
  reaches nginx over plain HTTP inside the network.
- **`X-Recall-Client-IP ""`** deletes the header. Better Auth reads it *before*
  `x-forwarded-for` when bucketing rate limits, so a public caller who could set
  it would pick their own bucket. The web app still generates a trusted copy on
  its own server-to-server calls, which never pass through nginx.
- **`X-Forwarded-For $proxy_add_x_forwarded_for`** keeps the real client first
  in the list. `TRUST_PROXY=on` on the web service is what makes it read that.
- **`set_real_ip_from`** trusts private ranges only, so nginx's own logs name
  the real client.

Which is also why nginx is published on loopback by default: a caller who can
reach it directly can forge all of the above.

## Backups

`bun run backup` and `bun run restore` still work from the host. They drive
`docker exec` / `docker cp` against the container names `recall-postgres` and
`recall-minio`, which this stack deliberately keeps.

```sh
bun run backup                      # backups/<UTC stamp>/{postgres.sql,minio/}
bun run restore --yes               # newest backup
```

One catch: both read the Postgres **role and database name** out of
`DATABASE_URL` — the root `.env`, not `.env.deploy` — falling back to
`recall`/`recall`. Keep `POSTGRES_USER` and `POSTGRES_DB` at their defaults and
they need no configuration at all. Change either and pass it in:

```sh
DATABASE_URL=postgres://myuser:whatever@127.0.0.1:55432/mydb bun run backup
```

The password is not used — `pg_dump` runs inside the container as a local
socket connection.

Migrations are the `migrate` service's job, not `bun run db:migrate`'s. That
root script reads its configuration through `bun run --filter`, and the drizzle
config falls back to the dev compose URL when it sees none, so it will happily
migrate the wrong database. Use `deploy/stack run --rm migrate`.

## Three things that will surprise you

**`/mcp` answers 500 until somebody has linked a Telegram account.** The static
`MCP_HTTP_TOKEN` resolves to the *instance owner*, and the instance owner only
exists once `ALLOWED_TELEGRAM_USER_ID` has been through the bot's login flow —
before that, `AuthService.instanceOwner()` throws `InstanceHasNoOwnerError` and
the MCP sub-app reports it as `{"error":"server_error"}`. Send `/login` to the
bot once and it starts working. A personal token (`recall_pat_…`) carries its
own owner and does not need this.

**This stack does not share the dev stack's data.** Its volumes are named
`recall-postgres-data` and `recall-minio-data`; `bun run db:up` uses
project-scoped volumes with different names. Moving existing data across is
`bun run backup` under the old stack, then `bun run restore --yes` under this
one. Do not run both stacks at once either — they claim the same container names
and the same host ports.

**ngrok's free plan shows an interstitial** on the first HTML navigation per
browser session, and the visitor has to click through. It does not affect
Telegram, MCP clients or `fetch`, since it only triggers on requests that look
like browser navigations. A paid plan or a custom domain removes it.

## What was actually exercised

Run end to end on this stack, through nginx, before it was handed over:

- Every route in the table above lands on the service it should — checked by the
  answering service, not the status code (`X-Powered-By: Express` for the api, a
  chunked HTML body for the web app, `Server: nginx` with no app header for the
  `/bot/**` refusal).
- Sign-up, sign-in and `get-session`. The cookie comes back as
  `__Secure-better-auth.session_token`, so `useSecureCookies` did pick up the
  `https://` base URL. `POST /app/browse` is 200 with it and 401 without.
- A 5 MiB-class multipart upload: `POST /app/uploads` → 201 into MinIO,
  `GET /app/uploads/<id>` → 200 `image/png` with a session and 401 without. The
  response body carries the **relative** `/app/uploads/<id>`, which is what the
  empty `VITE_API_ORIGIN` needs.
- `/mcp` `initialize` and `tools/list` → 27 tools, both through nginx and
  through the stdio bridge container. A wrong bearer token is 401.
- DNS-rebinding protection: with `MCP_HTTP_ALLOWED_HOST` set, a forged
  `Host: evil.example.com` is 403, the real host is 200, and the bridge is 403
  until `api:8767` is added to the list — which is where that advice comes from.
- The header contract, against an echo upstream using the shipped `proxy.conf`:
  `Host` and `X-Forwarded-Host` preserved, `X-Forwarded-Proto` taking ngrok's
  `https` over `$scheme`, the real client first in `X-Forwarded-For`, and a
  caller-supplied `X-Recall-Client-IP` deleted. `$request_uri` reaches every
  upstream unrewritten, query string included.
- `migrate` run twice — the second run is a no-op that still exits 0.
- nginx boots and serves `/healthz` with every app container stopped, and
  returns 502 for that app rather than refusing to start. This is what the
  `resolver` plus variable `proxy_pass` buy.

- Every `deploy/remote` subcommand, against stub `ssh` and `docker` binaries
  that print their argv — the quoting holds, and `$POSTGRES_USER` stays
  single-quoted so it expands inside the container rather than on your Mac. The
  `psql` form was then run for real against a live postgres container and
  reported back `recall | recall` without being told either.

Not verifiable off the target box: the ngrok tunnel itself, and SSH. The agent was run
with the real command and config (`ngrok config check` passes, `--url` is
accepted) and got as far as `ERR_NGROK_105` on a deliberately fake authtoken.

## Things this deployment does not fix

Found while wiring it up, left alone because they need application changes:

- **`/health/ready` is not readiness.** It returns `{status:"ok"}` without
  checking Postgres or MinIO, so it proves only that the process answers. The
  compose healthchecks on `postgres` and `minio` are what actually gate startup.
- **A bot restart drops queued updates.** In webhook mode the bot calls
  `setWebhook(..., { drop_pending_updates: true })` on every start, so messages
  that arrive during a deploy are discarded.
- **JSON request bodies are capped near 100 KB** by the default
  `express.json()` in both `api.factory.ts` and the MCP sub-app. `nginx`'s
  `client_max_body_size 8m` covers the 5 MiB image upload but cannot raise that
  ceiling; a very large MCP write can still 413.
