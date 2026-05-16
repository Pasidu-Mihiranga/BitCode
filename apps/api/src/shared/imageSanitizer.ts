/**
 * Hardened image upload pipeline (covers the "image sanitization" item).
 *
 *   1. Cap raw bytes at 10 MiB (caller enforces multipart size too).
 *   2. Magic-byte sniff via `file-type` — extension is ignored.
 *   3. Only JPEG / PNG / WebP accepted. SVG is rejected (XSS vector).
 *   4. `sharp` re-encodes to mozjpeg, strips EXIF/ICC, normalises EXIF
 *      orientation, caps dimensions at 1920x1080 (fit:inside).
 *   5. Reject final buffer if > 5 MiB.
 *   6. Write to UPLOAD_DIR/<uuidv4>.jpg with 0640 perms.
 *
 * Returns the public URL path; the audit entry records this URL + SHA-256
 * of the stored bytes (never the bytes themselves).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { AppError } from "./errors";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_W = 1920;
const MAX_H = 1080;
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/uploads";

export interface SanitizedImage {
  url: string; // public URL path served by NGINX (/uploads/<id>.jpg)
  filename: string; // disk basename
  bytes: number;
  sha256: string;
  width: number;
  height: number;
}

export async function sanitizeAndStoreImage(input: Uint8Array | Buffer): Promise<SanitizedImage> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (buf.length === 0) {
    throw new AppError("INVALID_IMAGE", "Uploaded file is empty.");
  }
  if (buf.length > MAX_INPUT_BYTES) {
    throw new AppError("INVALID_IMAGE", "Image exceeds 10 MB upload limit.");
  }

  const detected = await fileTypeFromBuffer(buf);
  if (!detected || !ACCEPTED_MIME.has(detected.mime)) {
    throw new AppError(
      "INVALID_IMAGE",
      "Only JPEG, PNG, or WebP images are accepted (SVG is rejected).",
    );
  }

  let processed: Buffer;
  let width: number;
  let height: number;
  try {
    const pipeline = sharp(buf, { failOn: "error" })
      .rotate() // normalise EXIF orientation
      .resize({ width: MAX_W, height: MAX_H, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    processed = data;
    width = info.width;
    height = info.height;
  } catch (err) {
    throw new AppError("INVALID_IMAGE", "We couldn't process that image.");
  }

  if (processed.length > MAX_OUTPUT_BYTES) {
    throw new AppError("INVALID_IMAGE", "Re-encoded image exceeds 5 MB cap.");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${uuid()}.jpg`;
  const fullPath = join(UPLOAD_DIR, filename);
  await writeFile(fullPath, processed, { mode: 0o640 });

  const sha256 = createHash("sha256").update(processed).digest("hex");

  return {
    url: `/uploads/${filename}`,
    filename,
    bytes: processed.length,
    sha256,
    width,
    height,
  };
}
