# Developer documentation

Use the documents below as the maintained reference for the current repository.

| Document | Purpose |
| --- | --- |
| [Developer wiki](DEVELOPER_WIKI.md) | Full architecture, tenant isolation, configuration ownership, observability, local Docker, testing, troubleshooting, and change procedures |
| [Multitenancy implementation guide](Multitenancy.md) | Detailed master-to-saas code walkthrough, explained C# and SQL excerpts, diagrams, configuration, Docker, local frontend switching, and production scaling boundaries |
| [SaaS roadmap](saas/ROADMAP.md) | Delivery increments, release boundaries, and acceptance requirements |
| [Observability guide](../deploy/observability/README.md) | Loki logs, Tempo traces, Prometheus metrics, Grafana provisioning, and OTLP routing |
| [Local SaaS guide](../deploy/local/README.md) | Nine-company Docker topology, ports, credentials, startup, and acceptance verification |
| [Configuration guide](../deploy/configuration/README.md) | Local and production configuration ownership and secret boundaries |
| [Container guide](../deploy/containers/README.md) | Image contracts and Compose deployment boundaries |
| [AKS deployment guide](../deploy/aks/README.md) | Azure infrastructure and release operations |
| [Validation reference](../VALIDATION_IMPLEMENTATION.md) | Backend and Angular input validation rules and verification commands |

Start with the developer wiki for onboarding. It links to the source files and scripts that own each
runtime decision, so implementation changes can be made together with the corresponding documentation.
