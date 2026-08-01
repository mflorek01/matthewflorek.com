# Reviewed Caddy snippets

These snippets are reviewed configuration, not an instruction to edit the live
root-owned Caddy checkout. The operator must compare the active configuration
with the Metamorphysis deployment before applying anything.

## Required portfolio route

The active Metamorphysis Caddy runs inside Docker. Its `127.0.0.1` is the
Caddy container, not the Hetzner host, so the host-published portfolio port
must not be used as the upstream from that container. Before applying this
route, attach the Caddy service to the externally named Docker network
`portfolio_private` created by `compose.yml` and verify that the service alias
`portfolio` resolves from the Caddy container.

```caddyfile
matthewflorek.com {
    encode zstd gzip

    # Keep this policy aligned with the deployed Umami script origin. If the
    # script URL changes, update script-src and connect-src together.
    header {
        # Next.js requires its inline bootstrap data for the initial render.
        Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline' https://analytics.matthewflorek.com; connect-src 'self' https://analytics.matthewflorek.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data: https:; frame-src 'none'"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }

    # Conservative edge limits. Uploads allow multipart overhead around the
    # application's 10 MB asset limit; all other portfolio requests are 2 MB.
    request_body {
        max_size 2MB
    }
    @portfolio_login path /api/auth/login
    @portfolio_chat path /api/chat
    @portfolio_integration path /api/admin/integrations/metamorphysis /api/admin/integrations/metamorphysis/*
    @portfolio_upload path_regexp portfolio_upload ^/api/admin/projects/[^/]+/assets$
    request_body @portfolio_login {
        max_size 32KB
    }
    request_body @portfolio_chat {
        max_size 64KB
    }
    request_body @portfolio_integration {
        max_size 256KB
    }
    request_body @portfolio_upload {
        max_size 12MB
    }

    reverse_proxy portfolio:3000
}
```

## Canonical `www` redirect

```caddyfile
www.matthewflorek.com {
    redir https://matthewflorek.com{uri} permanent
}
```

The redirect is intentionally separate from the application route. It keeps a
single canonical origin for analytics, search indexing, and shared links.

## Required public Umami tracker route

Add this block after Umami is running and its dashboard account has been
created. The tracker script and collection endpoint must be reachable by
visitors, but the dashboard does not need to be public. Attach Caddy to the
externally named `portfolio_umami_private` network and verify that the service
alias `umami` resolves from the Caddy container.

```caddyfile
analytics.matthewflorek.com {
    encode zstd gzip
    header {
        Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'none'"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
    request_body {
        max_size 64KB
    }

    # Publish only the browser tracker and its collection endpoint. Keep the
    # dashboard and administrative API available through an SSH tunnel.
    @umami_tracker path /script.js /api/send
    handle @umami_tracker {
        reverse_proxy umami:3000
    }
    respond 404
}
```

Access the dashboard through an operator-controlled tunnel or local
port-forward. Publishing the full dashboard requires a separate, explicit
security decision and is not part of the launch configuration.

## Optional staging route

Staging should not be exposed by default. Prefer a loopback-only staging app
and browser validation on the server or through an authenticated tunnel. If a
temporary hostname is required, use a hostname that is not indexed and apply
an authentication layer before the route is reachable from the internet:

```caddyfile
staging.matthewflorek.com {
    # Add an operator-approved authentication layer before reverse_proxy.
    # Do not publish an unauthenticated staging application.
    encode zstd gzip
    reverse_proxy host.docker.internal:3201
}
```

The `3201` port is a planning value only; it must match the staging service
chosen during rehearsal and must remain loopback-bound. Do not add this block
unless DNS, authentication, and teardown ownership are documented.

## Explicit non-change

Do not change, reorder, or replace the existing `metamorphysis.ai` route. Do
not reuse its upstream, network, database, environment file, volumes, or
credentials. The intended edge relationship is:

```text
metamorphysis.ai       -> existing Metamorphysis upstream (unchanged)
matthewflorek.com       -> portfolio:3000 via portfolio_private (portfolio)
www.matthewflorek.com  -> HTTPS redirect to matthewflorek.com
analytics...           -> umami:3000 via portfolio_umami_private (optional Umami)
```

## Validation expectations

Before reload, the operator must validate the complete Caddy configuration,
not only the added snippet, and must retain a timestamped backup of the exact
active configuration. After reload, verify both domains independently,
including the unchanged Metamorphysis route, certificate status, redirect
behavior, and portfolio `/api/health` through the public hostname.

The stock Caddy image does not provide a rate-limit directive. Keep the
application limiters enabled for login, chat, uploads, and integration APIs.
If an edge rate-limit module or upstream gateway is later approved, apply
limits at least to `/api/auth/login`, `/api/chat`,
`/api/admin/projects/*/assets`, and `/api/admin/integrations/metamorphysis*`.
Do not add an uninstalled Caddy directive to production; record the selected
edge implementation and verify `429` plus `Retry-After` behavior during the
release rehearsal.
