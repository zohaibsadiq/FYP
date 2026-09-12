# Backend fixes to apply after the rewrite workflow

Sourced from the DRF/Neon research pass. Files are being edited by the rewrite
agents right now, so these are applied afterwards to avoid conflicts.

## Blocking (causes production errors)

1. `config/settings.py` — `CONN_MAX_AGE = 600` against Neon's 300s autosuspend.
   First request after an idle spell hits a dead connection and 500s.
   Fix: `CONN_HEALTH_CHECKS = True`, drop `CONN_MAX_AGE` to 120, both env-tunable.

2. `config/settings.py` — `DATABASE_URL` points at the `-pooler` endpoint, which
   is PgBouncer in transaction mode. Server-side cursors are connection-local and
   break there, and `QuerySet.iterator()` uses them.
   Fix: `DISABLE_SERVER_SIDE_CURSORS = True`. Never set `server_side_binding`.
   Add `DATABASE_URL_DIRECT` for migrations and the future pgvector index build.

3. `config/settings.py` — `SECRET_KEY` has a dev default and `DATABASE_URL`
   silently falls back to SQLite with a `print()`. A misconfigured production
   deploy boots with a known signing key and an empty database.
   Fix: raise `ImproperlyConfigured` when `DEBUG` is False and either is missing.

## Correctness

4. `wardrobe/models.py` — `mark_worn()` does `self.wear_count += 1` in Python.
   Two concurrent requests lose an increment, and `cost_per_wear` reads wrong.
   Fix: `F("wear_count") + 1`.

5. `wardrobe/views.py` — `bulk_move` uses `.update()`, which skips `auto_now`, so
   moved items keep a stale `updated_at`.
   Fix: pass `updated_at=timezone.now()` in the update.

6. `wardrobe/models.py` — `__str__` dereferences `self.owner.email`, one extra
   query per row in the admin changelist.
   Fix: drop the email; add `list_select_related` in admin.py.

## Before the closet grid ships

7. Missing index on `(owner, -created_at)`, which is the default ordering of the
   list endpoint.
8. `seasons` / `occasions` ArrayField `contains` lookups are unindexed. Needs GIN.
9. Search is `icontains`; a trigram index is ignored unless the lookup changes.
   Low-literacy users misspell, so fuzzy search via `pg_trgm` is worth it.

## Before try-on ships

10. No throttling in front of paid AI calls.
11. `rembg` runs in the request cycle. Acceptable at current size; the upload
    endpoint is the first place that stops being true.
12. No API versioning. Cheaper to add now than after the client hardcodes paths.

## Upload hardening

13. Upload trusts the client `Content-Type` and decodes before checking
    dimensions. Decompression-bomb and OOM risk.
    Fix: verify with Pillow, cap pixel count before `load()`.
