import mongoose from "mongoose";
import { getEnv } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var mongooseConn: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = global.mongooseConn ?? { conn: null, promise: null };
global.mongooseConn = cached;

/**
 * Connects using MONGODB_URI from .env.local as-is.
 * Does not override the database name so Atlas URI path / options stay authoritative.
 */
export async function connectDb() {
  if (cached.conn) return cached.conn;

  const { MONGODB_URI } = getEnv();

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        maxPoolSize: 15,
        serverSelectionTimeoutMS: 10_000
      })
      .then((conn) => {
        if (process.env.NODE_ENV === "development") {
          console.info(`[MongoDB] Connected: ${conn.connection.name}`);
        }
        return conn;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function isDbHealthy() {
  try {
    await connectDb();
    return mongoose.connection.readyState === 1;
  } catch {
    return false;
  }
}
