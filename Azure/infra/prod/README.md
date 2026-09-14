# Historical production infrastructure

The saas branch replaces both production deployment and cleanup pipelines with manual-only placeholders. They do not deploy or delete resources. Existing VM/IIS Bicep assets are retained as historical material, not the SaaS AKS target.

See [the root README](../../../README.md) and [SaaS roadmap](../../../docs/saas/ROADMAP.md). TODO(SAAS-08): implement AKS release infrastructure and verification.
