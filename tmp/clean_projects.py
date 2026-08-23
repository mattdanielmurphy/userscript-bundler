import os, sys, subprocess

PROJECTS_DIR = os.path.expanduser("~/projects")
targets = ["node_modules", "target", "dist", "build", ".next", ".turbo", ".astro", ".nuxt", "__pycache__", ".pytest_cache", ".venv", "tmp"]

print(f"=== Scanning build artifacts in {PROJECTS_DIR} ===", flush=True)

for root, dirs, files in os.walk(PROJECTS_DIR):
    to_remove = []
    for d in dirs:
        if d in targets:
            full_path = os.path.join(root, d)
            to_remove.append(d)
            try:
                res = subprocess.run(['du', '-sh', full_path], capture_output=True, text=True, timeout=5)
                if res.returncode == 0 and res.stdout.strip():
                    sz_str = res.stdout.strip().split()[0]
                    if any(unit in sz_str for unit in ['G', 'M']):
                        # Only print if substantial
                        if 'G' in sz_str or (sz_str.endswith('M') and float(sz_str[:-1]) > 50):
                            print(f"{sz_str:>8} : {full_path}", flush=True)
            except Exception:
                pass
    for d in to_remove:
        dirs.remove(d)
