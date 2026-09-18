import { NextResponse } from "next/server";
import { Binary, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { db, settings } from "@/lib/db.mjs";
import {
  session,
  issueSession,
  clearSession,
  checkOrigin,
  rateLimit,
  sameSecret,
  HttpError,
} from "@/lib/auth.mjs";
import {
  profileSchema,
  emailSchema,
  eventState,
  publicProfile,
  MAX_UPLOAD,
} from "@/lib/rules.mjs";
import { normalizeImage, makeIdCard } from "@/lib/images.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ok = (data) =>
  NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
const fail = (status, message, code) => {
  throw new HttpError(status, message, code);
};
const asId = (text) => {
  if (!/^[a-f\d]{24}$/i.test(text || "")) fail(400, "Invalid image ID.");
  return new ObjectId(text);
};
function png(binary, name, download) {
  return new Response(
    new Uint8Array(binary instanceof Binary ? binary.value() : binary),
    {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
async function boundedBody(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      fail(413, "Request is too large.");
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}
async function json(request) {
  const body = await boundedBody(request, 1500000);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    fail(400, "Invalid request.");
  }
}
async function requireOpen(database) {
  const config = await settings(database);
  if (eventState(config) !== "open")
    fail(403, "Image submissions are not open right now.");
  return config;
}
async function handle(request, context) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
    const method = request.method;
    const url = new URL(request.url);
    if (method !== "GET") {
      checkOrigin(request);
      if (Number(request.headers.get("content-length")) > MAX_UPLOAD + 1500000)
        fail(413, "Request is too large.");
    }
    if (route === "auth/logout" && method === "POST") {
      await clearSession();
      return ok({ success: true });
    }
    const database = await db();
    const users = database.collection("users"),
      submissions = database.collection("submissions");
    if (route === "event" && method === "GET") {
      const config = await settings(database);
      return ok({
        ...config,
        state: eventState(config),
        serverTime: new Date().toISOString(),
      });
    }
    if (route === "auth/eligibility" && method === "POST") {
      const { email } = z
        .object({ email: emailSchema })
        .parse(await json(request));
      await rateLimit(database, "eligibility", email, 20);
      if (!(await database.collection("eligibleEmails").findOne({ email })))
        fail(403, "You have not registered for the event");
      if (await users.findOne({ email }))
        fail(409, "This email already has an account. Please sign in.");
      return ok({ eligible: true });
    }
    if (route === "auth/register" && method === "POST") {
      const profile = profileSchema.parse(await json(request));
      await rateLimit(database, "register", profile.email);
      if (
        !(await database
          .collection("eligibleEmails")
          .findOne({ email: profile.email }))
      )
        fail(403, "You have not registered for the event");
      const { password, ...details } = profile;
      const result = await users.insertOne({
        ...details,
        passwordHash: await bcrypt.hash(password, 12),
        createdAt: new Date(),
        idCardUrl: null,
      });
      await issueSession(String(result.insertedId), "student");
      return ok({ success: true });
    }
    if (route === "auth/login" && method === "POST") {
      const { email, password } = z
        .object({ email: emailSchema, password: z.string().min(1).max(200) })
        .parse(await json(request));
      await rateLimit(database, "login", email);
      const user = await users.findOne({ email });
      if (!user)
        fail(
          404,
          "Please register first to create your participant account.",
          "REGISTER_FIRST",
        );
      if (!(await bcrypt.compare(password, user.passwordHash)))
        fail(401, "The email or password is incorrect.");
      await issueSession(String(user._id), "student");
      return ok({ success: true });
    }
    if (route === "auth/admin" && method === "POST") {
      await rateLimit(database, "admin-login", "admin", 20);
      const { username, password } = z
        .object({
          username: z.string().max(100),
          password: z.string().max(200),
        })
        .parse(await json(request));
      if (!process.env.ADMIN_PASSWORD)
        fail(503, "Admin access has not been configured.");
      if (
        !sameSecret(username, process.env.ADMIN_USERNAME || "OFFFRAME") ||
        !sameSecret(password, process.env.ADMIN_PASSWORD)
      )
        fail(401, "The admin username or password is incorrect.");
      await issueSession("admin", "admin");
      return ok({ success: true });
    }
    if (route === "me" && method === "GET") {
      const who = await session(database);
      return ok({
        role: who.role,
        user: who.user ? publicProfile(who.user) : null,
      });
    }
    if (route === "id-card" && ["POST", "GET"].includes(method)) {
      const who = await session(database, "student");
      const cards = database.collection("idCards");
      if (method === "GET") {
        const card = await cards.findOne({ _id: who.user._id });
        if (!card) fail(404, "Generate your participation ID first.");
        return png(card.png, "OffFrame-Participation-ID.png", true);
      }
      let card = await cards.findOne({ _id: who.user._id });
      if (!card) {
        const buffer = await makeIdCard(who.user);
        await cards.updateOne(
          { _id: who.user._id },
          { $set: { png: new Binary(buffer), createdAt: new Date() } },
          { upsert: true },
        );
      }
      await users.updateOne(
        { _id: who.user._id },
        { $set: { idCardUrl: "/api/id-card" } },
      );
      return ok({ url: "/api/id-card" });
    }
    if (route === "submission" && method === "GET") {
      const who = await session(database, "student");
      const item = await submissions.findOne(
        { _id: who.user._id },
        { projection: { png: 0, likes: 0 } },
      );
      return ok({
        submission: item
          ? {
              ...item,
              id: String(item._id),
              imageUrl: `/api/images/${item._id}?v=${+item.updatedAt}`,
            }
          : null,
      });
    }
    if (route === "submission" && method === "POST") {
      const who = await session(database, "student");
      await requireOpen(database);
      await rateLimit(database, "upload", who.id, 80);
      if (
        await submissions.findOne(
          { _id: who.user._id, final: true },
          { projection: { _id: 1 } },
        )
      )
        fail(409, "Your final submission is locked.");
      const raw = await boundedBody(request, MAX_UPLOAD + 100000);
      const form = await new Response(raw, {
        headers: { "Content-Type": request.headers.get("content-type") || "" },
      }).formData();
      const title = z.string().trim().min(1).max(100).parse(form.get("title"));
      const caption = z
        .string()
        .trim()
        .max(500)
        .parse(form.get("caption") || "");
      const buffer = await normalizeImage(form.get("image"));
      await requireOpen(database);
      try {
        await submissions.updateOne(
          { _id: who.user._id, final: { $ne: true } },
          {
            $set: {
              title,
              caption,
              png: new Binary(buffer),
              updatedAt: new Date(),
              final: false,
            },
            $setOnInsert: { likes: [], createdAt: new Date() },
          },
          { upsert: true },
        );
      } catch (e) {
        if (e.code === 11000) fail(409, "Your final submission is locked.");
        throw e;
      }
      return ok({ success: true });
    }
    if (route === "submission" && method === "DELETE") {
      const who = await session(database, "student");
      await requireOpen(database);
      const result = await submissions.deleteOne({
        _id: who.user._id,
        final: false,
      });
      if (!result.deletedCount)
        fail(409, "The image is already finalized or has been removed.");
      return ok({ success: true });
    }
    if (route === "submission/finalize" && method === "POST") {
      const who = await session(database, "student");
      await requireOpen(database);
      const result = await submissions.updateOne(
        { _id: who.user._id, final: false },
        { $set: { final: true, finalizedAt: new Date() } },
      );
      if (!result.modifiedCount)
        fail(
          409,
          "Upload an image first, or check whether it is already finalized.",
        );
      return ok({ success: true });
    }
    if (route === "gallery" && method === "GET") {
      const who = await session(database);
      const config = await settings(database);
      if (who.role !== "admin" && eventState(config) !== "closed")
        fail(403, "The gallery opens after submissions close.");
      const page = Math.floor(
        Math.max(1, Math.min(10000, Number(url.searchParams.get("page")) || 1)),
      );
      const records = await submissions
        .aggregate([
          { $match: { final: true } },
          { $sort: { finalizedAt: -1, _id: 1 } },
          { $skip: (page - 1) * 24 },
          { $limit: 24 },
          { $project: { png: 0 } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "photographer",
            },
          },
          { $unwind: "$photographer" },
          { $project: { "photographer.passwordHash": 0 } },
        ])
        .toArray();
      return ok({
        items: records.map((r) => ({
          id: String(r._id),
          title: r.title,
          caption: r.caption,
          imageUrl: `/api/images/${r._id}`,
          likes: r.likes?.length || 0,
          liked: r.likes?.includes(who.id) || false,
          photographer: publicProfile(r.photographer),
        })),
        total: await submissions.countDocuments({ final: true }),
        page,
      });
    }
    if (path[0] === "images" && path.length === 2 && method === "GET") {
      const who = await session(database);
      const item = await submissions.findOne({ _id: asId(path[1]) });
      if (!item) fail(404, "Image not found.");
      if (
        who.id !== String(item._id) &&
        (!item.final ||
          (who.role !== "admin" &&
            eventState(await settings(database)) !== "closed"))
      )
        fail(403, "This image is not available yet.");
      return png(
        item.png,
        `OffFrame-${item._id}.png`,
        url.searchParams.get("download") === "1",
      );
    }
    if (path[0] === "likes" && path.length === 2 && method === "PUT") {
      const who = await session(database, "student");
      if (eventState(await settings(database)) !== "closed")
        fail(403, "Likes open with the gallery.");
      const { liked } = z
        .object({ liked: z.boolean() })
        .parse(await json(request));
      await rateLimit(database, "likes", who.id, 300);
      const item = await submissions.findOneAndUpdate(
        { _id: asId(path[1]), final: true },
        liked ? { $addToSet: { likes: who.id } } : { $pull: { likes: who.id } },
        { returnDocument: "after", projection: { likes: 1 } },
      );
      if (!item) fail(404, "Submission not found.");
      return ok({
        likes: item.likes.length,
        liked: item.likes.includes(who.id),
      });
    }
    if (route.startsWith("admin/")) {
      await session(database, "admin");
      if (route === "admin/stats" && method === "GET") {
        const [participants, eligible, finals, drafts, config] =
          await Promise.all([
            users.countDocuments(),
            database.collection("eligibleEmails").countDocuments(),
            submissions.countDocuments({ final: true }),
            submissions.countDocuments({ final: false }),
            settings(database),
          ]);
        return ok({
          participants,
          eligible,
          finals,
          drafts,
          config: { ...config, state: eventState(config) },
        });
      }
      if (route === "admin/schedule" && method === "PUT") {
        const config = z
          .object({
            opensAt: z.iso.datetime({ offset: true }),
            closesAt: z.iso.datetime({ offset: true }),
            timezone: z.string().min(1).max(80),
          })
          .parse(await json(request));
        try {
          new Intl.DateTimeFormat("en", { timeZone: config.timezone }).format();
        } catch {
          fail(400, "Choose a valid time zone.");
        }
        if (+new Date(config.closesAt) <= +new Date(config.opensAt))
          fail(400, "Closing time must be after opening time.");
        if (
          eventState(await settings(database)) !== "unconfigured" &&
          ["open", "closed"].includes(eventState(await settings(database)))
        )
          fail(
            409,
            "The schedule cannot be changed after submissions have opened.",
          );
        if (+new Date(config.opensAt) <= Date.now())
          fail(400, "Choose an opening time in the future.");
        await database
          .collection("settings")
          .updateOne(
            { _id: "event" },
            { $set: { ...config, updatedAt: new Date() } },
            { upsert: true },
          );
        return ok({ success: true });
      }
      if (route === "admin/emails" && method === "POST") {
        const { csv } = z
          .object({ csv: z.string().min(1).max(1000000) })
          .parse(await json(request));
        let rows;
        try {
          rows = parse(csv, {
            bom: true,
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true,
          });
        } catch {
          fail(
            400,
            "Unable to read this CSV. Export your sheet as CSV and try again.",
          );
        }
        if (rows.length > 10001)
          fail(400, "Import up to 10,000 rows at a time.");
        const header = rows[0] || [];
        const emailColumn = header.findIndex((v) =>
          /^e[- ]?mail(?: address)?$/i.test(v),
        );
        if (emailColumn < 0 && header.length !== 1)
          fail(400, "Include an Email column header in your CSV.");
        const values = (emailColumn >= 0 ? rows.slice(1) : rows).map(
          (r) => r[emailColumn >= 0 ? emailColumn : 0],
        );
        const valid = new Set();
        let invalid = 0;
        for (const value of values) {
          const parsed = emailSchema.safeParse(value);
          if (parsed.success) valid.add(parsed.data);
          else invalid++;
        }
        if (!valid.size) fail(400, "No valid email addresses were found.");
        const result = await database
          .collection("eligibleEmails")
          .bulkWrite(
            [...valid].map((email) => ({
              updateOne: {
                filter: { email },
                update: { $setOnInsert: { email, createdAt: new Date() } },
                upsert: true,
              },
            })),
          );
        return ok({
          added: result.upsertedCount,
          existing: valid.size - result.upsertedCount,
          invalid,
        });
      }
    }
    fail(404, "This page or action could not be found.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
            .join(". "),
        },
        { status: 400 },
      );
    if (error.code === 11000)
      return NextResponse.json(
        { error: "This email already has an account. Please sign in." },
        { status: 409 },
      );
    if (error instanceof HttpError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    console.error(
      "OffFrame request failed:",
      error.name,
      error.code || "unavailable",
    );
    return NextResponse.json(
      {
        error:
          "The service is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
