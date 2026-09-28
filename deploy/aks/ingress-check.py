"""Read-only TLS/login/resource smoke test. Never print credentials or response bodies."""
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward bearer tokens or accept a redirected authentication page.
        return None


def configuration():
    names = ("INGRESS_HOST", "SMOKE_TENANT_ID", "SMOKE_EMAIL", "SMOKE_PASSWORD",
             "SMOKE_PROJECT_ID", "SMOKE_PROJECT_NAME")
    config = {name: os.environ.get(name, "") for name in names}
    if any(not value for value in config.values()):
        raise ValueError("Authenticated ingress smoke configuration is incomplete")
    host = config["INGRESS_HOST"]
    parsed = urllib.parse.urlsplit(f"https://{host}")
    if parsed.netloc != host or parsed.path or parsed.query or parsed.fragment or parsed.username:
        raise ValueError("INGRESS_HOST must be an HTTPS authority without credentials or a path")
    if not parsed.hostname or any(ord(char) <= 32 for char in host):
        raise ValueError("Invalid ingress host")
    tenant = uuid.UUID(config["SMOKE_TENANT_ID"])
    if tenant.int == 0 or str(tenant) != config["SMOKE_TENANT_ID"].lower():
        raise ValueError("Smoke tenant must be a nonempty canonical UUID")
    if not config["SMOKE_PROJECT_ID"].isdigit() or int(config["SMOKE_PROJECT_ID"]) < 1:
        raise ValueError("Smoke project ID must be positive")
    return config


def check(config):
    context = ssl.create_default_context(cafile=os.environ.get("SMOKE_CA_FILE") or None)
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=context))
    base = f"https://{config['INGRESS_HOST']}"

    def request(path, token=None, payload=None):
        headers = {"X-Tenant-ID": config["SMOKE_TENANT_ID"], "Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        body = json.dumps(payload).encode() if payload is not None else None
        if body:
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(base + path, data=body, headers=headers)
        with opener.open(req, timeout=10) as response:
            if response.status != 200:
                raise ValueError("Unexpected ingress response status")
            data = response.read(1024 * 1024 + 1)
            if len(data) > 1024 * 1024:
                raise ValueError("Ingress response exceeded the smoke-check limit")
            return data

    request("/")
    project_path = f"/services/api/projects/{config['SMOKE_PROJECT_ID']}"
    try:
        request(project_path)
    except urllib.error.HTTPError as error:
        if error.code not in (401, 403):
            raise ValueError("Unauthenticated project request was not denied correctly") from None
    else:
        raise ValueError("Unauthenticated project request unexpectedly succeeded")
    login = json.loads(request("/services/api/auth/login", payload={
        "email": config["SMOKE_EMAIL"], "password": config["SMOKE_PASSWORD"],
    }))
    token = login.get("accessToken")
    if not isinstance(token, str) or not token or any(ord(char) < 32 for char in token):
        raise ValueError("Login did not return a valid access token")
    project = json.loads(request(project_path, token=token))
    if project.get("id") != int(config["SMOKE_PROJECT_ID"]) or project.get("name") != config["SMOKE_PROJECT_NAME"]:
        raise ValueError("Ingress returned an unexpected project")


if __name__ == "__main__":
    try:
        config = configuration()
        if "--validate" not in sys.argv:
            check(config)
            print("TLS, unauthenticated denial, login, and project read passed.")
    except Exception:
        # HTTP errors can embed server content. Keep all failure output credential-free.
        print("Authenticated ingress smoke check failed; inspect configuration and service health.", file=sys.stderr)
        sys.exit(1)
