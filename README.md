# آزمون‌برگ — Exam authoring for teachers

Persian-first Vue 3 application with an independent Express API, MongoDB accounts and subscriptions, editable math/physics diagrams, private fonts, and A4 PDF output. Sign in with an Iranian phone number or email using a one-time code. No passwords or Mailpit are required.

## Local development

Requires Node.js 22.12+, npm, MongoDB with replica-set support, and Playwright Chromium for PDF generation.

```sh
npm ci
cp .env.example .env # only for a new installation; retain your existing secrets and database URI
npx playwright install chromium firefox
docker compose -f compose.dev.yaml up -d --wait
npm run db:migrate
```

Run the applications in **separate terminals**:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

Open **http://localhost:5173**. The API listens on port **3001**. With `OTP_DELIVERY=console` (the development default), phone and email codes print in the **backend terminal**:

```text
[DEV OTP] +989123456789: 123456 (5 minutes)
```

The console code shown here is an example. Use the fresh code from your own terminal. Email messages are constructed with Nodemailer without contacting SMTP in console mode. Development does not need an SMS account or email account. `npm run dev` optionally starts both applications together.

Root `.env` is loaded by the backend independently of the current working directory. Vite proxies `/api` to the backend. For a different local API address, set `API_INTERNAL_URL` when starting Vite; set `FRONTEND_PORT` for a different frontend port and keep backend `APP_URL` equal to that browser origin. Use the same hostname in the browser throughout a session.

To use a system Chromium, set `CHROMIUM_PATH` to its executable. Private images and uploaded fonts live under `ASSET_DIR`, resolved against the repository root unless absolute.

### Full Docker setup with local hot reload

Start Docker Desktop and set `MONGO_PASSWORD`, `SESSION_SECRET`, and `OTP_SECRET`
in the root `.env` (keep existing database credentials when reusing a volume).
Then run:

```sh
docker compose -f compose.yaml -f compose.local.yaml up --build -d
```

Open **http://localhost:5173**. The local override runs Vite with hot reload and
restarts the backend when backend/shared code changes. Source folders are mounted
from your checkout; dependencies and Chromium remain installed in the images.
Frontend polling supports file changes through Docker Desktop on macOS.
Login codes appear in `docker compose -f compose.yaml -f compose.local.yaml logs -f backend`.
Database and uploaded assets retain the same persistent volumes as before.

To inspect the local Docker database in MongoDB Compass, connect to
`mongodb://127.0.0.1:27018/exam?authSource=admin&directConnection=true`
with username `exam` and the `MONGO_PASSWORD` from your root `.env`.
The database port is bound only to this Mac; port 27018 avoids conflicting with
a native MongoDB installation. Direct connection avoids resolving the internal
replica-set hostname `db` from the host.

Edits to frontend source/styles, backend code, and shared code apply automatically.
After changing dependencies, Docker configuration, or `.env`, rerun the startup
command above. Frontend dependencies are installed in its Docker image, not by source bind mounts. If Vite reports a missing package after pulling dependency changes, rebuild only the frontend with `docker compose -f compose.yaml -f compose.local.yaml up -d --build --no-deps frontend`. Its `frontend-development` stage includes dev dependencies without the backend PDF browser. Production uses `compose.yaml` alone and keeps its built images.

### Existing MongoDB installations

Transactions require a replica set; a standalone MongoDB server will fail startup with an explanatory message. The development Compose file creates a single-member replica set. A local native MongoDB service can also be restarted with `--replSet rs0` and initialized once with `rs.initiate()`; adapt the member hostname to your deployment. Do not run two MongoDB processes against the same data directory or port. MongoDB Atlas replica sets also work.

For the supplied development setup, use:

```text
MONGODB_URI=mongodb://127.0.0.1:27017/exam?replicaSet=rs0
```

Keep backups before migrating an existing installation. The idempotent migration keeps user IDs, exam ownership, documents, revisions and assets, normalizes email addresses, removes password/token fields, and revokes old sessions. Existing users sign in by email OTP. Existing stored exam counts initialize lifetime usage; historical deleted exams cannot be reconstructed. Startup also ensures migrations/indexes, so run one migration job before starting multiple application instances.

