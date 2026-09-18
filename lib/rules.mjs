import { z } from "zod";
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const profileSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).max(80),
  college: z.string().trim().min(2).max(140),
  year: z.enum([
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
    "Other",
  ]),
  branch: z.string().trim().min(1).max(60),
  password: z
    .string()
    .min(8)
    .refine(
      (v) => Buffer.byteLength(v) <= 72,
      "Password must be at most 72 bytes",
    ),
});
export const MAX_UPLOAD = 10 * 1024 * 1024;
export const MAX_STORED = 8 * 1024 * 1024;
export function eventState(config, now = new Date()) {
  const opens = config?.opensAt ? new Date(config.opensAt) : null;
  const closes = config?.closesAt ? new Date(config.closesAt) : null;
  if (
    !opens ||
    !closes ||
    !Number.isFinite(+opens) ||
    !Number.isFinite(+closes) ||
    +closes <= +opens
  )
    return "unconfigured";
  if (+now < +opens) return "upcoming";
  return +now < +closes ? "open" : "closed";
}
export function escapeXml(text) {
  return String(text).replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
}
export function fitText(text, maxWidth, baseSize = 42) {
  return Math.max(
    14,
    Math.min(baseSize, maxWidth / Math.max(String(text).length * 0.61, 1)),
  );
}
export function publicProfile(user) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    college: user.college,
    year: user.year,
    branch: user.branch,
    idCardUrl: user.idCardUrl || null,
  };
}
