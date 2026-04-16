# Tracentic JS SDK

LLM observability with scoped tracing and OTLP export for Node.js applications.

## Installation

```bash
npm install tracentic
```

Requires **Node.js 18+**. Ships with ESM and CommonJS builds, plus full TypeScript type definitions.

## Endpoint

Point the SDK at the Tracentic ingestion endpoint by passing `endpoint: 'https://tracentic.dev'` to `createTracentic` (or `configure`). This is the hosted service URL that receives spans over OTLP/HTTP JSON — use it unless you're running a self-hosted Tracentic deployment, in which case pass your own URL.

```typescript
const tracentic = createTracentic({
  apiKey: 'your-api-key',
  endpoint: 'https://tracentic.dev',
  serviceName: 'my-service',
});
```

## Quick start

Create a Tracentic instance once at startup, in its own module, and import it from anywhere else in your app — this avoids re-initializing the exporter and keeps configuration in one place.

```typescript
// src/tracentic.ts — the single source of truth for your SDK instance
import { createTracentic } from 'tracentic';

export const tracentic = createTracentic({
  apiKey: 'your-api-key',
  endpoint: 'https://tracentic.dev',
  serviceName: 'my-service',
  environment: 'production',
  // Required for cost tracking. Without this, llm.cost.total_usd is
  // omitted and the SDK warns once per unpriced model.
  customPricing: {
    'claude-sonnet-4-20250514': { inputCostPerMillion: 3.0, outputCostPerMillion: 15.0 },
    'gpt-4o': { inputCostPerMillion: 2.5, outputCostPerMillion: 10.0 },
  },
});
```

```typescript
// src/agents/summarizer.ts — import the shared instance anywhere
import { tracentic } from '../tracentic';

const scope = tracentic.begin('summarize', {
  attributes: { user_id: 'user-123' },
});

const startedAt = new Date();
const result = await callLlm(text);
const endedAt = new Date();

tracentic.recordSpan(scope, {
  startedAt,
  endedAt,
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  inputTokens: result.usage.inputTokens,
  outputTokens: result.usage.outputTokens,
  operationType: 'chat',
});
```

### Singleton pattern

If you prefer a global instance:

```typescript
import { configure, getTracentic } from 'tracentic';

// At startup
configure({ apiKey: '...', serviceName: 'my-service' });

// Anywhere else
const tracentic = getTracentic();
```

## Features

### Scoped tracing

Group related LLM calls under a logical scope. Nest scopes for multi-step pipelines:

```typescript
const pipeline = tracentic.begin('rag-pipeline', {
  correlationId: 'order-42',
});

// Child scope inherits the parent link automatically
const synthesis = pipeline.createChild('synthesis', {
  attributes: { strategy: 'hybrid' },
});
```

### Error recording

```typescript
tracentic.recordError(scope, span, new Error('rate limited'));
```

### Scopeless spans

For standalone LLM calls that don't belong to a larger operation:

```typescript
tracentic.recordSpan({
  startedAt,
  endedAt,
  provider: 'openai',
  model: 'gpt-4o-mini',
  inputTokens: 200,
  outputTokens: 50,
  operationType: 'chat',
});
```

### Custom pricing

`customPricing` is required for cost tracking. The SDK does not ship with built-in pricing because model prices change frequently and vary by contract. If a span has token data but no matching pricing entry, `llm.cost.total_usd` is omitted and the SDK logs a warning once per model.

```typescript
const tracentic = createTracentic({
  apiKey: '...',
  customPricing: {
    'claude-sonnet-4-20250514': { inputCostPerMillion: 3.0, outputCostPerMillion: 15.0 },
    'gpt-4o': { inputCostPerMillion: 2.5, outputCostPerMillion: 10.0 },
  },
});
```

### Global attributes

Pass `globalAttributes` to `createTracentic()` to tag every span this service emits with the same static values — region, deployment version, owning team, cluster name. They're resolved once at startup and merged into every span without per-call bookkeeping:

```typescript
const tracentic = createTracentic({
  apiKey: '...',
  serviceName: 'my-service',
  environment: 'production',
  globalAttributes: {
    region: 'us-east-1',
    version: '2.1.0',
    team: 'platform',
  },
});

// Every span this service emits now carries region, version, team.
```

Scope and per-span attributes override global values on key collision, so `globalAttributes` is the right layer for defaults you want everywhere unless something more specific says otherwise:

```typescript
const scope = tracentic.begin('request', { attributes: { region: 'us-west-2' } });
// Spans in this scope carry region="us-west-2" (scope wins over global).
```

For values that change after startup — a deploy ID rotated by a background job, a maintenance-mode flag — use `TracenticGlobalContext` to set/remove entries at runtime:

