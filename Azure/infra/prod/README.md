# Historical production infrastructure

The SaaS release uses immutable API/Worker/Angular/Admin images and a separate Admin release Job. Runtime
and release identities are distinct; provisioning is never coupled to an application rollout. Existing
VM/IIS Bicep assets are retained as historical material, not the SaaS AKS target.

These VM/IIS assets are retained for reference only. The supported production path is the AKS
deployment in [`Azure/infra/aks.bicep`](../aks.bicep), [`deploy/aks/`](../../../deploy/aks/) and
the GitHub Actions workflows under `.github/workflows/`. Do not attach the old VM pipeline to a
production release.

See [the root README](../../../README.md), [AKS deployment guide](../../../deploy/aks/README.md),
[container contract](../../../deploy/containers/README.md), and [SaaS roadmap](../../../docs/saas/ROADMAP.md).
