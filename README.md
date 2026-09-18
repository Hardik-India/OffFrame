# OffFrame

A complete Next.js / React application with Node.js API routes, MongoDB persistence, and server-side participation ID imprinting using Sharp. The site uses Poppins and the supplied OffFrame palette and artwork.

## Run locally

Requires Node.js 22.12+ (Node.js 24 recommended) and a reachable MongoDB Atlas cluster.

```sh
npm ci --include=dev
```

Copy `.env.example` to `.env.local`, configure the values, then run:

```sh
npm run dev
```

Open http://127.0.0.1:3000. The original workspace already has `.env.local` configured with the supplied MongoDB connection and admin credentials. The downloadable source archive intentionally excludes this private file.

Local origin checks use the actual loopback Host header to handle Next.js normalizing `127.0.0.1` to `localhost` internally. This development-only handling still requires the browser origin to match the host, protocol and port, and does not trust forwarded-host headers. Production should set `APP_ORIGIN` to the exact public HTTPS origin.

The origin fix is shared by **student login, student registration, email eligibility, and admin login**. When replacing an older copy with this archive, stop that copy's server, extract the new source, retain your private `.env.local`, then run `npm ci --include=dev` and `npm run dev` from the new `OffFrame` directory. Refresh the browser afterward. An older server left running on port 3000 will continue serving its old code even if a new ZIP has been downloaded.

## Before the event

1. Choose **Register as Admin** on the landing page. This opens the admin authentication panel; it does not create additional admin accounts. Sign in with the configured admin username and password. The original workspace is configured with the exact credentials supplied in the request.
2. Open **Event setup**. Import the pre-registered email sheet as CSV, using an `Email` or `Email Address` column. A single-column email list also works. Imports are additive and case-insensitive; duplicates are ignored and invalid rows are reported. Excel/Google Sheets files should first be exported as CSV.
3. Set the actual event date, opening time and closing time in IST. No event date has been assumed. The schedule is locked once submissions open, and final images remain locked permanently.
4. Participants use **Register as Student** to check their email against this list, then enter their name, college, year, branch and password. An email missing from the list receives “You have not registered for the event”.

The provided requirements define email verification as a match against the pre-registered email sheet. This application implements that eligibility check; it does not send an OTP or prove inbox ownership. No email delivery service was supplied.

## Included workflows

- **Landing:** the supplied reference composition, both logos, decorative film reels, Poppins, and the specified palette: `#553c13`, `#000`, `#ffd29a`, `#fff3e2`, `#97690f`.
- **Registration:** server-side eligibility checks on both steps, normalized unique emails, validated profiles, bcrypt password hashes, signed 12-hour sessions in HTTP-only cookies.
- **Login:** credential validation; missing student accounts are directed to registration. Student and administrator permissions are checked on every protected API route.
- **Dashboard:** About OffFrame, participant details, event status, participation ID download, draft image upload, deletion/replacement, and irreversible final submission.
- **ID card:** imprints the stored profile onto the supplied 2100 × 1200 template using the bundled Poppins font. Text wraps/fits within field bounds, including long college and branch names. The PNG is saved in MongoDB and an authenticated download link is saved to the user's document. A stable private route always resolves to the currently authenticated participant's card.
- **Submissions:** one record per student, with MongoDB's unique `_id` enforcing this rule. Only JPG, PNG and WebP still images are accepted, up to 10 MB and 25 megapixels. Sharp validates content, applies orientation, removes metadata and converts to PNG, with a maximum 3000-pixel longest edge and 8 MB stored PNG. Image processing is done in Node.js; Python is not required.
- **Final Upload:** requires an explicit confirmation and an open event window. A conditional atomic database write locks the entry. Neither later upload nor delete requests can change a finalized record. A draft that was not finalized before the deadline stays private and is excluded from the gallery.
- **Admin gallery:** all finalized entries, participant detail dialogs and PNG downloads, available to the admin during and after the competition.
- **Community gallery:** authenticated participants can see finalized entries only after closing time, view photographer details, like/unlike each image, and download PNGs. Likes are idempotent per account. Gallery pages contain up to 24 entries.
- **Setup:** CSV allowlist importer, participant/submission counts, and server-stored schedule controls.
- **Responsive UI:** desktop and mobile navigation, upload previews, loading/error/empty states, password visibility control, keyboard focus styles and modal focus management.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Private Atlas connection string; never exposed in client code. |
| `MONGODB_DB` | Application database. Defaults to `offframe`, separate from other `authdb` application data. |
| `SESSION_SECRET` | At least 32 random characters for signing sessions. |
| `ADMIN_USERNAME` | Defaults to `OFFFRAME`. |
| `ADMIN_PASSWORD` | Required server-side admin password. |
| `APP_ORIGIN` | Public HTTPS origin, e.g. `https://offframe.example.com`. Set for deployment; no trailing slash. |
| `SUBMISSION_OPENS_AT` | Optional fallback ISO timestamp with timezone offset, used before admin settings are saved. |
| `SUBMISSION_CLOSES_AT` | Optional fallback closing timestamp. |
| `EVENT_TIMEZONE` | Display zone, defaults to `Asia/Kolkata`. Admin schedule entry uses IST. |

