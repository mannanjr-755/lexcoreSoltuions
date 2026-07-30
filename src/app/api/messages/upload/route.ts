import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";

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

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function extensionOf(name: string) {
  const ext = path.extname(name).toLowerCase();
  return ext;
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
            "Unsupported file type. Images: JPG, JPEG, PNG, WEBP. Files: PDF, DOC, DOCX, XLSX, ZIP, TXT."
        },
        { status: 400 }
      );
    }
    if (file.size <= 0) {
      return NextResponse.json({ message: "Empty files are not allowed." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ message: "File size exceeds 10MB limit." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const resolvedExt = ext || (isImage ? ".jpg" : ".bin");
    const filename = `${Date.now()}-${crypto.randomUUID()}-${safeFilename(path.basename(file.name, resolvedExt))}${resolvedExt}`;
    const folder = path.join(process.cwd(), "public", "uploads", "messages");
    await fs.mkdir(folder, { recursive: true });
    const savePath = path.join(folder, filename);
    await fs.writeFile(savePath, buffer);

    const publicUrl = `/uploads/messages/${filename}`;
    return NextResponse.json({
      attachment: {
        id: crypto.randomUUID(),
        type: isImage ? "image" : "file",
        url: publicUrl,
        name: file.name,
        size: file.size,
        mime: mime || MIME_BY_EXT[resolvedExt] || "application/octet-stream"
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
