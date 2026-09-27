"""Render real Helm output and assert deployment safety contracts (no cluster required)."""
import os
from pathlib import Path
import subprocess
import yaml

ROOT = Path(__file__).resolve().parents[3]
HELM = os.environ.get("HELM", "helm")
CHART = str(ROOT / "deploy/aks/chart")
common = ["--set-string", "keyVault.name=test-kv", "--set-string", "workloadIdentity.tenantId=test",
          "--set-string", "workloadIdentity.runtimeClientId=test", "--set-string", "workloadIdentity.adminClientId=test"]

for environment in ("dev", "prod"):
    values = ["-f", f"{CHART}/values-{environment}.yaml"]
    subprocess.run([HELM, "lint", CHART, *values, *common], check=True)
    for autoscaling in (True, False):
        flags = ["--set", f"api.autoscaling.enabled={str(autoscaling).lower()},frontend.autoscaling.enabled={str(autoscaling).lower()}"]
        rendered = subprocess.check_output([HELM, "template", "stms", CHART, *values, *common, *flags], text=True)
        resources = [item for item in yaml.safe_load_all(rendered) if item]
        assert not any(item["kind"] == "Job" for item in resources), "Routine release must not migrate"
        assert not any("helm.sh/hook" in item["metadata"].get("annotations", {}) for item in resources)
        for component in ("api", "frontend"):
            deployment = next(item for item in resources if item["kind"] == "Deployment" and item["metadata"]["name"] == f"stms-{component}")
            spec = deployment["spec"]
            assert ("replicas" not in spec) == autoscaling
            assert spec["strategy"]["rollingUpdate"]["maxUnavailable"] == 0
            assert spec["minReadySeconds"] > 0
            pod = spec["template"]["spec"]
            assert pod["automountServiceAccountToken"] is False
            assert pod["securityContext"]["runAsNonRoot"] is True
            container = pod["containers"][0]
            assert container["securityContext"]["readOnlyRootFilesystem"] is True
            assert container["securityContext"]["allowPrivilegeEscalation"] is False
            assert pod["terminationGracePeriodSeconds"] >= 45
            for probe in ("startupProbe", "livenessProbe", "readinessProbe"):
                assert container[probe]["timeoutSeconds"] >= 1
            if component == "api":
                assert container["livenessProbe"]["httpGet"]["path"] == "/alive"
                assert container["readinessProbe"]["httpGet"]["path"] == "/ready"
            if autoscaling:
                hpa = next(item for item in resources if item["kind"] == "HorizontalPodAutoscaler" and item["metadata"]["name"] == f"stms-{component}")
                assert hpa["apiVersion"] == "autoscaling/v2"
                assert 1 <= hpa["spec"]["minReplicas"] <= hpa["spec"]["maxReplicas"]
                pdb = next(item for item in resources if item["kind"] == "PodDisruptionBudget" and item["metadata"]["name"] == f"stms-{component}")
                assert pdb["spec"]["minAvailable"] < hpa["spec"]["minReplicas"]
        print(f"PASS: {environment}, autoscaling={autoscaling}")
