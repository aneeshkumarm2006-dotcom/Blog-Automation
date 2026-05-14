import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { listSessions, toClientSession } from "@/lib/db";
import { HistoryView } from "./HistoryView";

export const metadata: Metadata = {
  title: "History — BlogForge",
};

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const sessions = await listSessions();
  return (
    <AppShell width="wide">
      <HistoryView sessions={sessions.map(toClientSession)} />
    </AppShell>
  );
}
