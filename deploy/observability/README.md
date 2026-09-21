# Observability

The API emits OpenTelemetry traces/metrics and structured logs to stdout and, when configured, to
Grafana Loki through the Loki HTTP push API. Request tracing adds a
validated `X-Trace-Id` response header and a structured tenant identifier when an authorized context
exists; audit events carry the same correlation fields. Tenant or user values must not be metric
labels, because they are unbounded.

The application-level log path is API -> Loki; stdout remains enabled for container collection and
diagnostics. The Loki sink is best effort, has a bounded two-second HTTP timeout, and swallows export
failures so Loki availability cannot prevent web startup. Labels are bounded to application,
environment, tenant deployment slug, and level; user IDs and request values are kept in the log line.

The local Compose environments run `grafana/loki:3.5.0` on port 3100 and
`grafana/grafana:12.1.1` on port 3000 with provisioned Loki, Prometheus, and Tempo datasources.
Open `http://localhost:3000`, sign in as `admin`/`admin`, query
`{application="SmartTaskManagementSystem"}`, open the Tempo trace search, or use Prometheus Explore.
The nine-company harness assigns each API a deployment label (`titan`, `atlas`, and so on) through
`Observability__Loki__Tenant`; the standard Compose API uses the `shared` label.

When `Observability__Otlp__TracesEndpoint` is configured, the API exports OTLP/HTTP protobuf traces
to Grafana Alloy, which forwards them to Tempo. When `Observability__Otlp__MetricsEndpoint` is
configured, the API exports OTLP/HTTP protobuf metrics to Alloy, which converts them to Prometheus
remote-write samples. Grafana reads those samples from Prometheus. Console exporters remain enabled
as a local diagnostic fallback. Loki stores logs, Tempo stores traces, and Prometheus stores metrics.
Provider adapters should record bounded dependency-failure counters and redact connection strings,
tokens, and schema credentials.
