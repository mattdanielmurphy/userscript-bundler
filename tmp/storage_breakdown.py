import os
import sys

def get_dir_size(path, max_depth=1, current_depth=0):
    total = 0
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    if entry.is_symlink():
                        continue
                    if entry.is_file():
                        total += entry.stat().st_size
                    elif entry.is_dir():
                        total += get_dir_size(entry.path, max_depth, current_depth + 1)
                except Exception:
                    pass
    except Exception:
        pass
    return total

def format_size(size_bytes):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:6.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:6.2f} PB"

def scan_folder_children(path):
    print(f"\n--- Scanning children of {path} ---")
    items = []
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    if entry.is_symlink():
                        continue
                    if entry.is_file():
                        sz = entry.stat().st_size
                    else:
                        sz = get_dir_size(entry.path)
                    items.append((sz, entry.path, entry.name))
                except Exception:
                    pass
    except Exception as e:
        print(f"Error scanning {path}: {e}")
        return

    items.sort(key=lambda x: x[0], reverse=True)
    for sz, p, name in items[:20]:
        if sz > 50 * 1024 * 1024:  # > 50MB
            print(f"{format_size(sz):>12} : {name}")

def find_large_files(start_path, min_size_mb=200):
    print(f"\n--- Files larger than {min_size_mb}MB in {start_path} ---")
    min_bytes = min_size_mb * 1024 * 1024
    large_files = []
    for root, dirs, files in os.walk(start_path):
        for f in files:
            p = os.path.join(root, f)
            try:
                if not os.path.islink(p):
                    sz = os.path.getsize(p)
                    if sz >= min_bytes:
                        large_files.append((sz, p))
            except Exception:
                pass
    large_files.sort(key=lambda x: x[0], reverse=True)
    for sz, p in large_files[:30]:
        print(f"{format_size(sz):>12} : {p}")

if __name__ == "__main__":
    scan_folder_children(os.path.expanduser("~"))
    scan_folder_children(os.path.expanduser("~/Library"))
    scan_folder_children(os.path.expanduser("~/Library/Containers"))
    scan_folder_children(os.path.expanduser("~/Library/Group Containers"))
    scan_folder_children(os.path.expanduser("~/Library/Application Support"))
    scan_folder_children(os.path.expanduser("~/Library/CloudStorage"))
    find_large_files(os.path.expanduser("~"), min_size_mb=300)