Credentials are environment-configured so they are not hardcoded into the repository. Production sessions require HTTPS. Same-origin checks reject cross-site write requests. MongoDB-backed rate limits cover login, registration, upload and likes. Request bodies and image dimensions are bounded. Add platform-level per-IP request limits for an Internet-facing deployment.

## Data model

| Collection | Contents |
| --- | --- |
| `users` | Profile, password hash, ID-card link, creation date. Unique email index. |
| `eligibleEmails` | Normalized email allowlist with a unique email index. |
| `settings` | The single event schedule. |
| `submissions` | One document per participant; PNG binary, title, caption, final flag, timestamps and unique liker IDs. |
| `idCards` | Private ID-card PNGs keyed by participant. |
| `rateLimits` | Short-lived counters, automatically expired using a TTL index. |

Image bytes and lock state share a single MongoDB document, so finalization and replacement cannot race to alter a locked photo. The 8 MB image limit leaves room below MongoDB's 16 MB document limit. For very large events, migrate images to object storage and likes to a separate indexed collection.

## Production deployment

This is a real server application, not a static export. Use a Node.js container/server that supports MongoDB network connections, Sharp, and request bodies larger than 10 MB. The built-in Sites Worker host does not support the raw TCP connection required by this MongoDB driver; no public deployment was made there.

```sh
npm run build
npm start
```

Or use the included Dockerfile:

```sh
docker build -t offframe .
docker run --env-file .env.production -p 3000:3000 offframe
```

Create `.env.production` with the same private keys and the actual HTTPS `APP_ORIGIN`. The Docker image contains no `.env` files. Put an HTTPS reverse proxy in front of the container; allow a 12 MB request body and enough request time for PNG processing. Configure Atlas network access for the deployment server's outbound IP. The Node process needs at least 512 MB RAM; image conversion runs on the server. The application stores images in MongoDB, so no persistent local upload volume is required.

The local implementation is configured and tested. Publishing requires a compatible hosting destination and its deployment access.

## Verification

```sh
npm test
npm run test:integration
npm run build
```

The integration suite starts a separate server on port 3101 and creates a uniquely named `offframe_test_*` database in the supplied cluster. It tests real API/database behavior and removes only that temporary database afterward. The event database is not changed. It includes registration, authentication, role access, CSRF, ID generation, closed/open upload gates, replacement, deletion, final locks, gallery gates, like idempotency, PNG downloads, and logout. Run only with database credentials allowed to create and remove a temporary test database. Intermediate QA output is written to `../../work/qa` relative to the project.

## Source map

- `app/`: landing page, registration, login, student dashboard, gallery and admin routes.
- `app/api/[...path]/route.js`: authenticated Node.js API handlers.
- `components/`: shared brand, account forms and interactive dashboards.
- `lib/`: MongoDB connection, authentication, validation, event rules and image processing.
- `public/assets/`: the user-supplied logos, film reel and original ID template.
- `public/fonts/`: Poppins Medium for server-side ID imprinting, with its OFL license.
- `tests/`, `scripts/`: rule tests and a real MongoDB integration suite.

## References

Implementation references: [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [Next.js cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), [Sharp text/image inputs](https://sharp.pixelplumbing.com/api-constructor/). Poppins is bundled from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/poppins) under the included SIL Open Font License. The provided logos and template remain the user's supplied assets.
