import { useSyncExternalStore } from "react";
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
const EMPTY: DeploymentRecord[] = [];

let cachedRaw: string | null = null;
let cachedRecords: DeploymentRecord[] = EMPTY;

function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getSnapshot(): DeploymentRecord[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedRecords;

  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw);
    cachedRecords = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cachedRecords = EMPTY;
  }
  return cachedRecords;
}

function getServerSnapshot(): DeploymentRecord[] {
  return EMPTY;
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function emitChange() {
  for (const listener of listeners) listener();
}

function save(records: DeploymentRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage unavailable (private mode, blocked, etc.) - history just won't persist
  }
  emitChange();
}

export function useDeploymentHistory(): DeploymentRecord[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function upsertRecord(record: DeploymentRecord) {
  const existing = getSnapshot().filter(
    (r) => r.projectSlug !== record.projectSlug
  );
  save([record, ...existing].slice(0, MAX_RECORDS));
}

export function updateRecordStatus(projectSlug: string, status: DeployStatus) {
  const records = getSnapshot();
  const index = records.findIndex((r) => r.projectSlug === projectSlug);
  if (index === -1) return;

  const next = [...records];
  next[index] = { ...next[index], status, updatedAt: Date.now() };
  save(next);
}
