# Observability — TODO(SAAS-08)

Structured stdout -> Alloy -> Loki; metrics -> Prometheus; dashboards/alerts -> Grafana. Avoid unbounded tenant/user labels. Include tenant and trace identifiers as structured log metadata. Inject telemetry boundaries and test redaction, correlation and dependency-failure metrics. Do not require telemetry availability for web startup.
