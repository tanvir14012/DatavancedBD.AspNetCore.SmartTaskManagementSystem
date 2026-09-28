"""Check only the ephemeral listener started by this kubectl child process."""
import os
import re
import selectors
import subprocess
import sys
import time
import urllib.error
import urllib.request


def check_service(namespace, service, paths, timeout=60):
    process = subprocess.Popen(
        ["kubectl", "-n", namespace, "port-forward", "--address", "127.0.0.1",
         f"service/{service}", ":8080"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    try:
        deadline = time.monotonic() + timeout
        output = b""
        port = None
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            while port is None:
                if process.poll() is not None:
                    raise RuntimeError(f"Port-forward for {service} exited before binding")
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f"Port-forward for {service} did not bind")
                if selector.select(min(remaining, 0.5)):
                    chunk = os.read(process.stdout.fileno(), 4096)
                    if not chunk:
                        raise RuntimeError(f"Port-forward for {service} closed its output")
                    output = (output + chunk)[-8192:]
                    match = re.search(rb"Forwarding from 127\.0\.0\.1:(\d+) -> 8080", output)
                    if match:
                        port = int(match[1])
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for path in paths:
            while True:
                if process.poll() is not None:
                    raise RuntimeError(f"Port-forward for {service} exited during checks")
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f"Health check for {service} timed out")
                try:
                    with opener.open(f"http://127.0.0.1:{port}{path}", timeout=min(5, remaining)) as response:
                        if response.status != 200:
                            raise RuntimeError(f"Unexpected health status for {service}")
                    if process.poll() is not None:
                        raise RuntimeError(f"Port-forward for {service} exited after request")
                    break
                except (urllib.error.URLError, TimeoutError):
                    time.sleep(min(0.25, max(0, deadline - time.monotonic())))
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        process.stdout.close()


if __name__ == "__main__":
    try:
        check_service(os.environ["NAMESPACE"], sys.argv[1], sys.argv[2:])
    except (OSError, RuntimeError, TimeoutError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
