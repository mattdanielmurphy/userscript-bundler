import os
import sys

def get_dir_size(path):
    total = 0
    try:
        for root, dirs, files in os.walk(path):
            # Skip virtual mounts and external drives
            if 'CloudStorage' in root or '.Trash' in root or 'com.apple.TimeMachine' in root:
                dirs[:] = []
                continue
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

def fmt(sz):
    return f"{sz / (1024**3):6.2f} GB"

def main():
    print("=== Scanning /System/Volumes/Data Roots ===", flush=True)
    roots = [
        "/Applications",
        "/Library",
        "/Users",
        "/private/var",
        "/opt",
        "/usr/local",
    ]
    for r in roots:
        if os.path.exists(r):
            print(f"Scanning {r}...", flush=True)
            sz = get_dir_size(r)
            print(f"{fmt(sz)} : {r}", flush=True)

    print("\n=== Scanning /Users/matt Top-Level ===", flush=True)
    matt = os.path.expanduser("~")
    for item in sorted(os.listdir(matt)):
        p = os.path.join(matt, item)
        if os.path.islink(p):
            continue
        if os.path.isdir(p):
            sz = get_dir_size(p)
            if sz > 500 * 1024 * 1024:
                print(f"{fmt(sz)} : {item}/", flush=True)
        elif os.path.isfile(p):
            sz = os.path.getsize(p)
            if sz > 100 * 1024 * 1024:
                print(f"{fmt(sz)} : [FILE] {item}", flush=True)

    print("\n=== Scanning /Users/matt/Library Top-Level ===", flush=True)
    lib = os.path.expanduser("~/Library")
    for item in sorted(os.listdir(lib)):
        p = os.path.join(lib, item)
        if os.path.islink(p):
            continue
        if os.path.isdir(p):
            sz = get_dir_size(p)
            if sz > 500 * 1024 * 1024:
                print(f"{fmt(sz)} : ~/Library/{item}/", flush=True)

if __name__ == "__main__":
    main()
