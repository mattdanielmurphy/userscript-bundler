# Userscript Control API Specification

The Userscript Control API is hosted locally by `local-automation-server` at `http://127.0.0.1:3033/api/userscripts`.

## Security Architecture & Loopback Isolation

- **Interface:** Binds strictly to `127.0.0.1`. Must never be exposed to public networks, tunnels, or non-loopback IPs.
- **Authentication:** Requires `X-Local-Automation-Key` (or legacy `X-Gemini-Thread-Saver-Key`) header.
- **Path Authorization:** Server authorization for Git history, diffs, and restores is strictly derived from the trusted server-loaded `script_manifest.json`. Client-supplied file paths are strictly ignored.
- **Subprocess Safety:** All subprocesses use `child_process.execFile` with explicit argument arrays. Shell interpolation is strictly forbidden.
- **Mutation Serialization:** Restore and rebuild operations acquire an in-memory lock (HTTP 409 returned if concurrent mutation attempted).

## Endpoints

### 1. `GET /api/userscripts`
Returns a sanitized summary of all manifest-registered scripts, repository HEAD, and dirty working tree status.

**Response Example:**
```json
{
  "ok": true,
  "data": {
    "scripts": [
      {
        "id": "gemini-enhancements",
        "name": "Gemini Enhancements",
        "description": "Timestamps, thread token counter, private local Markdown archiving, prompt tools, model optimizer, and terminal command execution for Gemini",
        "kind": "grouped",
        "matches": ["https://gemini.google.com/*"],
        "sourceFiles": ["gemini-enhancements/00-bootstrap.js"],
        "sharedFiles": [],
        "git": {
          "head": {
            "sha": "0e0c865...",
            "subject": "refactor(gemini): split source",
            "date": "2026-07-21T..."
          },
          "workingTree": {
            "dirty": false,
            "affected": false
          }
        }
      }
    ],
    "repository": {
      "branch": "main",
      "headSha": "0e0c865...",
      "bundleBuiltAt": "2026-07-21T..."
    }
  }
}
```

### 2. `GET /api/userscripts/:scriptId/history?limit=30`
Returns commits relevant strictly to the target script's declared allowed source paths.

**Response Example:**
```json
{
  "ok": true,
  "data": {
    "scriptId": "gemini-thread-saver",
    "commits": [
      {
        "sha": "0e0c865123456789abcdef0123456789abcdef01",
        "shortSha": "0e0c865",
        "subject": "feat: update gemini script",
        "author": "Matt",
        "date": "2026-07-21T...",
        "isHead": true,
        "eligibleForRestore": true
      }
    ]
  }
}
```

### 3. `GET /api/userscripts/:scriptId/diff?from=<sha>&to=HEAD`
Returns sanitized diff totals and a truncated patch preview (max 20 KB) for the script's allowed paths.

### 4. `POST /api/userscripts/:scriptId/restore`
Requests a targeted Git rollback of only the specified script's source paths.

**Request Body:**
```json
{
  "commitSha": "0e0c865123456789abcdef0123456789abcdef01",
  "confirmDirty": false
}
```

**Restore Flow:**
1. Validates `scriptId` against trusted manifest registry.
2. Validates `commitSha` is present in that script's log history.
3. Acquires exclusive mutation lock.
4. Checks dirty state of script source files. If dirty and `confirmDirty: false`, aborts with HTTP 409.
5. Creates a checkpoint ref `userscript-control/pre-restore/<timestamp>-<script-id>`.
6. Executes `git restore --source <commitSha> -- <allowedPaths>`.
7. Executes `pnpm build`. If build fails, rolls back source files to pre-restore state and returns error.
8. Stages restored paths and `userscript_bundle.js`.
9. Creates new rollback commit: `rollback(<script-id>): restore sources from <shortSha>`.
10. Releases lock.

### 5. `POST /api/userscripts/rebuild`
Triggers `pnpm build` under exclusive mutation lock.

### 6. `GET /api/userscripts/status`
Returns current server status, active mutation details, and last build result.
