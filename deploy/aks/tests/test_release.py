"""Execute the real transaction shell with deterministic, isolated command doubles."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
BASH = os.environ.get("TEST_BASH") or shutil.which("bash")
SPEC = importlib.util.spec_from_file_location("manifest", ROOT / "deploy/aks/release-manifest.py")
manifest = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(manifest)


class ManifestTests(unittest.TestCase):
    def test_source_registry_and_all_digests_are_bound(self):
        release = {"source": "a" * 40, "registry": "test.azurecr.io",
                   "images": {name: "sha256:" + "b" * 64 for name in ("api", "admin", "worker", "frontend")}}
        self.assertEqual(4, len(manifest.validate(release, release["registry"], release["source"])))
        for field, value in (("source", "c" * 40), ("registry", "attacker.azurecr.io"),
                             ("images", {"api": "sha256:invalid"})):
            with self.subTest(field=field), self.assertRaises(ValueError):
                manifest.validate({**release, field: value}, release["registry"], release["source"])


class RecoveryTests(unittest.TestCase):
    def run_release(self, scenario):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "deploy/aks"
            scripts.mkdir(parents=True)
            shutil.copy(ROOT / "deploy/aks/release-transaction.sh", scripts)
            (scripts / "health-check.sh").write_text('''#!/usr/bin/env bash
set -eu
echo health >> "$TEST_LOG"
[[ "$SCENARIO" != baseline-failure ]] || exit 1
if [[ -f "$TEST_STATE" ]]; then
  [[ "$SCENARIO" != smoke-failure && "$SCENARIO" != install-smoke-failure && "$SCENARIO" != recovery-health-failure ]]
else
  [[ "$SCENARIO" != baseline-failure && "$SCENARIO" != recovery-health-failure || ! -f "$TEST_RECOVERED" ]]
fi
''', newline="\n")
            binary = root / "bin"
            binary.mkdir()
            helm = binary / "helm"
            helm.write_text('''#!/usr/bin/env bash
set -eu
echo "$*" >> "$TEST_LOG"
case "$1" in
  list)
    [[ "$SCENARIO" != list-failure ]] || exit 1
    if [[ "$SCENARIO" == install-* ]]; then echo '[]'; else echo '[{}]'; fi ;;
  status)
    if [[ "$SCENARIO" == pending ]]; then state=pending-upgrade; else state=deployed; fi
    if [[ "$SCENARIO" == legacy ]]; then contract=legacy; else contract=v1; fi
    printf '{"version":7,"config":{"rollbackContract":"%s"},"info":{"status":"%s"}}' "$contract" "$state" ;;
  upgrade)
    touch "$TEST_STATE"
    if [[ "$SCENARIO" == interrupted ]]; then kill -TERM "$PPID"; exit 143; fi
    [[ "$SCENARIO" != upgrade-failure && "$SCENARIO" != rollback-failure && "$SCENARIO" != install-failure && "$SCENARIO" != install-cleanup-failure ]] ;;
  rollback)
    [[ "$SCENARIO" != rollback-failure ]] || exit 1
    rm -f "$TEST_STATE"
    touch "$TEST_RECOVERED" ;;
  uninstall) [[ "$SCENARIO" != install-cleanup-failure ]] ;;
  *) exit 99 ;;
esac
''', newline="\n")
            helm.chmod(0o755)
            env = {**os.environ, "SCENARIO": scenario, "NAMESPACE": "test-owned",
                   "TEST_LOG": str(root / "commands"), "TEST_STATE": str(root / "state"),
                   "TEST_RECOVERED": str(root / "recovered"), "PYTHON_BIN": os.environ.get("PYTHON_BIN", "python"),
                   "PATH": str(binary) + os.pathsep + os.environ["PATH"]}
            result = subprocess.run([BASH, str(scripts / "release-transaction.sh"), "chart"],
                                    env=env, capture_output=True, text=True, timeout=20)
            commands = (root / "commands").read_text()
            return result.returncode, commands, result.stderr

    def test_success_does_not_rollback(self):
        code, commands, error = self.run_release("success")
        self.assertEqual(0, code, error)
        self.assertNotIn("rollback", commands)
        self.assertEqual(2, commands.count("health"))

    def test_successful_first_install(self):
        code, commands, error = self.run_release("install-success")
        self.assertEqual(0, code, error)
        self.assertEqual(1, commands.count("health"))
        self.assertNotIn("uninstall", commands)

    @unittest.skipIf(os.name == "nt", "Git Bash does not provide Unix parent signal semantics")
    def test_termination_requests_recovery(self):
        code, commands, error = self.run_release("interrupted")
        self.assertEqual(143, code, error)
        self.assertIn("rollback stms 7", commands)

    def test_rollout_and_smoke_failure_restore_exact_revision_and_fail(self):
        for scenario in ("upgrade-failure", "smoke-failure"):
            with self.subTest(scenario=scenario):
                code, commands, error = self.run_release(scenario)
                self.assertEqual(1, code, error)
                self.assertIn("rollback stms 7", commands)
                self.assertIn("--no-hooks --wait --wait-for-jobs", commands)
                self.assertTrue(commands.endswith("health\n"))
                self.assertNotIn("uninstall", commands)

    def test_recovery_failure_is_distinct(self):
        for scenario in ("rollback-failure", "recovery-health-failure"):
            with self.subTest(scenario=scenario):
                code, _, error = self.run_release(scenario)
                self.assertEqual(2, code, error)
                self.assertIn("RECOVERY FAILED", error)

    def test_first_install_cleanup(self):
        for scenario in ("install-failure", "install-smoke-failure"):
            with self.subTest(scenario=scenario):
                code, commands, error = self.run_release(scenario)
                self.assertEqual(1, code, error)
                self.assertIn("uninstall stms", commands)
                self.assertNotIn("rollback", commands)

    def test_cleanup_failure_is_distinct(self):
        code, _, error = self.run_release("install-cleanup-failure")
        self.assertEqual(2, code, error)

    def test_preflight_failure_never_mutates(self):
        for scenario in ("list-failure", "pending", "baseline-failure", "legacy"):
            with self.subTest(scenario=scenario):
                code, commands, error = self.run_release(scenario)
                self.assertNotEqual(0, code, error)
                self.assertNotIn("upgrade --install", commands)
                self.assertNotIn("rollback", commands)
                self.assertNotIn("uninstall", commands)


if __name__ == "__main__":
    unittest.main()