```typescript
import { TracenticGlobalContext } from 'tracentic';

TracenticGlobalContext.current.set('deploy_id', 'deploy-abc');
// ... spans recorded now include deploy_id ...
TracenticGlobalContext.current.remove('deploy_id');
```

`TracenticGlobalContext` is process-wide (not async-local), so values set from one request's handler will leak into every other request running concurrently. For ambient per-request data (user ID, tenant, request ID), use the Express middleware below instead.

### Express middleware

Inject per-request attributes for the duration of each HTTP request:

```typescript
import { tracenticMiddleware } from 'tracentic/middleware/express';

app.use(tracenticMiddleware({
  requestAttributes: (req) => ({
    userId: req.headers['x-user-id'],
    method: req.method,
  }),
}));
```

### Cross-service linking

Tracentic does not propagate scope IDs automatically — you pass them explicitly through whatever transport connects your services (HTTP headers, message properties, etc.).

For cross-service linking to work, both services must integrate the Tracentic SDK (or implement the OTLP JSON ingest API directly) and their API keys must belong to the **same tenant**. Spans from different tenants are isolated and cannot be linked.

Use the exported `TRACENTIC_SCOPE_HEADER` constant on both ends rather than a string literal — typos silently break linking.

**Via HTTP header:**

```typescript
import { TRACENTIC_SCOPE_HEADER } from 'tracentic';

// Service A — outgoing request
const scope = tracentic.begin('gateway-handler');
const res = await fetch('https://worker.internal/process', {
  headers: { [TRACENTIC_SCOPE_HEADER]: scope.id },
});

// Service B — incoming request
app.post('/process', (req, res) => {
  const parentScopeId = req.headers[TRACENTIC_SCOPE_HEADER];
  const linked = tracentic.begin('worker', { parentScopeId });
});
```

**Via message queue:**

```typescript
import { TRACENTIC_SCOPE_HEADER } from 'tracentic';

// Producer
const scope = tracentic.begin('order-processor');
await queue.send({
  body: payload,
  properties: { [TRACENTIC_SCOPE_HEADER]: scope.id },
});

// Consumer
queue.on('message', (msg) => {
  const parentScopeId = msg.properties[TRACENTIC_SCOPE_HEADER];
  const linked = tracentic.begin('fulfillment', { parentScopeId });
});
```

### Shutdown

Buffered spans are flushed automatically on `beforeExit`, `SIGTERM`, and `SIGINT`, so you don't need to call `shutdown()` in normal use. Call it explicitly only if you want to flush at a specific point (e.g. in short-lived scripts that exit via `process.exit()`, which skips `beforeExit`):

```typescript
await tracentic.shutdown();
```

### Serverless (AWS Lambda, Vercel, Cloudflare Workers)

Serverless runtimes freeze or kill the process between invocations, so the automatic exit handlers may never fire and any spans still in the buffer are lost. **Always `await tracentic.shutdown()` before your handler returns:**

```typescript
export const handler = async (event) => {
  try {
    const result = await doWork(event);
    return result;
  } finally {
    // Flush before the runtime freezes the process
    await tracentic.shutdown();
  }
};
```

For AWS Lambda specifically, calling `shutdown()` in `finally` flushes synchronously before Lambda freezes the container. Without this, you will see spans appear inconsistently — only when a container happens to be reused and the next invocation triggers a flush.

## Configuration reference

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | `undefined` | API key. If omitted, spans are created locally but not exported |
| `serviceName` | `"unknown-service"` | Service identifier in the dashboard |
| `endpoint` | `"https://tracentic.dev"` | Tracentic ingestion endpoint. Pass `https://tracentic.dev` for the hosted service. Override only for self-hosted deployments. |
| `environment` | `"production"` | Deployment environment tag |
| `customPricing` | `undefined` | Model pricing for cost calculation |
| `globalAttributes` | `undefined` | Static attributes on every span |
| `attributeLimits` | platform defaults | Limits on attribute count, key/value length |

## Development

```bash
npm install
npm run build       # Build with tsup
npm run typecheck   # Type-check without emitting
```

## Running tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch
```

### Test files

| File | What it covers |
|------|----------------|
| `tracentic.test.ts` | SDK factory, singleton, begin/recordSpan/recordError, cost calculation |
| `scope.test.ts` | Scope creation, nesting, defensive copying, unique IDs |
| `global-context.test.ts` | Global context set/get/remove, singleton access, snapshots |
| `attribute-merger.test.ts` | Three-layer merge priority, key/value truncation, count cap |
| `options.test.ts` | AttributeLimits defaults, clamping, platform constants |
| `exporter.test.ts` | OTLP JSON structure, endpoint, headers, overflow, error handling |