Old browser-local guest exams are preserved. After signing in, visit **حساب و روش‌های ورود** and explicitly import them. Imports use creation allowance; successful imports remove their local originals. Failed imports keep local originals, and stable creation keys prevent duplicate imports after retries.

## Workspace structure

```text
apps/
  frontend/
    src/
      features/
        auth/components/       OTP login and verified identity linking
        billing/components/    Pricing and simulated checkout
        account/components/    Font selection and private uploads
        exams/                 Store, images, dashboard, editor and preview
      components/              Shared controls, icons and date field
    public/fonts/              Bundled licensed font files
    serve.js                   Production frontend server and API proxy
  backend/
    src/
      config/                  Root environment configuration
      middleware/              API errors
      modules/
        auth/                  OTP delivery, challenges and account routes
        billing/               Catalog, subscriptions, orders and quota service
        exams/                 Owned CRUD, revisions and isolated PDF rendering
        assets/                Private raster uploads and resource checks
        fonts/                 Validated private font storage and routes
      app.js                   Middleware and module composition
      db.js                    MongoDB connection, migrations and indexes
      index.js                 API startup and shutdown
packages/shared/               Exam schema, drawing model, fonts, print renderer,
                               pagination, date utilities and print styles
tests/                         Model/store/API tests and browser flows
scripts/                       Backups, isolated browser test server, PDF fixtures
```

Each application has its own workspace package. Install dependencies from the root with `npm ci`; dependencies are declared in the workspace that uses them. Shared code is imported through `@exam/shared`.

## Accounts and OTP delivery

- Phone input accepts `09…`, `+98…`, `0098…`, spaces, and Persian/Arabic digits; it stores one canonical Iranian number. Email identifiers are trimmed and lowercased.
- Codes are six digits, expire after five minutes, and allow five verification attempts. Resending requires 60 seconds and replaces the previous code. Identifier request limits are persisted in MongoDB; HTTP IP limits are process-local.
- Challenges are bound to the requesting session and, for linking, the signed-in owner. Only keyed digests are stored. Verification consumes a challenge atomically; successful sign-in rotates the session.
- A signed-in user can verify and link one email and one phone to the same account. An identifier belonging to another account cannot be linked or automatically merged.
- Production requires HTTPS, a strong `SESSION_SECRET`, and `OTP_SECRET`. Console delivery is rejected in production.

For real email, set `OTP_DELIVERY=providers`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional credentials, and `MAIL_FROM`. Nodemailer sends the code. The backend accepts an `smsProvider.sendOtp(phone, code)` adapter in `createApp` for a future SMS provider. Until a real provider is integrated, use console delivery locally. Missing providers produce a recoverable delivery error; they never authenticate a user.

## Plans and simulated payments

| Plan | Monthly price | Creation allowance | Maximum pages per PDF |
| --- | ---: | --- | ---: |
| Free | 0 | 3 lifetime | 2 |
| Standard | 149,000 toman | 30 per billing month | 10 |
| Professional | 299,000 toman | Unlimited | 30 |

The server catalog is authoritative. Amounts are integer IRR in orders and displayed as toman. All authoring tools, private images, bundled fonts and private font uploads are available on every plan.

Creation, duplication, and explicit import each count as creation. Every successful creation also increments lifetime usage, including paid-plan creation. Deletion does not refund quota; editing or exporting does not consume it. Free drafts can exceed two pages. The actual server-rendered page count controls PDF access, separately for student and answer-key output.

Subscriptions use UTC calendar months anchored to the purchase date, clamping dates in shorter months. Renewal extends the same plan with another month; it does not reset the current month's usage. Tier changes are available after expiry. There is no automatic billing. Expiry restores free limits while preserving existing exams and editing access.

The checkout is explicitly **simulated** and never charges money. Clicking purchase creates a persistent order, shows a processing screen, and calls a backend mock-provider confirmation. The backend atomically marks the order paid and creates a subscription period. Owner checks and idempotency protect refreshes, repeated callbacks and concurrent requests. Orders expire after 15 minutes. A real gateway must replace the mock-confirm route with provider verification/signed callbacks; redirect parameters alone must never grant service.

## Drawings, formulas and fonts

