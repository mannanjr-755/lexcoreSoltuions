import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized, HttpError } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";
import { storeChatUpload } from "@/lib/upload-storage";
import { logger } from "@/lib/logger";

const MAX_SIZE = 10 * 1024 * 1024;

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const FILE_EXT = new Set([".pdf", ".doc", ".docx", ".xlsx", ".zip", ".txt"]);

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain"
]);

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".txt": "text/plain"
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extensionOf(name: string) {
  return path.extname(name).toLowerCase();
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !isAuthorizedEmail(session.email)) return unauthorized();

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "No file uploaded." }, { status: 400 });
    }

    const ext = extensionOf(file.name);
    const mime = (file.type || MIME_BY_EXT[ext] || "").toLowerCase();
    const isImage = IMAGE_TYPES.has(mime) || IMAGE_EXT.has(ext);
    const isAllowedFile = FILE_TYPES.has(mime) || FILE_EXT.has(ext);

    if (!isImage && !isAllowedFile) {
      return NextResponse.json(
        {
          message:
            "Unsupported Media Type. Images: JPG, JPEG, PNG, WEBP. Files: PDF, DOC, DOCX, XLSX, ZIP, TXT."
        },
        { status: 415 }
      );
    }
    if (file.size <= 0) {
      return NextResponse.json({ message: "Empty files are not allowed." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ message: "File size exceeds 10MB limit." }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const resolvedExt = ext || (isImage ? ".jpg" : ".bin");
    const kind = isImage ? "image" : "file";

    const stored = await storeChatUpload({
      buffer,
      originalName: file.name,
      mime: mime || MIME_BY_EXT[resolvedExt] || "application/octet-stream",
      kind,
      ext: resolvedExt
    });

    logger.info("Chat upload stored", {
      email: session.email,
      storage: stored.storage,
      type: stored.type,
      name: stored.name,
      size: stored.size
    });

    return NextResponse.json({
      attachment: {
        id: crypto.randomUUID(),
        type: stored.type,
        url: stored.url,
        name: stored.name,
        size: stored.size,
        mime: stored.mime,
        createdAt: new Date().toISOString(),
        storage: stored.storage
      }
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return handleApiError(error);
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/EROFS|read-only file system/i.test(message)) {
      logger.error("EROFS during chat upload", { message });
      return NextResponse.json(
        {
          message:
            "Cannot write uploads on this server (read-only filesystem). Configure Cloudinary credentials for production uploads."
        },
        { status: 503 }
      );
    }
    return handleApiError(error);
  }
}
