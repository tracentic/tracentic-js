# Changelog

All notable changes to the Tracentic JS SDK are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/tracentic/tracentic-js/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tracentic/tracentic-js/releases/tag/v0.1.0
