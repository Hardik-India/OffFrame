// Runs the real API against a newly created, isolated MongoDB test database.
// Never changes the configured event database; removes only its own temporary database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import sharp from "sharp";
import { writeFile, mkdir, access, rm } from "node:fs/promises";
const base = "http://127.0.0.1:3101";
const testDbName = `offframe_test_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const client = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 8000,
});
// Match the shipped local configuration: no explicit NEXT_PUBLIC_BASE_URL. This
// exercises Next's localhost URL normalization for student/admin login and registration.
const env = {
  ...process.env,
  MONGODB_DB: testDbName,
  OFFFRAME_TEST_BUILD: "1",
  NEXT_PUBLIC_BASE_URL: "",
  NODE_ENV: "development",
  ADMIN_USERNAME: "OFFFRAME",
  ADMIN_PASSWORD: "TestAdminPassword!2026",
  SESSION_SECRET: randomUUID() + randomUUID(),
};
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--port",
    "3101",
    "--hostname",
    "127.0.0.1",
  ],
  { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
server.stdout.on("data", (b) => (log += b));
server.stderr.on("data", (b) => (log += b));
const cookies = {};
let checks = 0;
async function request(path, method = "GET", body, who, expected = 200) {
  const headers = { Origin: base };
  if (who && cookies[who]) headers.Cookie = cookies[who];
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers,
    body,
  });
  if (who && response.headers.get("set-cookie"))
    cookies[who] = response.headers.get("set-cookie").split(";")[0];
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${await response
      .clone()
      .text()
      .then((x) => x.slice(0, 300))}`,
  );
  checks++;
  return response.headers.get("content-type")?.includes("application/json")
    ? response.json()
    : Buffer.from(await response.arrayBuffer());
}
let database;
try {
  await client.connect();
  database = client.db(testDbName);
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) break;
    } catch {}
    if (i === 89) throw new Error("Test server did not start");
    await new Promise((r) => setTimeout(r, 1000));
  }
  await request("event");
  await request("me", "GET", undefined, undefined, 401);
  const csrf = await fetch(`${base}/api/auth/eligibility`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
    body: JSON.stringify({ email: "student@example.com" }),
  });
  assert.equal(csrf.status, 403);
  checks++;
  for (const route of ["auth/login", "auth/register", "auth/admin"]) {
    const blocked = await fetch(`${base}/api/${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: "{}",
    });
    assert.equal(
      blocked.status,
      403,
      `${route} must reject cross-site requests`,
    );
    checks++;
  }
  await request(
    "auth/eligibility",
    "POST",
    { email: "missing@example.com" },
    undefined,
    403,
  );
  await request(
    "auth/login",
    "POST",
    { email: "missing@example.com", password: "NotRegistered!" },
    undefined,
    404,
  );
  await request(
    "auth/admin",
    "POST",
    { username: "OFFFRAME", password: "wrong-password" },
    "admin",
    401,
  );
  await request(
    "auth/admin",
    "POST",
    { username: "OFFFRAME", password: env.ADMIN_PASSWORD },
    "admin",
  );
  const imported = await request(
    "admin/emails",
    "POST",
    {
      csv: "Name,Email\nTest Photographer,student@example.com\nSecond Photographer,second@example.com\nDuplicate,STUDENT@example.com\nInvalid,not-an-email",
    },
    "admin",
  );
  assert.equal(imported.added, 2);
  assert.equal(imported.invalid, 1);
  await request("auth/eligibility", "POST", { email: "STUDENT@example.com" });
  await request(
    "auth/register",
    "POST",
    {
      email: "unlisted@example.com",
      name: "Unlisted Test",
      college: "Test College",
      year: "2nd Year",
      branch: "CSE",
      password: "TestStudentPassword!",
    },
    undefined,
    403,
  );
  const profile = {
    email: "student@example.com",
    name: "Test Photographer",
    college:
      "Government College of Engineering and Textile Technology, Serampore",
    year: "2nd Year",
    branch: "Computer Science & Engineering",
    password: "TestStudentPassword!",
  };
  await request("auth/register", "POST", profile, "student");
  await request("auth/register", "POST", profile, undefined, 409);
  await request(
    "auth/register",
    "POST",
    { ...profile, email: "second@example.com", name: "Second Photographer" },
    "second",
  );
  await request(
    "auth/login",
    "POST",
    { email: profile.email, password: "wrong-password" },
    undefined,
    401,
  );
  await request(
    "auth/login",
    "POST",
    { email: profile.email, password: profile.password },
    "student",
  );
  const localhostLogin = await fetch("http://localhost:3101/api/auth/login", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3101",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: profile.email, password: profile.password }),
  });
  assert.equal(
    localhostLogin.status,
    200,
    "Student login must also work through localhost",
  );
  checks++;
  const localSession = localhostLogin.headers.get("set-cookie").split(";")[0];
  const localhostMe = await fetch("http://localhost:3101/api/me", {
    headers: { Cookie: localSession },
  });
  assert.equal(localhostMe.status, 200);
  assert.equal((await localhostMe.json()).role, "student");
  checks++;
  const me = await request("me", "GET", undefined, "student");
  assert.equal(me.user.name, profile.name);
  const record = await database
    .collection("users")
    .findOne({ email: profile.email });
  assert.ok(record.passwordHash.startsWith("$2"));
  assert.equal(record.password, undefined);
  await request("admin/stats", "GET", undefined, "student", 403);
  await request("id-card", "POST", undefined, "student");
  const card = await request("id-card", "GET", undefined, "student");
  assert.equal((await sharp(card).metadata()).width, 2100);
  assert.equal(
    (await database.collection("users").findOne({ email: profile.email }))
      .idCardUrl,
    "/api/id-card",
  );
  await mkdir("../../work/qa", { recursive: true });
  await writeFile("../../work/qa/id-card-test.png", card);
  const image = await sharp({
    create: { width: 480, height: 320, channels: 3, background: "#97690f" },
  })
    .png()
    .toBuffer();
  const form = (title = "First frame", bytes = image) => {
    const f = new FormData();
    f.set("title", title);
    f.set("caption", "A test frame");
    f.set("image", new Blob([bytes], { type: "image/png" }), "frame.png");
    return f;
  };
  await request("submission", "POST", form(), "student", 403);
  await request("gallery", "GET", undefined, "student", 403);
  const future = {
    opensAt: new Date(Date.now() + 3600000).toISOString(),
    closesAt: new Date(Date.now() + 7200000).toISOString(),
    timezone: "Asia/Kolkata",
  };
  await request("admin/schedule", "PUT", future, "admin");
  await request(
    "admin/schedule",
    "PUT",
    { ...future, closesAt: future.opensAt },
    "admin",
    400,
  );
  await database
    .collection("settings")
    .updateOne(
      { _id: "event" },
      {
        $set: {
          opensAt: new Date(Date.now() - 60000).toISOString(),
          closesAt: new Date(Date.now() + 3600000).toISOString(),
          timezone: "Asia/Kolkata",
        },
      },
    );
  await request("admin/schedule", "PUT", future, "admin", 409);
  await request(
    "submission",
    "POST",
    form("Invalid file", Buffer.from("<script>not-an-image</script>")),
    "student",
    400,
  );
  await request("submission", "POST", form(), "student");
  let sub = (await request("submission", "GET", undefined, "student"))
    .submission;
  assert.equal(sub.final, false);
  await request(`images/${sub.id}`, "GET", undefined, "second", 403);
  await request("submission", "POST", form("Replacement frame"), "student");
  assert.equal(await database.collection("submissions").countDocuments(), 1);
  await request("submission", "DELETE", undefined, "student");
  await request("submission", "POST", form("Final frame"), "student");
  await request("submission/finalize", "POST", undefined, "student");
  await request("submission", "DELETE", undefined, "student", 409);
  await request(
    "submission",
    "POST",
    form("Forbidden replacement"),
    "student",
    409,
  );
  await request("submission/finalize", "POST", undefined, "student", 409);
  const adminGallery = await request("gallery", "GET", undefined, "admin");
  assert.equal(adminGallery.total, 1);
  assert.equal(adminGallery.items[0].photographer.name, profile.name);
  await request(`likes/${sub.id}`, "PUT", { liked: true }, "second", 403);
  await request("gallery", "GET", undefined, "second", 403);
  await database
    .collection("settings")
    .updateOne(
      { _id: "event" },
      { $set: { closesAt: new Date(Date.now() - 1000).toISOString() } },
    );
  await request("submission", "POST", form(), "second", 403);
  await request("submission/finalize", "POST", undefined, "second", 403);
  const gallery = await request("gallery", "GET", undefined, "second");
  assert.equal(gallery.total, 1);
  await request(`likes/${sub.id}`, "PUT", { liked: true }, "second");
  const likedAgain = await request(
    `likes/${sub.id}`,
    "PUT",
    { liked: true },
    "second",
  );
  assert.equal(likedAgain.likes, 1);
  const unlike = await request(
    `likes/${sub.id}`,
    "PUT",
    { liked: false },
    "second",
  );
  assert.equal(unlike.likes, 0);
  const png = await request(
    `images/${sub.id}?download=1`,
    "GET",
    undefined,
    "second",
  );
  assert.equal((await sharp(png).metadata()).format, "png");
  await request("auth/logout", "POST", undefined, "student");
  await request("me", "GET", undefined, "student", 401);
  console.log(
    `PASS: ${checks} API checks; real MongoDB, auth, ID image, upload replacement/deletion, locking, gallery gating, likes, PNG downloads, CSRF and permissions.`,
  );
  if (process.argv.includes("--hold")) {
    await rm("../../work/qa/release", { force: true });
    await writeFile(
      "../../work/qa/fixture.json",
      JSON.stringify({ database: testDbName, base }),
    );
    console.log(
      "Visual QA fixture is ready on port 3101. Create work/qa/release to clean up; automatic cleanup after 10 minutes.",
    );
    const deadline = Date.now() + 600000;
    while (Date.now() < deadline) {
      try {
        await access("../../work/qa/release");
        break;
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  server.kill();
  if (
    database &&
    database.databaseName === testDbName &&
    /^offframe_test_[a-f0-9]{16}$/.test(testDbName)
  ) {
    await database.dropDatabase();
    console.log("Temporary test database removed.");
  }
  await client.close();
  await mkdir("../../work/qa", { recursive: true });
  await writeFile("../../work/qa/integration-server.log", log);
}
