"use client";

export type DeployStatus = "queued" | "building" | "ready" | "error";

const STYLES: Record<DeployStatus, string> = {
  queued: "bg-zinc-800 text-zinc-300",
  building: "bg-amber-500/10 text-amber-400",
  ready: "bg-emerald-500/10 text-emerald-400",
  error: "bg-red-500/10 text-red-400",
};

const LABELS: Record<DeployStatus, string> = {
  queued: "Queued",
  building: "Building",
  ready: "Ready",
  error: "Failed",
};

export default function StatusBadge({ status }: { status: DeployStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "building" ? "animate-pulse" : ""
        } bg-current`}
      />
      {LABELS[status]}
    </span>
  );
}
