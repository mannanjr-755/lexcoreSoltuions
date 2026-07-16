import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { NotificationModel } from "@/models/Notification";
import { getSession } from "@/lib/auth";
import { handleApiError, unauthorized } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await connectDb();
    const [notifications, unreadCount] = await Promise.all([
      NotificationModel.find({ userId: session.id }).sort({ createdAt: -1 }).limit(50).lean(),
      NotificationModel.countDocuments({ userId: session.id, isRead: false })
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

    await connectDb();
    const { id, markAllRead } = await req.json();

    if (markAllRead) {
      await NotificationModel.updateMany({ userId: session.id, isRead: false }, { isRead: true });
      return NextResponse.json({ message: "All notifications marked as read" });
    }

    if (id) {
      if (!Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: "Invalid notification ID" }, { status: 400 });
      }
      const updated = await NotificationModel.findOneAndUpdate(
        { _id: id, userId: session.id },
        { isRead: true },
        { new: true }
      );
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
          await connectDb();
          const validIds = body.ids.filter((x: unknown) => typeof x === "string" && Types.ObjectId.isValid(x));
          const result = await NotificationModel.deleteMany({
            _id: { $in: validIds },
            userId: session.id
          });
          return NextResponse.json({
            message: "Record deleted successfully.",
            deletedCount: result.deletedCount ?? 0
          });
        }
      } catch {
        // no JSON body
      }
    }

    if (!id) return NextResponse.json({ message: "Notification ID required" }, { status: 400 });
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid notification ID" }, { status: 400 });
    }

    await connectDb();
    const deleted = await NotificationModel.findOneAndDelete({ _id: id, userId: session.id });
    if (!deleted) return NextResponse.json({ message: "Notification not found" }, { status: 404 });

    const stillThere = await NotificationModel.exists({ _id: id });
    if (stillThere) {
      return NextResponse.json({ message: "Delete verification failed" }, { status: 500 });
    }

    return NextResponse.json({ message: "Record deleted successfully.", deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
