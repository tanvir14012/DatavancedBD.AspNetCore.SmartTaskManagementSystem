# Observability

The API emits OpenTelemetry traces/metrics and structured logs to stdout. Request tracing adds a
validated `X-Trace-Id` response header and a structured tenant identifier when an authorized context
exists; audit events carry the same correlation fields. Tenant or user values must not be metric
labels, because they are unbounded.

Production wiring is stdout -> Alloy -> Loki and OTLP/Prometheus-compatible metrics -> Grafana. Telemetry
export failure must not prevent web startup. Provider adapters should record bounded dependency-failure
counters and redact connection strings, tokens and schema credentials.