The editor includes vector formula shortcuts and an editable SVG drawing block. Draw arrows/vectors, lines/wires, circles, rectangles, triangles, angles, axes, and text; use force-diagram, inclined-plane and simple-circuit presets. Circuit symbols include batteries, resistors, switches and lamps. Components can be moved, resized, rotated, colored, duplicated or deleted, with snapping and undo/redo. Select a drawing and use **ویرایش شکل** to edit it again. Arrow keys move the selected component; Shift increases the step. Delete removes it; Ctrl/Cmd+Z undoes.

Drawings persist as versioned validated JSON, limited to 100 primitives, with escaped labels. SVG is generated from the shared allowlisted renderer; arbitrary uploaded SVG/HTML/scripts and external resources are not accepted. Diagrams are authoring aids, not physics simulators or graph solvers.

Choose an exam font under **سربرگ و تنظیمات برگه**. B Nazanin is the default exam font, bundled from the supplied B-NAZANIN.TTF file. Vazirmatn, Noto Naskh Arabic, and Noto Sans Arabic remain available locally with their licenses. Private TTF/OTF uploads require permission to use/embed the font, valid font data, a maximum of 5 MB per file and ten fonts per account. A font referenced by a saved exam cannot be deleted. Saved exams retain their explicit font selections; new exams and documents without a font selection default to B Nazanin. Preview and PDF load the same font assets before pagination; formulas retain KaTeX typography. Uploaded single-face fonts are declared at regular weight, with bold synthesis enabled within exam papers so titles remain bold.

Existing authoring features remain: Persian/English paper labels, school/university metadata, ten print styles, Jalali/Gregorian dates, private logos/images, multiple choice, blanks, written responses, exact scoring, section headings, drag sorting, automatic saving, revision conflicts and local recovery drafts.

## API

| Route | Purpose |
| --- | --- |
| `POST /api/auth/otp/request`, `/verify` | Request a code; verify and sign in |
| `POST /api/auth/identities/request`, `/verify` | Verify and link a second identifier |
| `GET /api/auth/me`, `POST /api/auth/logout` | Current user and logout |
| `PUT /api/auth/profile` | Reusable institution details |
| `GET /api/plans` | Public server-owned plan catalog |
| `GET /api/billing` | Current plan, usage, expiry and remaining allowance |
| `POST /api/billing/checkout` | Create order with `planId`, `idempotencyKey` |
| `GET /api/billing/orders/:id` | Owned order status |
| `POST /api/billing/orders/:id/mock-confirm` | Simulated provider confirmation |
| `GET`, `POST /api/exams` | Owned exams; create from `{document, creationKey?}` |
| `GET`, `PUT`, `DELETE /api/exams/:id` | Read, save `{document, revision}`, delete |
| `POST /api/exams/:id/duplicate` | Duplicate under creation quota |
| `POST /api/exams/:id/pdf` | `{revision, kind: "student" \| "answer-key"}` |
| `POST /api/assets`, `GET /api/assets/:id` | Private raster image upload/access |
| `GET`, `POST /api/fonts` | List/upload private fonts |
| `GET /api/fonts/:id/file`, `DELETE /api/fonts/:id` | Private font file/deletion |
| `GET /api/health` | Database readiness |

Password, recovery-link, guest creation and anonymous PDF endpoints have been removed. API failures include a stable `code` and a Persian `error`. Quota/page limits return HTTP 402; stale revisions and linking conflicts return 409. Account responses contain no authentication secrets.

## Verification

```sh
npm test
npm run build
npm run test:e2e
npm run test:pdf
```

API tests use an isolated real MongoDB replica set. An installed `mongod` is reused; otherwise `mongodb-memory-server` downloads it. `MONGOMS_SYSTEM_BINARY` can point to a specific binary.

Browser tests run an isolated backend on port 3101 and Vite on 5183, with Chromium, Firefox and a mobile viewport. They do not touch your development database. A test-only OTP lookup exists only in `scripts/e2e-server.js`, which is excluded from production images. Screenshots/traces and PDF fixtures go into `test-results`.

## Production

```sh
npm run build
npm start            # backend, terminal 1
npm run start:frontend # frontend, terminal 2
```

Or configure production secrets and SMTP in `.env`, then:

