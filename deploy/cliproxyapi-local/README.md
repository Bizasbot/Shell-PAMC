# CLIProxyAPI local deployment add-ons

Local sidecars that run next to `cli-proxy-api` and `oh-my-cpa` (Shell-PAMC).

| Path | Purpose |
|---|---|
| `quota-ledger/` | Orders credentials by real quota so the tokens that are about to reset are spent first. |
| `profile-models/` | Serves `GET /models` for the dashboard's "Modelos llamados" panel from terminal sessions. |
| `docker-compose.yml` | Reference compose with both sidecars. Secrets come from `.env`, never from this file. |

## quota-ledger

Rule, applied to every provider Shell-PAMC reads (Antigravity, Claude, Codex, Kimi, xAI, Devin, Meta, plugins):

1. A credential is eligible only with a fresh reading, at least 10% of its 5-hour window left
   (`MIN_FIVE_HOUR`) and a non-exhausted weekly window. A failed or stale reading keeps it out until
   the window refills.
2. Eligible credentials are ordered by the soonest started 5-hour reset, then by the scarcer remaining
   fraction. Windows that have not started report a rolling `now + 5h` reset and form one stable group.
3. Antigravity quota is split per model family, but routing priority is one number, so an account must
   be eligible in both `claude_gpt` and `gemini`.
4. Only the CPA `priority` field is written. Credentials are never disabled. A provider with a single
   account is left untouched. If more than half the readings fail, the cycle changes nothing.

```
node --test                          # unit tests
CPA_KEY=... node service.mjs once    # dry run
CPA_KEY=... node service.mjs once --apply
CPA_KEY=... node service.mjs restore # restore priorities saved in backup/auth-state-before.json
```

Kill switch: create `quota-ledger/DISABLED` next to `service.mjs` and the loop stops writing.

Required environment: `CPA_BASE`, `CPA_KEY` (CPA management key), `OMC_BASE`, optional `OMC_KEY`,
`INTERVAL_S`, `MIN_FIVE_HOUR`, `APPLY=1`.
