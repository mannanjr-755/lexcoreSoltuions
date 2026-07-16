import axios from "axios";

const api = axios.create({
  baseURL: typeof window !== "undefined" ? "" : process.env.APP_URL ?? "http://localhost:3000",
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

export default api;
