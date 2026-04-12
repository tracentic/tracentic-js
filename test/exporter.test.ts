import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OtlpJsonExporter, type ExportableSpan } from '../src/exporter';

describe('OtlpJsonExporter', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeSpan(overrides?: Partial<ExportableSpan>): ExportableSpan {
    return {
      name: 'llm.anthropic.chat',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      endedAt: new Date('2025-01-01T00:00:01Z'),
      attributes: { 'llm.provider': 'anthropic' },
      status: 'ok',
      ...overrides,
    };
  }

  it('sends OTLP JSON to the correct endpoint', async () => {
    const exporter = new OtlpJsonExporter({
      endpoint: 'https://ingest.tracentic.dev',
      apiKey: 'test-key',
      serviceName: 'test-service',
      environment: 'test',
    });

    exporter.enqueue(makeSpan());
    await exporter.shutdown();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://ingest.tracentic.dev/v1/ingest');
    expect(opts.method).toBe('POST');
    expect(opts.headers['content-type']).toBe('application/json');
    expect(opts.headers['x-tracentic-api-key']).toBe('test-key');
  });

  it('sends valid OTLP JSON structure', async () => {
    const exporter = new OtlpJsonExporter({
      endpoint: 'https://ingest.tracentic.dev',
      apiKey: 'key',
      serviceName: 'svc',
      environment: 'prod',
    });

    exporter.enqueue(makeSpan());
    await exporter.shutdown();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.resourceSpans).toHaveLength(1);

    const rs = body.resourceSpans[0];
    expect(rs.resource.attributes).toBeDefined();
    expect(rs.scopeSpans).toHaveLength(1);

    const ss = rs.scopeSpans[0];
    expect(ss.scope.name).toBe('Tracentic');
    expect(ss.spans).toHaveLength(1);

    const span = ss.spans[0];
    expect(span.name).toBe('llm.anthropic.chat');
    expect(span.kind).toBe(3); // CLIENT
    expect(span.traceId).toBeDefined();
    expect(span.spanId).toBeDefined();
    expect(span.status.code).toBe(1); // OK
  });

  it('sets error status for error spans', async () => {
    const exporter = new OtlpJsonExporter({
      endpoint: 'https://ingest.tracentic.dev',
      apiKey: 'key',
      serviceName: 'svc',
      environment: 'prod',
    });

    exporter.enqueue(
      makeSpan({ status: 'error', errorMessage: 'rate limited' }),
    );
    await exporter.shutdown();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const span = body.resourceSpans[0].scopeSpans[0].spans[0];
    expect(span.status.code).toBe(2); // ERROR
    expect(span.status.message).toBe('rate limited');
  });

  it('does not call fetch when queue is empty', async () => {
    const exporter = new OtlpJsonExporter({
      endpoint: 'https://ingest.tracentic.dev',
      apiKey: 'key',
      serviceName: 'svc',
      environment: 'prod',
    });

    await exporter.shutdown();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('drops oldest span when queue exceeds max size', async () => {
    const exporter = new OtlpJsonExporter({
      endpoint: 'https://ingest.tracentic.dev',
      apiKey: 'key',
      serviceName: 'svc',
      environment: 'prod',
    });

    // Enqueue 513 spans (max queue is 512)
    for (let i = 0; i < 513; i++) {
      exporter.enqueue(makeSpan({ name: `span-${i}` }));
    }

    await exporter.shutdown();

    // All calls combined should have at most 512 spans
    let totalSpans = 0;
    for (const call of fetchSpy.mock.calls) {
      const body = JSON.parse(call[1].body);
      totalSpans +=
        body.resourceSpans[0].scopeSpans[0].spans.length;
    }
    expect(totalSpans).toBeLessThanOrEqual(512);
  });

  it('silently ignores fetch failures', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'));

    const exporter = new OtlpJsonExporter({
      endpoint: 'https://ingest.tracentic.dev',
      apiKey: 'key',
      serviceName: 'svc',
      environment: 'prod',
    });

    exporter.enqueue(makeSpan());

    // Should not throw
    await expect(exporter.shutdown()).resolves.toBeUndefined();
  });

  it('includes resource attributes', async () => {
    const exporter = new OtlpJsonExporter({
      endpoint: 'https://ingest.tracentic.dev',
      apiKey: 'key',
      serviceName: 'my-service',
      environment: 'staging',
    });

    exporter.enqueue(makeSpan());
    await exporter.shutdown();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const resourceAttrs = body.resourceSpans[0].resource.attributes;
    const names = resourceAttrs.map(
      (a: { key: string }) => a.key,
    );

    expect(names).toContain('service.name');
    expect(names).toContain('deployment.environment');
  });
});
