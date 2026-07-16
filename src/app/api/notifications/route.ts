import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.notification.count({ where: { userId: session.id, isRead: false } })
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id, markAllRead } = await req.json();

    if (markAllRead) {
      await prisma.notification.updateMany({ where: { userId: session.id, isRead: false }, data: { isRead: true } });
      return NextResponse.json({ message: "All notifications marked as read" });
    }

    if (id) {
      const notification = await prisma.notification.findFirst({ where: { id, userId: session.id } });
      const updated = notification && await prisma.notification.update({ where: { id }, data: { isRead: true } });
      if (!updated) return NextResponse.json({ message: "Notification not found" }, { status: 404 });
      return NextResponse.json({ message: "Notification marked as read" });
    }

    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        if (typeof body?.id === "string") id = body.id;
        if (Array.isArray(body?.ids) && body.ids.length > 0) {
          const validIds = body.ids.filter((x: unknown) => typeof x === "string");
          const result = await prisma.notification.deleteMany({ where: { id: { in: validIds }, userId: session.id } });
          return NextResponse.json({
            message: "Record deleted successfully.",
            deletedCount: result.count
          });
        }
      } catch {
        // no JSON body
      }
    }

    if (!id) return NextResponse.json({ message: "Notification ID required" }, { status: 400 });
    const notification = await prisma.notification.findFirst({ where: { id, userId: session.id } });
    const deleted = notification && await prisma.notification.delete({ where: { id } });
    if (!deleted) return NextResponse.json({ message: "Notification not found" }, { status: 404 });

    const stillThere = await prisma.notification.findUnique({ where: { id } });
    if (stillThere) {
      return NextResponse.json({ message: "Delete verification failed" }, { status: 500 });
    }

    return NextResponse.json({ message: "Record deleted successfully.", deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
