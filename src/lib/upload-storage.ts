import { promises as fs } from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { HttpError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export type StoredUpload = {
  url: string;
  publicId?: string;
  storage: "cloudinary" | "local";
  size: number;
  mime: string;
  name: string;
  type: "image" | "file";
};

export type UploadKind = "image" | "file";

const DEFAULT_LOCAL_DIR = path.join("public", "uploads", "messages");
const CLOUDINARY_FOLDER = "lexcore/messages";

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

/** Netlify / Vercel / Lambda package the app under a read-only filesystem. */
export function isReadOnlyRuntime() {
  return Boolean(
    process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.VERCEL ||
      process.cwd().startsWith("/var/task") ||
      process.env.UPLOAD_FORCE_REMOTE === "true"
  );
}

export type UploadDriver = "cloudinary" | "local";

export function resolveUploadDriver(): UploadDriver {
  const forced = (process.env.UPLOAD_DRIVER ?? "").trim().toLowerCase();
  if (forced === "cloudinary" || forced === "local") {
    if (forced === "cloudinary" && !hasCloudinaryConfig()) {
      throw new HttpError(
        503,
        "UPLOAD_DRIVER=cloudinary but Cloudinary credentials are missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      );
    }
    if (forced === "local" && isReadOnlyRuntime()) {
      throw new HttpError(
        503,
        "Local disk uploads are not available on this read-only deployment. Set UPLOAD_DRIVER=cloudinary and configure Cloudinary credentials."
      );
    }
    return forced;
  }

  if (isReadOnlyRuntime()) {
    if (!hasCloudinaryConfig()) {
      throw new HttpError(
        503,
        "File uploads require Cloudinary on this deployment (read-only filesystem). Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the host environment."
      );
    }
    return "cloudinary";
  }

  // Prefer Cloudinary whenever configured so local/prod URLs stay consistent.
  if (hasCloudinaryConfig()) return "cloudinary";
  return "local";
}

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function resolveLocalUploadDir() {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), DEFAULT_LOCAL_DIR);
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildObjectName(originalName: string, ext: string) {
  const base = safeFilename(path.basename(originalName, ext)) || "file";
  return `${Date.now()}-${crypto.randomUUID()}-${base}`;
}

async function uploadToCloudinary(input: {
  buffer: Buffer;
  filename: string;
  ext: string;
  mime: string;
  kind: UploadKind;
  originalName: string;
}): Promise<StoredUpload> {
  configureCloudinary();
  const resourceType = input.kind === "image" ? "image" : "raw";
  // Include extension for raw assets so downloads keep the correct filename/type.
  const publicId =
    input.kind === "image"
      ? `${CLOUDINARY_FOLDER}/${input.filename}`
      : `${CLOUDINARY_FOLDER}/${input.filename}${input.ext}`;

  const result = await new Promise<{ secure_url: string; public_id: string; bytes?: number }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: resourceType,
          overwrite: false,
          use_filename: false,
          unique_filename: false
        },
        (error, uploaded) => {
          if (error || !uploaded?.secure_url) {
            reject(error ?? new Error("Cloudinary upload returned no URL."));
            return;
          }
          resolve({
            secure_url: uploaded.secure_url,
            public_id: uploaded.public_id,
            bytes: uploaded.bytes
          });
        }
      );
      stream.end(input.buffer);
    }
  );

  logger.info("Uploaded chat attachment to Cloudinary", {
    publicId: result.public_id,
    kind: input.kind,
    name: input.originalName
  });

  return {
    url: result.secure_url,
    publicId: result.public_id || publicId,
    storage: "cloudinary",
    size: result.bytes ?? input.buffer.length,
    mime: input.mime,
    name: input.originalName,
    type: input.kind
  };
}

async function uploadToLocalDisk(input: {
  buffer: Buffer;
  filename: string;
  ext: string;
  mime: string;
  kind: UploadKind;
  originalName: string;
}): Promise<StoredUpload> {
  const folder = resolveLocalUploadDir();
  try {
    await fs.mkdir(folder, { recursive: true });
    const savePath = path.join(folder, `${input.filename}${input.ext}`);
    await fs.writeFile(savePath, input.buffer);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Local upload failed", { code, message, folder });
    if (code === "EROFS" || /read-only file system/i.test(message)) {
      throw new HttpError(
        503,
        "Cannot write uploads on this server (read-only filesystem). Configure Cloudinary credentials for production uploads."
      );
    }
    if (code === "EACCES" || code === "EPERM") {
      throw new HttpError(503, "Upload directory is not writable. Check UPLOAD_DIR permissions.");
    }
    throw error;
  }

  const publicUrl = `/uploads/messages/${input.filename}${input.ext}`;
  return {
    url: publicUrl,
    storage: "local",
    size: input.buffer.length,
    mime: input.mime,
    name: input.originalName,
    type: input.kind
  };
}

export async function storeChatUpload(input: {
  buffer: Buffer;
  originalName: string;
  mime: string;
  kind: UploadKind;
  ext: string;
}): Promise<StoredUpload> {
  const driver = resolveUploadDriver();
  const objectName = buildObjectName(input.originalName, input.ext);

  if (driver === "cloudinary") {
    return uploadToCloudinary({
      buffer: input.buffer,
      filename: objectName,
      ext: input.ext,
      mime: input.mime,
      kind: input.kind,
      originalName: input.originalName
    });
  }

  return uploadToLocalDisk({
    buffer: input.buffer,
    filename: objectName,
    ext: input.ext,
    mime: input.mime,
    kind: input.kind,
    originalName: input.originalName
  });
}

export function isAllowedAttachmentUrl(url: string) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("/uploads/messages/")) return true;
  if (url.startsWith("https://res.cloudinary.com/")) return true;
  return false;
}

/** Best-effort delete for local files and Cloudinary assets. */
export async function deleteStoredAttachment(url: string) {
  if (!url) return;

  if (url.startsWith("/uploads/messages/")) {
    const absolute = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    try {
      await fs.unlink(absolute);
    } catch {
      // Already gone.
    }
    return;
  }

  if (!url.startsWith("https://res.cloudinary.com/") || !hasCloudinaryConfig()) return;

  try {
    configureCloudinary();
    const match = url.match(/\/(image|raw|video|auto)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) return;
    const resourceType = match[1] === "image" ? "image" : "raw";
    let publicId = decodeURIComponent(match[2]).split("?")[0];
    if (resourceType === "image") {
      publicId = publicId.replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");
    }
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    logger.warn("Failed to delete Cloudinary attachment", {
      url,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
