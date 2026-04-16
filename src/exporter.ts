import { randomBytes } from "node:crypto";

// ── OTLP JSON DTOs ─────────────────────────────────────────────────

interface OtlpAttribute {
  key: string;
  value: OtlpValue;
}

interface OtlpValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OtlpAttribute[];
  status: { code: number; message?: string };
}

interface OtlpRequest {
  resourceSpans: Array<{
    resource: { attributes: OtlpAttribute[] };
    scopeSpans: Array<{
      scope: { name: string; version: string };
      spans: OtlpSpan[];
    }>;
  }>;
}

// ── Internal span representation queued for export ─────────────────

export interface ExportableSpan {
  name: string;
  startedAt: Date;
  endedAt: Date;
  attributes: Record<string, unknown>;
  status: "ok" | "error";
  errorMessage?: string;
}

// ── Exporter ───────────────────────────────────────────────────────

const SDK_VERSION = "0.1.0";

export class OtlpJsonExporter {
  private readonly _endpoint: string;
  private readonly _apiKey: string;
  private readonly _serviceName: string;
  private readonly _serviceVersion: string;
  private readonly _environment: string;

  private readonly _queue: ExportableSpan[] = [];
  private _timer: ReturnType<typeof setInterval> | undefined;
  private _shutdownPromise: Promise<void> | undefined;

  // Batch settings (matching .NET SDK)
  private readonly _scheduledDelayMs = 5000;
  private readonly _maxQueueSize = 512;
  private readonly _maxBatchSize = 128;

  constructor(opts: {
    endpoint: string;
    apiKey: string;
    serviceName: string;
    environment: string;
  }) {
    this._endpoint = `${opts.endpoint.replace(/\/+$/, "")}/v1/ingest`;
    this._apiKey = opts.apiKey;
    this._serviceName = opts.serviceName;
    this._serviceVersion = SDK_VERSION;
    this._environment = opts.environment;
  }

  start(): void {
    if (this._timer) return;
    this._timer = setInterval(() => {
      void this._flush();
    }, this._scheduledDelayMs);
    // Don't hold the process open for the export timer
    this._timer.unref();
  }

  enqueue(span: ExportableSpan): void {
    if (this._queue.length >= this._maxQueueSize) {
      // Drop oldest to make room (same as bounded queue)
      this._queue.shift();
    }
    this._queue.push(span);
  }

  /**
   * Flush all queued spans and shut down. Returns a promise that
   * resolves when the final export completes (or times out).
   */
  async shutdown(): Promise<void> {
    if (this._shutdownPromise) return this._shutdownPromise;
    this._shutdownPromise = this._shutdownInternal();
    return this._shutdownPromise;
  }

  private async _shutdownInternal(): Promise<void> {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
    await this._flush();
  }

  private async _flush(): Promise<void> {
    if (this._queue.length === 0) return;

    // Drain up to maxBatchSize
    const batch = this._queue.splice(0, this._maxBatchSize);
    const otlpSpans = batch.map((s) => this._convertSpan(s));

    const request: OtlpRequest = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              attr("service.name", this._serviceName),
              attr("service.version", this._serviceVersion),
              attr("deployment.environment", this._environment),
            ],
          },
          scopeSpans: [
            {
              scope: { name: "Tracentic", version: SDK_VERSION },
              spans: otlpSpans,
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this._endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tracentic-api-key": this._apiKey,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(5000),
      });
      // Drain response body to release the connection
      await response.text();
    } catch {
      // Fire-and-forget - export failures are silently ignored
    }

    // If there are still items in the queue, flush again
    if (this._queue.length > 0) {
      await this._flush();
    }
  }

  private _convertSpan(span: ExportableSpan): OtlpSpan {
    const traceId = randomBytes(16).toString("base64");
    const spanId = randomBytes(8).toString("base64");

    const startNano = BigInt(span.startedAt.getTime()) * 1_000_000n;
    const endNano = BigInt(span.endedAt.getTime()) * 1_000_000n;

    const attributes: OtlpAttribute[] = [];
    for (const [key, value] of Object.entries(span.attributes)) {
      attributes.push(attr(key, value));
    }

    return {
      traceId,
      spanId,
      name: span.name,
      kind: 3, // CLIENT
      startTimeUnixNano: startNano.toString(),
      endTimeUnixNano: endNano.toString(),
      attributes: attributes.length > 0 ? attributes : undefined,
      status: {
        code: span.status === "error" ? 2 : 1,
        message: span.errorMessage,
      },
    };
  }
}

function attr(key: string, value: unknown): OtlpAttribute {
  if (typeof value === "string") {
    return { key, value: { stringValue: value } };
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { key, value: { intValue: value.toString() } };
    }
    return { key, value: { doubleValue: value } };
  }
  if (typeof value === "boolean") {
    return { key, value: { boolValue: value } };
  }
  return { key, value: { stringValue: String(value) } };
}
