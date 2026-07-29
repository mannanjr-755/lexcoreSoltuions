import { Suspense } from "react";
import LoginPage from "./login-form";

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#2563EB]/30 border-t-[#2563EB]" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
