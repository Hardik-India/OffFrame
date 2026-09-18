# Verification

Completed on 18 September 2026.

- Production Next.js build: passed. All six application pages and the Node.js API route compile successfully.
- Unit tests: 9 passed, including exact opening/closing boundaries, UTC/IST conversion and shared student/admin origin validation.
- Local admin regression: reproduced the incorrect 403 for a browser at `127.0.0.1:3000` when Next.js normalized the internal request URL to `localhost:3000`. Fixed development origin resolution; verified real admin login returns 200 and the authenticated role is `admin`. Unrelated origins and mismatched local origins still return 403.
- Real MongoDB integration suite: 52 API checks passed with `APP_ORIGIN` blank, matching the supplied local configuration. Student registration and successful login were tested on `127.0.0.1`; a second successful student login and authenticated student session were verified on `localhost`. Admin login also passed. All authentication routes reject unrelated origins. The temporary test database was removed successfully.
- Dependency audit: 0 known vulnerabilities reported by `npm audit --omit=dev`.
- Browser checks: desktop landing and account pages; student sign-in, dashboard, gallery, photographer dialog and live like count; mobile layout with no horizontal overflow; administrator access and event setup.
- ID card: generated PNG inspected at 2100 × 1200 with Poppins, the original template, and a long college/branch name. The personalized image and user download link were saved and retrieved through the API.
- Integration accounts, images and schedules used a separate, temporary database. Its cleanup is verified separately from the event database.

The supplied MongoDB connection was tested successfully. No real participant list or event date was supplied, so production registration has no eligible email entries and image submission remains closed until an administrator configures the event.

No public deployment or Docker execution was performed. The complete source, production build configuration, Dockerfile and hosting instructions are included. The built-in Sites host cannot run the MongoDB TCP driver required by this application.
