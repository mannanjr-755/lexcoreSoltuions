import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

type RetryConfig = InternalAxiosRequestConfig & { __retryCount?: number };

const api = axios.create({
  baseURL: typeof window !== "undefined" ? "" : process.env.APP_URL ?? "http://localhost:3000",
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (!config) throw error;

    const status = error.response?.status;
    const message =
      typeof error.response?.data === "object" &&
      error.response?.data &&
      "message" in error.response.data
        ? String((error.response.data as { message?: string }).message ?? "")
        : "";

    const isTransient =
      status === 503 ||
      /temporarily overloaded|connection pool|Unable to reach the database/i.test(message);

    const retryCount = config.__retryCount ?? 0;
    if (!isTransient || retryCount >= 3) {
      throw error;
    }

    config.__retryCount = retryCount + 1;
    await sleep(150 * 2 ** retryCount);
    return api.request(config);
  }
);

export default api;
