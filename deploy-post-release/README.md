# Post-Release Deploy Kit

This folder contains reusable scripts and a verification checklist for post-release deployment.

## Goal

Use these scripts after code updates to ensure:
- Service starts successfully
- Feishu channel is connected and can receive/reply
- Required plugins are loaded
- Required skills are present
- Known startup/plugin errors are not present in logs

## Files

- `01_publish_only.bat`: Publish deploy runtime only
- `02_restart_only.bat`: Restart service only
- `03_publish_restart_verify.bat`: Publish + restart + verification (recommended)
- `verify_post_release.ps1`: Automated runtime checks

## Recommended workflow

1. Double-click `03_publish_restart_verify.bat`
2. Confirm terminal shows `[OK] Publish + Restart + Verification passed.`
3. In Feishu, send a test message to the bot and confirm reply

## Manual fallback workflow

1. Run `01_publish_only.bat`
2. Run `02_restart_only.bat`
3. Run verification:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\verify_post_release.ps1
   ```

## What verification checks

- HTTP health check on `http://127.0.0.1:18789`
- `config.runtime.json` required plugin entries and allow-list
- Feishu policy:
  - `enabled=true`
  - `connectionMode=websocket`
  - `dmPolicy=open`
  - `requireMention=false`
  - `allowFrom` contains `*`
- Required skills:
  - `openclaw-aisa-web-search-tavily`
  - `find-skills`
  - `summarize`
  - `xiucheng-self-improving-agent`
- Recent `gateway.log` does not contain:
  - `Cannot find module 'axios'`
  - `feishu failed to load`
  - `failed to load plugin`
  - `plugins.allow is empty`

## Notes

- Default project path: `D:\OpenClaw\Develop\openclaw`
- Default deploy path: `D:\OpenClaw\deploy`
- If your paths differ, edit `verify_post_release.ps1` parameters or pass custom arguments.
