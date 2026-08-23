import subprocess
import os

def run(cmd):
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return res.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

print("=== /Library Top Directories ===")
print(run("du -sh /Library/Developer /Library/Application\ Support /Library/Caches /Library/Audio 2>/dev/null"))

print("\n=== /Users/matt Top Directories ===")
print(run("du -sh /Users/matt/Desktop /Users/matt/Documents /Users/matt/Downloads /Users/matt/Movies /Users/matt/Music /Users/matt/Pictures /Users/matt/projects /Users/matt/.cache /Users/matt/.local /Users/matt/.bun /Users/matt/.cargo /Users/matt/.rustup 2>/dev/null"))

print("\n=== /Users/matt/Library Top Directories ===")
print(run("du -sh /Users/matt/Library/Application\ Support /Users/matt/Library/Caches /Users/matt/Library/Containers /Users/matt/Library/Group\ Containers /Users/matt/Library/Developer 2>/dev/null"))

print("\n=== /private/var Top Directories ===")
print(run("du -sh /private/var/folders /private/var/vm /private/var/log /private/var/tmp 2>/dev/null"))
