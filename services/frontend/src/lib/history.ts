import type { DeployStatus } from "@/components/StatusBadge";

export type DeploymentRecord = {
  projectSlug: string;
  gitURL: string;
  url: string;
  status: DeployStatus;
  updatedAt: number;
};

const STORAGE_KEY = "deploy-history";
const MAX_RECORDS = 20;

export function getHistory(): DeploymentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(records: DeploymentRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage unavailable (private mode, blocked, etc.) - history just won't persist
  }
}

export function upsertRecord(record: DeploymentRecord): DeploymentRecord[] {
  const existing = getHistory().filter(
    (r) => r.projectSlug !== record.projectSlug
  );
  const next = [record, ...existing].slice(0, MAX_RECORDS);
  saveHistory(next);
  return next;
}

export function updateRecordStatus(
  projectSlug: string,
  status: DeployStatus
): DeploymentRecord[] {
  const records = getHistory();
  const index = records.findIndex((r) => r.projectSlug === projectSlug);
  if (index === -1) return records;

  records[index] = { ...records[index], status, updatedAt: Date.now() };
  saveHistory(records);
  return records;
}