```sh
docker compose up --build -d
```

Compose runs an authenticated single-member MongoDB replica set, a migration job, separate backend/frontend containers, and persistent database/assets volumes. Only the frontend is exposed at `127.0.0.1:5173`. Put an HTTPS reverse proxy in front of it and forward the original `Host` and `X-Forwarded-Proto`; set `APP_URL` to that HTTPS origin. The backend trusts one proxy hop and is private to the container network. A single-member replica set supports transactions but is not a high-availability deployment.

PDF generation allows two simultaneous exports per backend process. Chromium permits only local bundled resources and the owner's images/fonts; it has no arbitrary remote fetch access. For multiple backend instances, add shared IP rate limiting and a PDF job queue. MongoDB-backed quotas and OTP identifier throttles already persist across processes. Logs omit question content and answers; OTP logging is development-only.

## Backup and restore

```sh
./scripts/backup.sh
```

The script stops backend writes, backs up the database and private assets (including fonts), then restarts the backend. Store backups securely and test restoration into a fresh deployment with the same application version:

```sh
docker compose stop backend
docker compose exec -T db sh -c 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --nsInclude "exam.*" --archive --gzip' < backups/DATE/database.archive.gz
docker compose run --rm --no-deps --entrypoint tar backend -C /app/data -xzf - < backups/DATE/assets.tar.gz
docker compose up -d backend
```

Verify owner-only image/font access and student/teacher PDFs after restoration.

## Licenses and print references

Bundled Vazirmatn and Noto fonts carry their licenses under `apps/frontend/public/fonts`. KaTeX fonts and Material Design Icons are bundled from their packages. Uploaded fonts remain the owner's responsibility to license for use and PDF embedding.

