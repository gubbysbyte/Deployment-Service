"use client";

import type { DeploymentRecord } from "@/lib/history";
import StatusBadge from "@/components/StatusBadge";

type DeploymentHistoryProps = {
  records: DeploymentRecord[];
  onRedeploy: (record: DeploymentRecord) => void;
  redeployingSlug: string | null;
};

export default function DeploymentHistory({
  records,
  onRedeploy,
  redeployingSlug,
}: DeploymentHistoryProps) {
  if (records.length === 0) return null;

  return (
    <div className="mt-14">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Recent deployments
      </p>
      <ul className="mt-3 divide-y divide-zinc-900 rounded-md border border-zinc-900">
        {records.map((record) => (
          <li
            key={record.projectSlug}
            className="flex items-center gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-100">
                {record.projectSlug}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {record.gitURL}
              </p>
            </div>
            <StatusBadge status={record.status} />
            {record.status === "ready" && (
              <a
                href={record.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-blue-400 hover:underline"
              >
                Visit
              </a>
            )}
            <button
              onClick={() => onRedeploy(record)}
              disabled={redeployingSlug === record.projectSlug}
              className="shrink-0 rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-600 disabled:opacity-50"
            >
              {redeployingSlug === record.projectSlug
                ? "Redeploying..."
                : "Redeploy"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
