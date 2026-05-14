import type { Metadata } from "next";
import { FilePen } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Login — BlogForge",
};

type LoginSearchParams = Promise<{ from?: string | string[] }>;

function sanitizeRedirect(from: string | string[] | undefined): string {
  const value = Array.isArray(from) ? from[0] : from;
  if (typeof value !== "string" || value.length === 0) return "/session/new";
  if (!value.startsWith("/")) return "/session/new";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/session/new";
  if (value === "/login" || value.startsWith("/login/")) return "/session/new";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  const { from } = await searchParams;
  const redirectTo = sanitizeRedirect(from);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-[480px] overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-8 pb-6 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-high">
            <FilePen className="h-6 w-6 text-fg" aria-hidden />
          </div>
          <h1 className="mb-2 font-serif text-2xl font-semibold text-fg">
            BlogForge
          </h1>
          <p className="text-sm text-fg-muted">SEO Engine Workspace</p>
        </div>

        <div className="p-8">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}
