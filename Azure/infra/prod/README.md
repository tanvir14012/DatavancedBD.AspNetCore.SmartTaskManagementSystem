# Historical production infrastructure

The SaaS release uses immutable API/Worker/Angular/Admin images and a separate Admin release Job. Runtime
and release identities are distinct; provisioning is never coupled to an application rollout. Existing
VM/IIS Bicep assets are retained as historical material, not the SaaS AKS target.

See [the root README](../../../README.md), [container contract](../../../deploy/containers/README.md),
and [SaaS roadmap](../../../docs/saas/ROADMAP.md).
