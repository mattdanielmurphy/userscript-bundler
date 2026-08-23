import subprocess, os, sys

def scan(base_path):
    print(f"\n=== Scanning {base_path} ===", flush=True)
    if not os.path.exists(base_path):
        return
    for item in sorted(os.listdir(base_path)):
        p = os.path.join(base_path, item)
        if os.path.islink(p):
            continue
        try:
            res = subprocess.run(['du', '-sh', p], capture_output=True, text=True, timeout=5)
            if res.returncode == 0 and res.stdout.strip():
                line = res.stdout.strip()
                # Only print if >= 100M or 1G
                if any(x in line.split('\t')[0] for x in ['G', 'M']):
                    print(line, flush=True)
        except Exception:
            pass

if __name__ == "__main__":
    scan("/Users/matt")
    scan("/Users/matt/Library")
    scan("/Users/matt/Library/Application Support")
    scan("/Users/matt/Library/Containers")
    scan("/Users/matt/Library/Group Containers")
