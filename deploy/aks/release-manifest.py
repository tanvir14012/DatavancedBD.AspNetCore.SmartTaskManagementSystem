"""Validate immutable release inputs without executing artifact-provided shell code."""
import json
import re
import sys


def validate(manifest, registry, source):
    if manifest.get("source") != source or not re.fullmatch(r"[0-9a-f]{40}", source):
        raise ValueError("Release source does not match the successful dev run")
    if manifest.get("registry") != registry or not re.fullmatch(r"[a-z0-9.-]+", registry):
        raise ValueError("Release registry is not the configured registry")
    images = manifest.get("images", {})
    if set(images) != {"api", "admin", "worker", "frontend"}:
        raise ValueError("Release must contain exactly the four expected images")
    if any(not re.fullmatch(r"sha256:[0-9a-f]{64}", value) for value in images.values()):
        raise ValueError("Invalid image digest")
    return images


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as release_file:
        release = json.load(release_file)
    for component, digest in validate(release, sys.argv[2], sys.argv[3]).items():
        print(f"{component}={digest}")
