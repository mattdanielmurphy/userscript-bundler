import os
import shutil
import subprocess

PROJECTS_DIR = os.path.expanduser("~/projects")

artifact_patterns = [
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".astro",
    ".nuxt",
    ".cache",
    "__pycache__",
    ".pytest_cache",
    ".venv"
]

def get_dir_size(path):
    total = 0
    try:
        for root, dirs, files in os.walk(path):
            for f in files:
                try:
                    fp = os.path.join(root, f)
                    if not os.path.islink(fp):
                        total += os.path.getsize(fp)
                except Exception:
                    pass
    except Exception:
        pass
    return total

print(f"Scanning {PROJECTS_DIR} for build artifacts and dependency caches...", flush=True)

found = []
for root, dirs, files in os.walk(PROJECTS_DIR):
    # Don't recurse inside already matched artifact dirs
    to_remove = []
    for d in dirs:
        if d in artifact_patterns:
            full_p = os.path.join(root, d)
            sz = get_dir_size(full_p)
            if sz > 10 * 1024 * 1024: # > 10MB
                found.append((sz, full_p, d))
            to_remove.append(d)
    for r in to_remove:
        dirs.remove(r)

found.sort(key=lambda x: x[0], reverse=True)
total_sz = sum(x[0] for x in found)
print(f"\nFound {len(found)} artifact directories totaling {total_sz / (1024**3):.2f} GB:\n", flush=True)
for sz, p, name in found:
    print(f"{sz / (1024**2):7.1f} MB : {p}", flush=True)
