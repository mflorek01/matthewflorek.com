# Guarded public AI assistant

This slice adds a server-only public assistant at `POST /api/chat`. It uses the OpenAI Responses API and is fail-closed unless `ENABLE_AI_FEATURES=true`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are all present. `OPENAI_MODEL` is intentionally not defaulted; setting `OPENAI_MODEL=gpt-5.6-sol` is the current recommended starting point, but the application will not silently change another use case's model.

## Knowledge boundary

The assistant can use only:

- Static portfolio entries marked `PUBLIC` and `includeInAi: true`.
- Database projects with `publicationStatus=PUBLIC`, `visibility=PUBLIC`, and `includeInAi=true`.
- Published CMS pages and blocks with `isPublished=true`, `visibility=PUBLIC`, and `includeInAi=true`.
- `AiKnowledgeDocument` records with `status=PUBLISHED`, `includeInAi=true`, and explicit `metadata.visibility=PUBLIC` or `metadata.publicationStatus=PUBLIC`.

Drafts, private/unlisted records, raw Metamorphysis data, account data, admin data, review notes, and unapproved files are excluded. Local retrieval is the default. Hosted file search is disabled unless `OPENAI_AI_PUBLIC_VECTOR_STORE_ID` names one dedicated store and `OPENAI_AI_PUBLIC_VECTOR_STORE_PUBLIC_ONLY=true` explicitly confirms that the store is public-only. A document row can never authorize a vector store, and the application never derives the hosted-store allowlist from document metadata.

The assistant has no web, code-execution, MCP, function, or data-changing tools. It is instructed to treat visitor messages and retrieved evidence as untrusted data, cite evidence as `[E1]`, `[E2]`, and state when approved evidence is insufficient.

## Guardrails

- Request body, message count, message size, transcript size, output tokens, concurrency, rate, daily calls, and daily spend are bounded.
- Input is checked for common prompt-injection and abuse patterns and sent through `omni-moderation-latest` before the Responses call.
- The subject used for rate limiting is a salted SHA-256 hash. Raw IPs, prompts, answers, names, and email addresses are not sent to analytics.
- `AiSpendReservation` is created before the model call inside a serializable transaction protected by a PostgreSQL advisory lock. The transaction counts both settled usage and active reservations, so concurrent calls cannot pass the daily limits together.
- Successful calls settle with `AiUsageRecord` token/cost data. A settlement failure fails closed and attempts to retain the reservation as `SETTLEMENT_FAILED` with a durable failed-settlement usage record for reconciliation; it is never released as if no paid call occurred.
- Database-backed rate limits and spend controls are required for public AI. If `DATABASE_URL` is unavailable, the assistant fails closed rather than bypassing daily controls.
- Request bodies are rejected by `Content-Length` and read through a bounded stream before JSON parsing.
- Errors are generic to visitors and logs contain only request ID, error class, provider status, and provider request ID when supplied; raw provider messages are never logged.

## Environment variables

Required to enable the assistant:

```text
ENABLE_AI_FEATURES=true
OPENAI_API_KEY=server-only-key
OPENAI_MODEL=gpt-5.6-sol
```

Optional hosted retrieval:

```text
OPENAI_AI_PUBLIC_VECTOR_STORE_ID=vs_public_portfolio
OPENAI_AI_PUBLIC_VECTOR_STORE_PUBLIC_ONLY=true
```

Recommended production controls:

```text
AI_RATE_LIMIT_SALT=<32+ character random secret>
AI_TRUSTED_PROXY=true
AI_ADMIN_TOKEN=<32+ character random secret>
AI_KNOWLEDGE_ROOT=/absolute/path/to/approved/knowledge
```

Operational tuning variables include `AI_MAX_MESSAGES`, `AI_MAX_MESSAGE_CHARS`, `AI_MAX_PROMPT_CHARS`, `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_CONCURRENT`, `AI_RATE_LIMIT_REQUESTS`, `AI_RATE_LIMIT_WINDOW_SECONDS`, `AI_DAILY_CALL_LIMIT`, `AI_DAILY_DOLLAR_LIMIT`, `AI_INPUT_COST_PER_MILLION_USD`, and `AI_OUTPUT_COST_PER_MILLION_USD`. Defaults are conservative and can be overridden without changing code. Set the cost rates to match the configured model before enabling production traffic.

## UI integration

`PortfolioAiChat` is rendered on the Overview page when the assistant is enabled. Project detail pages expose the guarded “Ask about this project” handoff, which opens the same component with the approved project slug and title. The components use only the existing safe analytics event names and send a project slug—not the question—to analytics.

The admin status page is `/admin/ai` and requires the normal authenticated admin session. The protected document inspection endpoint is `GET /api/ai/admin/knowledge` with the `X-AI-Admin-Token` header. It never returns document content or private records. There is no knowledge-upload UI in this slice; publication is a reviewed server-side operation.

## Verification

Run the bounded checks after dependencies are installed:

```text
npm run typecheck
npm run lint -- src/lib/ai src/app/api/chat src/app/api/ai/admin src/components/ai src/app/admin/ai
npx vitest run tests/ai-*.test.ts
npm run build
```

No live API calls are required by the tests; the OpenAI client is injected/mocked.
