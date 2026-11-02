# آزمون‌برگ — Persian-first exam builder

A self-hostable Vue 3 / JavaScript application for teachers. The interface is Persian; printable exams can be Persian or English. The dashboard includes a sample exam and an explicitly labeled, browser-only guest workspace.

## Start locally

Use Node.js 22.12+ and npm. MongoDB 8 and SMTP are required for accounts, but not for trying guest authoring.

```sh
npm ci
cp .env.example .env
npx playwright install chromium firefox
npm run dev
```

Open **http://localhost:5173**. Choose **شروع با آزمون نمونه** to explore all three steps. Guest exams remain in this browser; clearing site data removes them. PDF downloads use the Express backend on port 3001 and require Chromium. To use a system Chromium instead, set `CHROMIUM_PATH` to its executable. No remote fonts, icon services or formula CDNs are used.

For account functionality, start the development database and local email inbox:

```sh
docker compose -f compose.dev.yaml up -d
npm run db:migrate
```

On macOS without Docker, install Mailpit with `brew install mailpit`, then run it in a separate terminal:

```sh
mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025
```

Set `SMTP_HOST=127.0.0.1` in `.env` and restart the app. Keep Mailpit running while testing registration. Its inbox is at **http://localhost:8025**; the application sends verification emails to SMTP port **1025**. The URL only works while Mailpit is running.

Alternatively, run a local MongoDB service and set `MONGODB_URI=mongodb://127.0.0.1:27017/exam`, or supply a MongoDB Atlas URI. `MONGODB_DB` optionally overrides the database name. Run `npm run db:migrate` to create indexes; startup also ensures them automatically. Password-reset and verification tokens are embedded as bounded, expiring token digests in user documents and consumed atomically, so a standalone MongoDB server is sufficient. Sessions use MongoDB with a TTL index.

This switches storage for new account data. Existing PostgreSQL records are not imported automatically; browser-only guest exams remain intact. Keep any old PostgreSQL backups if you need a separate data import.

The supplied `.env.example` matches these development services. Registration and password-recovery messages appear at **http://localhost:8025** (Mailpit). Open the verification link, confirm it, then sign in. Guest exams are not silently merged into an account. SMTP credentials and a real mail sender are needed in production.

## What is implemented

- Persian RTL dashboard, search, exam duplication and confirmed deletion; reusable institutional details.
- Three-step authoring with school/university metadata, Persian/English print labels, calendar choice, instructions, logo, closing message and awarded-score box.
- Multiple choice with 2–6 options, explicit inline blanks, written answer space, section headings, duplicate, undo deletion, drag sorting and keyboard-accessible move controls.
- Tiptap structured content, bold/italic, local KaTeX formula entry and preview, owned image upload, selectable image width, adjustable blank widths and response lines.
- Exact hundredth-point scoring, field validation and separate student/teacher output.
- Autosave with server revision checks, local recovery drafts, reconnect retry and explicit conflict actions. A full local cache prevents navigation if a save has also failed.
- Email verification, password recovery, bcrypt over SHA-256 password digests, expiring single-use tokens, session rotation and session revocation after password reset.
- MongoDB account, session, exam and asset documents; private raster image files. Images are decoded, resized and rewritten as WebP; SVG is rejected.
- Shared Vue print renderer and measured A4 pagination, repeated continuation headers, exact page-count footers, manual breaks and block-boundary splitting. Oversized blocks and horizontal overflow produce errors instead of clipped output.
- PDF generation waits for fonts and images, blocks external resource requests and admits only the owner's assets. PDFs are generated on demand without server retention. Two concurrent exports per process are allowed; excess requests receive a retryable response.

The optional date picker supports Jalali and Gregorian calendars and converts the selected day when switching calendars. A long paragraph, formula or image that cannot fit on a page must be shortened or divided into paragraphs. Images can be resized using the width control while selected. A question's model answer is plain text. Guest mode supports text and formulas; uploading private assets requires a verified account.

## Architecture

```text
src/                    Vue interface, Pinia, Vue Router, Vuetify
  components/           Dashboard, builder, rich editor, paper preview, account
  stores/exams.js        Account API and guest persistence
shared/exam.js          Document schema, fixtures, exact scoring, validation
shared/PrintDocument.js Shared Vue renderer for preview and server-side printing
shared/paginate.js      Browser-measured block pagination
shared/print.css        Print-only typography and page geometry
server/app.js           Authenticated Express API and ownership checks
server/pdf.js           Isolated Chromium export with resource allowlist
server/db.js            MongoDB connection and idempotent indexes
fixtures/               Persian and English example documents
```

Tailwind v3 utilities use the `tw-` prefix and disable Preflight. Vuetify supplies interactive controls, menus and dialogs. The app theme and Tailwind configuration share navy, neutral surfaces and Vazirmatn. Print styles are scoped separately and loaded without application CSS by the export server.

The exam document has `schemaVersion: 1`; exam records have a monotonically increasing `revision`. A stale save or export returns HTTP 409. Full historical revisions are not retained. Asset files use generated names and are never exposed through a public static directory. Deleting an exam does not delete reusable assets; include the asset volume in storage planning.

## API

