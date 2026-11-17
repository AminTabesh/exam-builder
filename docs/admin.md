# Administration

Open `/eadamine` in the existing app. The admin area uses its own green theme and supports desktop and phone layouts. Sign in with the same email/phone OTP system as the main app. When no administrator exists, the first successful login initiated from this page can claim administration. The claim is serialized in MongoDB so simultaneous logins cannot both win. There is no default password or automatic promotion through ordinary login.

`npm run db:migrate` adds role/status defaults, the membership coordination record, and indexes. Startup runs the same idempotent initialization. Existing users become `user`/`active`; existing explicit roles are preserved. The last active administrator cannot be demoted, suspended, or deleted. Recovery after manually corrupting roles requires restoring a known account directly in MongoDB; the UI does not bypass access controls.

Users can be searched and filtered, viewed, edited, promoted/demoted, suspended/reactivated, signed out on all devices, and permanently deleted. Verified email/phone values cannot be rewritten by the panel. Mutations require a reason. Deletion requires typing the account UUID and exposes cleanup status/retry in the deletion screen.

Subscription actions operate on app access, not provider billing. Grants/replacements start immediately and require an expiry; extension updates the existing administrative grant without resetting usage. Revocation forces the free plan until its expiry and preserves lifetime free-quota consumption. After an override expires, the normal purchased subscription applies again. Purchase history is immutable from the panel. Bazaar renewals/cancellations/refunds still require their provider workflow.

Deletion blocks login immediately, removes account content/files and operational records, and retains de-identified financial records and audit events. Bazaar token fingerprints remain reserved to prevent purchase replay; encrypted purchase tokens are removed. Failed cleanup is retried from the deletion screen. Deleting an account does not stop external provider billing. Database backups and content already saved on disconnected devices are outside this cleanup.

## API contract

All `/api/admin/*` responses are uncached. Except the bootstrap status and authenticated claim, all require an active admin role loaded from MongoDB. Missing login returns 401; insufficient role returns 403; conflicting operations return 409; invalid input returns 422.

- `GET /bootstrap`: `{available}`; `POST /bootstrap`: requires recent panel OTP authentication and returns the promoted user.
- `GET /overview`: account/exam/AI/order counts, effective paid-access count, purchase-status totals, recorded non-mock revenue, and recent audit entries.
- `GET /users?page=&q=&role=&status=&plan=`: `{items,total}`, 25 per page. `GET /users/:id`: profile, usage, orders, administrative access history.
- `PUT /users/:id`: `{name?,profile?,role?,status?,reason}`. `POST /users/:id/revoke-sessions`: `{reason}`.
- `POST /users/:id/subscription`: `{action:grant|extend|replace|revoke,planId,endsAt,reason}`. Existing catalog IDs only; ISO expiry required. Extension requires an active administrative grant and a later expiry.
- `DELETE /users/:id`: `{confirm:<UUID>,reason}` returns 202 `{id:<deletion job UUID>}`.
- `GET /orders?page=&owner_id=&status=`, `/usage?page=&owner_id=&status=`, `/audit?page=&actor=&target=&action=&from=&to=`, `/deletions?page=`: `{items,total}`. Usage excludes generated question content.
- `POST /deletions/:id/retry`: `{reason}`; missing jobs return 404.

Audit records are append-only through the API. Deletion redacts account references and identifying changes. Administrative mutations use MongoDB transactions with audit records; filesystem cleanup uses retryable deletion jobs.

Table list responses include `owner_id_user`, `actor_user`, or `target_user` summaries where applicable. Each summary contains only `id`, `name`, and `phone`, or is `null` when the referenced account no longer exists. These summaries are loaded in a single batch per page and never expose authentication fields.
