# Tracentic JS SDK

LLM observability with scoped tracing and OTLP export for Node.js applications.

## Installation

```bash
npm install tracentic
```

Requires **Node.js 18+**. Ships with ESM and CommonJS builds, plus full TypeScript type definitions.

## Quick start

```typescript
import { createTracentic } from 'tracentic';

const tracentic = createTracentic({
  apiKey: 'your-api-key',
  serviceName: 'my-service',
  environment: 'production',
});

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

```typescript
const tracentic = createTracentic({
  apiKey: '...',
  customPricing: {
    'claude-sonnet-4-20250514': { inputCostPerMillion: 3.0, outputCostPerMillion: 15.0 },
    'gpt-4o': { inputCostPerMillion: 2.5, outputCostPerMillion: 10.0 },
  },
});
```

Cost is calculated automatically when a matching pricing entry exists and both token counts are present.

### Global attributes

Static attributes applied to every span:

```typescript
const tracentic = createTracentic({
  apiKey: '...',
  globalAttributes: {
    region: 'us-east-1',
    version: '2.1.0',
  },
});
```

Dynamic attributes can be set/removed at runtime:

```typescript
import { TracenticGlobalContext } from 'tracentic';

TracenticGlobalContext.current.set('deploy_id', 'deploy-abc');
TracenticGlobalContext.current.remove('deploy_id');
```

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

**Via HTTP header:**

```typescript
// Service A — outgoing request
const scope = tracentic.begin('gateway-handler');
const res = await fetch('https://worker.internal/process', {
  headers: { 'x-tracentic-scope-id': scope.id },
});

// Service B — incoming request
app.post('/process', (req, res) => {
  const parentScopeId = req.headers['x-tracentic-scope-id'];
  const linked = tracentic.begin('worker', { parentScopeId });
});
```

**Via message queue:**

```typescript
// Producer
const scope = tracentic.begin('order-processor');
await queue.send({
  body: payload,
  properties: { 'tracentic-scope-id': scope.id },
});

// Consumer
queue.on('message', (msg) => {
  const parentScopeId = msg.properties['tracentic-scope-id'];
  const linked = tracentic.begin('fulfillment', { parentScopeId });
});
```

### Shutdown

Flush buffered spans before process exit:

```typescript
await tracentic.shutdown();
```

## Configuration reference

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | `undefined` | API key. If omitted, spans are created locally but not exported |
| `serviceName` | `"unknown-service"` | Service identifier in the dashboard |
| `endpoint` | `"https://ingest.tracentic.dev"` | OTLP ingestion endpoint |
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
