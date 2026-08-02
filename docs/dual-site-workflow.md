# Shared Hetzner deployment workflow

The portfolio and Metamorphysis are separate production applications on the
same server. Keep their repositories, Compose projects, databases, networks,
environment files, and release identities separate.

| Site | Checkout | Health check | Deploy |
| --- | --- | --- | --- |
| Portfolio | `/home/codexdiag/portfolio` | `http://127.0.0.1:3101/api/health?db=1` | `bash scripts/deploy-prod.sh` |
| Metamorphysis | `/root/repo` | `http://127.0.0.1:3000/api/health` | `./scripts/deploy-prod.sh` |

## Before deployment

Inspect both repositories and running containers. Deploy only one application
at a time, and do not run a deployment while the shared Caddy edge helper is
running.

```bash
git -C /home/codexdiag/portfolio status --short
git -C /root/repo status --short
docker ps --format '{{.Names}} {{.Status}}'
```

The portfolio deploy helper requires a completely clean portfolio checkout.
Commit reviewed scripts and documentation before using the helper. Do not make
the guard pass with `git reset --hard`, deletion of untracked files, or a broad
stash.

Metamorphysis may show two intentional portfolio edge artifacts in its status:
the marked portfolio block in `/root/repo/Caddyfile` and
`/root/repo/docker-compose.portfolio-edge.yml`. The Metamorphysis deploy helper
validates and ignores only those exact artifacts; every other dirty path is a
hard stop.

## Normal release commands

Portfolio:

```bash
cd /home/codexdiag/portfolio
bash scripts/deploy-prod.sh
```

Metamorphysis:

```bash
cd /root/repo
./scripts/deploy-prod.sh
```

Both helpers show the release identity and require the literal confirmation
`DEPLOY`. Use migration flags only for reviewed, forward-only schema changes
after the relevant migration rehearsal. Neither helper changes DNS. Caddy is
owned by the Metamorphysis edge boundary; use the portfolio edge helper only
for hostname and network configuration.

## Post-deployment checks

```bash
curl --fail --silent --show-error http://127.0.0.1:3101/api/health?db=1
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
curl --silent --output /dev/null --write-out 'portfolio -> %{http_code}\n' https://matthewflorek.com/
curl --silent --output /dev/null --write-out 'metamorphysis -> %{http_code}\n' https://metamorphysis.ai/
```

If an application check fails, inspect its container logs and release identity
before touching DNS or Caddy. Record the release SHA, backup path, health
results, and any edge changes.
