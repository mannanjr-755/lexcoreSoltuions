import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { isAuthorizedEmail } from "@/lib/authorized-users";

const MAX_SIZE = 10 * 1024 * 1024;
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

export const runtime = "nodejs";

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
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

    const isImage = IMAGE_TYPES.has(file.type);
    const isAllowedFile = FILE_TYPES.has(file.type);
    if (!isImage && !isAllowedFile) {
      return NextResponse.json({ message: "Unsupported file type." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ message: "File size exceeds 10MB limit." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name) || (isImage ? ".jpg" : ".bin");
    const filename = `${Date.now()}-${crypto.randomUUID()}-${safeFilename(path.basename(file.name, ext))}${ext}`;
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
        mime: file.type
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
