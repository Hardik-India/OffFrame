import sharp from "sharp";
import path from "node:path";
import { MAX_UPLOAD, MAX_STORED, escapeXml } from "./rules.mjs";
import { HttpError } from "./auth.mjs";
export async function normalizeImage(file) {
  if (!file || typeof file.arrayBuffer !== "function")
    throw new HttpError(400, "Choose an image to upload.");
  if (file.size > MAX_UPLOAD || file.size === 0)
    throw new HttpError(400, "Choose a non-empty image up to 10 MB.");
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const metadata = await sharp(input, {
      limitInputPixels: 25000000,
      animated: false,
    }).metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    )
      throw new HttpError(400, "Use a still JPG, PNG, or WebP photograph.");
    const output = await sharp(input, { limitInputPixels: 25000000 })
      .rotate()
      .resize({
        width: 3000,
        height: 3000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    if (output.length > MAX_STORED)
      throw new HttpError(
        400,
        "The PNG version exceeds 8 MB. Please choose a smaller image.",
      );
    return output;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      400,
      "This image could not be read. Use a JPG, PNG, or WebP up to 25 megapixels.",
    );
  }
}
export async function makeIdCard(user) {
  const template = path.join(process.cwd(), "public/assets/id-template.png");
  const fontfile = path.join(process.cwd(), "public/fonts/Poppins-Medium.ttf");
  const fields = [
    [365, 718, 1120, user.name, 44, 65],
    [340, 834, 234, user.year, 35, 45],
    [928, 834, 590, user.branch, 37, 65],
    [680, 963, 840, user.college, 36, 80],
    [365, 1070, 1150, user.email, 37, 65],
    [
      132,
      1150,
      1100,
      `PARTICIPANT ${String(user._id).slice(-8).toUpperCase()}`,
      16,
      22,
    ],
  ];
  const overlays = await Promise.all(
    fields.map(async ([left, bottom, width, value, size, height]) => {
      const rendered = await sharp({
        text: {
          text: `<span foreground="#553c13">${escapeXml(value)}</span>`,
          font: `Poppins Medium ${size}`,
          fontfile,
          width,
          wrap: "word-char",
          rgba: true,
        },
      })
        .png()
        .toBuffer();
      const { data, info } = await sharp(rendered)
        .resize({ width, height, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer({ resolveWithObject: true });
      return { input: data, left, top: bottom - info.height };
    }),
  );
  return sharp(template).composite(overlays).png().toBuffer();
}