Print styles adapt familiar exam conventions, including [Cambridge specimen papers](https://www.cambridgeinternational.org/Images/743212-2028-specimen-paper-1-.pdf), [Overleaf exam-class](https://www.overleaf.com/latex/templates/exam-template/bvqshsvspxdt), and the [Medipol exam template](https://cn.overleaf.com/latex/templates/medipol-university-exam-template/cDynftdvwdhh.pdf), without reproducing institutional branding. Inspect joining, mixed-language formulas, diagrams, answer separation and page boundaries at 100% A4 scale before printing.

### AI question generation (Groq)

Set `GROQ_API_KEY` in the root `.env` (never a `VITE_` variable), then restart the backend. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`; any override must support strict structured outputs and the configured reasoning setting. `AI_DAILY_CALL_LIMIT` defaults to 100 provider attempts across the whole app per UTC day; set it to 0 to pause new calls. An empty key disables new generation. Run `npm run db:migrate` to create the AI usage and result-expiry indexes.

The **حرفه‌ای هوشمند** plan costs 499,000 toman/month (4,990,000 IRR), includes the professional plan's unlimited exams and 30-page exports, and permits 100 successful batches per subscription month, up to 10 questions per batch. Purchase uses the existing explicitly simulated checkout. Active subscribers must finish their existing subscription before changing plans. Real payment processing is not implemented.

In the editor's question step, open **تولید سؤال با هوش مصنوعی**. Supply a topic, paste a lesson, or select a text-based PDF. PDFs stay in the browser: PDF.js reads at most 10 selected pages from files up to 10 MB / 100 pages. Review extracted text (especially Persian ordering and formulas) and shorten it to 12,000 characters before generation. Scanned or encrypted PDFs require a readable text version; OCR is not included. Only the approved text and generation settings are sent to Groq, not the PDF or account/student metadata.

Choose difficulty, language, question counts and marks; review and edit the generated questions and answers, then add selected questions to the exam. A successful batch consumes one allowance even if none are inserted. Failed batches release the monthly reservation, although provider attempts still count against the shared daily cap. There is one in-flight request per account and two starts per minute. Timed-out reservations expire after two minutes. Provider calls time out after 60 seconds and are never automatically retried. Retry of the same request recovers a completed result without a second charge. Results expire after 24 hours; usage records retain only ownership, request hashes, status and accounting metadata. Sources are not stored in these records. Uninserted UI drafts persist only while the editor remains mounted; inserted questions use normal autosave.

`GET /api/ai/status` returns entitlement, availability, monthly limit, used/remaining allowance and period end. `POST /api/ai/generate` accepts a UUID `requestKey`, `topic`, `source`, `subject`, `grade`, `language` (`fa`/`en`), `difficulty`, `instructions`, `counts` (`mcq`/`blank`/`written`) and a marks string; it returns validated native question drafts plus updated usage. Server access checks apply regardless of UI state. AI errors have `AI_*` codes and user-facing messages; request logs contain timing/token metadata without source text or keys.

The shared free Groq quota can throttle this feature before individual monthly allowances are exhausted. Monitor `ai_completion`, `ai_provider_error`, and `ai_generation_failed` logs and adjust capacity before offering production service. Run `node --test tests/ai.test.js` and the browser tests matching `AI`; automated tests use an injected provider and never call Groq.

For an explicit live Persian/English quality check, run `node scripts/ai-smoke.js`. It uses the configured key and makes two small provider calls; the automated suite does not run it.

### Formula entry and mathematical choices

Question editors and choice fields share a visual formula palette. Buttons show rendered math; templates ask for bases, exponents, numerators, denominators, variable names and bounds. Insert a template at the cursor or replace selected text. To nest templates, focus a template input and choose another template, complete it, then finish the enclosing template. Choice fields show a rendered preview below their editable text.

Existing text choices and answer keys retain support for `$...$` mathematical spans (also accepting `\(...\)`, `\[...\]` and `$$...$$`). The same bounded, untrusted KaTeX renderer is used for editor previews, paper previews and PDFs. Invalid delimited formulas block export. AI conversion builds native formula nodes for question bodies, normalizes common escaped-command errors, and retains delimited math in choices and answers.

### Parabolas and visual placement

Choose **سهمی** in a question's rich editor to enter `y = ax² + bx + c` with Persian or English digits. The dialog previews the curve, axes, grid, vertex, and real roots. Drag the red vertex to translate the graph, adjust opening/direction, change axis bounds, or hide annotations before inserting. Double-click an inserted graph to edit it.

Select an image, drawing, or parabola to reveal corner resize handles and its placement toolbar. Drag **جابجایی** within the same rich editor to move between paragraphs; the left/right drop zones wrap text beside the visual. **در متن** restores block placement. Width, alignment, and move-up/down controls provide keyboard alternatives. Escape cancels a pointer gesture; undo restores its previous placement or size. Saved exams, previews, and PDFs retain these settings. Wrapped visuals and their following paragraphs stay together during pagination; reduce the visual or split the text if the group exceeds a page.

The parabola dialog supports **۱۲۳ فارسی / 123 لاتین** display modes, with the selected numerals retained in PDF output. Custom points can be added by coordinates or by enabling **افزودن با کلیک** and clicking/tapping the graph. Drag points to reposition them, edit their names/coordinates, or enable **روی منحنی** to snap new/moved points to the quadratic. Up to 30 points are supported; out-of-view points remain saved and **نمایش همهٔ نقطه‌ها** brings them into view. Equation presets, numeric vertex controls, curve colors, line thickness, and annotation toggles are available. Opening and visual-size controls share the keyboard-accessible themed `AppSlider` component.

## Android and mobile

The frontend now includes Capacitor Android, shared phone navigation/editing, account-scoped offline exam storage, full-screen authoring dialogs, native PDF save/share and Bazaar subscription integration. Opened exams are retained locally; sign-in, creation, purchases, AI and PDF generation remain online. Local saves are distinct from server sync and conflicting revisions are not overwritten.

Use `npm run android:sync`, `npm run android:debug` or `npm run android:release`. See [Android build and release instructions](docs/android/RELEASE.md) and the [dated Bazaar compliance matrix](docs/android/COMPLIANCE.md) for configuration, verification evidence and remaining store requirements. Signing secrets and Bazaar credentials are not bundled or committed. This source has not been submitted to Bazaar.

### Rich multiple-choice options

Each choice uses the question rich editor, including formulas, images, drawings and parabolas. Existing string choices remain readable; edited rich choices are stored as validated document nodes. Student and answer-key previews/PDFs render both formats. Option images follow the same private ownership checks, offline resource caching and upload-before-sync flow as question images.