| Route                                          | Purpose                                       |
| ---------------------------------------------- | --------------------------------------------- |
| `POST /api/auth/register`, `/login`, `/logout` | Account and session lifecycle                 |
| `GET /api/auth/me`                             | Current account                               |
| `POST /api/auth/recover`, `/resend`, `/token`  | Recovery and email verification               |
| `PUT /api/auth/profile`                        | Reusable institution fields                   |
| `GET`, `POST /api/exams`                       | Owned exams; create from `{document}`         |
| `GET`, `PUT`, `DELETE /api/exams/:id`          | Read, save `{document, revision}`, delete     |
| `POST /api/exams/:id/duplicate`                | Duplicate an owned exam                       |
| `POST /api/assets`                             | Multipart `image`, at most 5 MB               |
| `GET /api/assets/:id`                          | Authenticated owner-only image                |
| `POST /api/exams/:id/pdf`                      | `{revision, kind: "student" \| "answer-key"}` |
| `POST /api/demo/pdf`                           | Rate-limited guest export; no uploaded assets |
| `GET /api/health`                              | Database readiness (200 or 503)               |

## Verification

```sh
npm test                     # Model and socket-free Express API tests
npm run build                # Production compilation
npm run test:e2e              # Chromium, Firefox and mobile viewport flows
node scripts/pdf-fixtures.js # Persian, English, answer keys and long-page PDFs
```

The API tests start an isolated real MongoDB process using `mongodb-memory-server`, with the same driver, indexes and persistent session store used in production. An installed `mongod` on PATH is reused; otherwise the test runner downloads its binary. Set `MONGOMS_SYSTEM_BINARY` to use another installed executable. Tests cover registration, verification, password recovery, expiration, ownership, stale revisions, session persistence and institution profiles.

Browser tests cover guest onboarding with an error correction, save/reload, duplication, undo, revision conflicts, pagination, mobile overflow, keyboard focus and PDF download. Screenshots, traces and PDFs go into `test-results/`.

Manual release checklist:

1. Register using the configured SMTP service; verify, sign in, recover the password and confirm an old session is rejected.
2. Create one question of each type using only keyboard navigation. Check RTL step order, dialog focus, validation and deletion undo.
3. Test at 390 px width and with reduced motion enabled; no horizontal app scrolling.
4. Inspect Persian joining, نیم‌فاصله, English punctuation and mixed-language math at 100% print scale.
5. Inspect long questions, large images, manual breaks, answer space and closing-message placement; confirm every page footer and absence of blank trailing pages.
6. Confirm student PDFs contain no model answers. Print both Persian and English fixtures on A4 with 100% scale.
7. Disconnect during editing, reconnect, and confirm recovery. Edit the same account exam in two tabs; confirm the conflict choices preserve the local version.
8. Verify with two real accounts that exams, uploaded images and exports remain isolated.

## Production deployment

Configure `.env` with a strong random `SESSION_SECRET` (at least 32 characters), a random URL-safe `MONGO_PASSWORD`, an **HTTPS** `APP_URL`, SMTP values and `MAIL_FROM`. Use a hex password for MongoDB to avoid URL-encoding ambiguity.

```sh
docker compose up --build -d
```

Compose starts MongoDB, creates the required indexes and starts the application. Chromium and its system dependencies are installed into the application image. Place an HTTPS reverse proxy on the host in front of `127.0.0.1:3001`; forward the original `Host` and `X-Forwarded-Proto` headers. The application trusts one proxy hop and sets secure, HTTP-only, same-site session cookies in production. Production startup refuses a non-HTTPS public URL or a short session secret.

Persistent data is in the `mongo-database` and `assets` volumes. The container runs as the unprivileged `node` user. Chromium runs without its inner sandbox inside the container; keep Docker's default security profile, do not expose a debugging port and do not run the container privileged. The image and the application need no outbound network requests during export.

The Compose setup runs one app process. Rate limits and export concurrency are process-local; add a shared rate-limit store and a job queue before horizontal scaling. SMTP sends directly; an unavailable mail server reports a recoverable error. A user whose registration email failed can sign in and request another verification email.

Structured export logs contain event type, timing, page count and output kind, never question contents or answers. PDF failures log an error code. No request-body logging is enabled.

## Backup and restore

Back up the database and asset volume together; both contain private teaching material. The backup script briefly stops the app for consistency, writes a compressed MongoDB archive and a compressed asset archive, then restarts it.

```sh
./scripts/backup.sh
```

Store backups encrypted off-host and test restoration regularly. To restore into a **fresh** Compose installation with the same application version:

```sh
docker compose stop app
docker compose exec -T db sh -c 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --nsInclude "exam.*" --archive --gzip' < backups/DATE/database.archive.gz
docker compose run --rm --no-deps --entrypoint tar app -C /app/data -xzf - < backups/DATE/assets.tar.gz
docker compose up -d app
```

Restore only trusted archives. Verify owner-only asset access, exam count and one student/teacher PDF pair after restoring.

## Design references and licenses

The print layouts follow familiar exam conventions; they make no certification claim. References: [Persian sample](https://www.arefonline.ir/wp-content/uploads/2025/05/taalifi-7_Compressed.pdf), [English specimen](https://www.cambridgeinternational.org/images/255832-2018-paper-2-specimen-paper.pdf), [Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf), and [Tailwind Preflight guidance](https://tailwindcss.com/docs/preflight).

Vazirmatn is bundled locally under the SIL Open Font License (`public/fonts/OFL.txt`). Material Design Icons are bundled as SVG paths from `@mdi/js`; KaTeX and its fonts are bundled through npm. Third-party licenses remain in their packages. No student accounts, collaborative banks, AI question generation, document import or payments are included.
