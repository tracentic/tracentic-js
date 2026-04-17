# Changelog

All notable changes to the Tracentic JS SDK are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-04-17

### Added

- `debug` option for verbose diagnostic logging. When enabled, the SDK logs span enqueue, batch flush, export success, and shutdown lifecycle events to `console.debug`. Warnings and errors (export failures, queue overflow) are always emitted regardless of this flag.
- `exportTimeoutMs` option to configure the per-request timeout for OTLP exports (default: 30 seconds, previously hardcoded to 5 seconds).
- Export error logging - HTTP failures and network errors are now logged via `console.warn` instead of being silently swallowed.
- Queue overflow warning when spans are dropped due to a full export queue.
- README sections for debugging, logging, and export timeout configuration.

### Changed

- Default OTLP export timeout increased from 5 seconds to 30 seconds, matching the .NET SDK. This prevents silent span loss in higher-latency environments such as CI runners and serverless cold starts.
- All SDK log output is now routed through an internal logger module with a consistent `[tracentic]` prefix.

## [0.2.0] - 2026-04-15

### Added

- `TRACENTIC_SCOPE_HEADER` constant for cross-service scope-ID propagation. Use this in place of the literal `"x-tracentic-scope-id"` string so a typo on either end can't silently break linking.
- One-time `console.warn` when a span has token data but no matching `customPricing` entry - surfaces missing cost configuration that previously failed silently. Emitted at most once per unique model.
- `console.info` when `createTracentic` / `configure` is called without an `apiKey` - clarifies that spans are created locally but not exported.
- README guidance for serverless runtimes (AWS Lambda, Vercel, Cloudflare Workers) explaining why `beforeExit` / `SIGTERM` may not fire and how to `await tracentic.shutdown()` from `finally`.
- README quick start now demonstrates the recommended standalone-module pattern (`src/tracentic.ts` exporting the instance) for sharing a single SDK instance across an app.

### Changed

- Default `endpoint` is now `https://tracentic.dev` (previously `https://ingest.tracentic.dev`). Any caller passing an explicit `endpoint` is unaffected.
- README clarifies that `customPricing` is required for cost tracking - there are no built-in pricing defaults - and that the SDK warns when it's missing.
- README quick start now includes `customPricing` so the expected configuration shape is visible by default.

## [0.1.0] - 2026-04-15

Initial public release.

### Added

- Scoped tracing with `tracentic.begin`, `scope.createChild`, and cross-service linking via `parentScopeId`.
- Span recording (`recordSpan`, `recordError`) with and without a scope.
- Three-layer attribute merge (global < scope < span) with platform-enforced limits.
- Global attribute context (`TracenticGlobalContext`) with static and dynamic attributes.
- Express middleware (`tracentic/middleware/express`) for per-request attribute injection.
- LLM cost calculation from user-supplied `customPricing`.
- OTLP/HTTP JSON exporter with batched delivery and configurable endpoint.
- Dual ESM/CommonJS build with full TypeScript type definitions.
- Node.js 18+ support.

[Unreleased]: https://github.com/tracentic/tracentic-js/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/tracentic/tracentic-js/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/tracentic/tracentic-js/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/tracentic/tracentic-js/releases/tag/v0.1.0
