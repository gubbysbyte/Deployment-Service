"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { deployProject, SOCKET_URL } from "@/lib/api";
import {
  getHistory,
  upsertRecord,
  updateRecordStatus,
  type DeploymentRecord,
} from "@/lib/history";
import Terminal from "@/components/Terminal";
import StatusBadge, { type DeployStatus } from "@/components/StatusBadge";
import DeploymentHistory from "@/components/DeploymentHistory";

const EXAMPLE_REPO = "https://github.com/gubbysbyte/new-aws-test-app";

export default function Home() {
  const [gitURL, setGitURL] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [siteURL, setSiteURL] = useState<string | null>(null);
  const [status, setStatus] = useState<DeployStatus>("queued");
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState<DeploymentRecord[]>(() =>
    typeof window === "undefined" ? [] : getHistory()
  );
  const [redeployingSlug, setRedeployingSlug] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!projectSlug) return;

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("subscribe", `logs:${projectSlug}`);
    });

    socket.on("message", (raw: string) => {
      setStatus((prev) => (prev === "queued" ? "building" : prev));

      let text = raw;
      try {
        text = JSON.parse(raw).log ?? raw;
      } catch {
        // raw wasn't JSON, show as-is
      }

      if (text.includes("Upload Complete")) {
        setStatus("ready");
      }

      setLogs((prev) => [...prev, text]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectSlug]);

  useEffect(() => {
    if (!projectSlug) return;
    updateRecordStatus(projectSlug, status);
  }, [status, projectSlug]);

  async function runDeploy(url: string, slug?: string) {
    setSubmitting(true);
    setFormError(null);
    setLogs([]);
    setStatus("queued");
    setSiteURL(null);
    setProjectSlug(null);
    setCopied(false);

    try {
      const res = await deployProject(url, slug);
      setProjectSlug(res.data.projectSlug);
      setSiteURL(res.data.url);
      setHistory(
        upsertRecord({
          projectSlug: res.data.projectSlug,
          gitURL: url,
          url: res.data.url,
          status: "queued",
          updatedAt: Date.now(),
        })
      );
    } catch (err) {
      setStatus("error");
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
      setRedeployingSlug(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gitURL.trim()) return;
    runDeploy(gitURL.trim());
  }

  function handleRedeploy(record: DeploymentRecord) {
    setGitURL(record.gitURL);
    setRedeployingSlug(record.projectSlug);
    runDeploy(record.gitURL, record.projectSlug);
  }

  function handleReset() {
    setGitURL("");
    setProjectSlug(null);
    setSiteURL(null);
    setStatus("queued");
    setLogs([]);
    setFormError(null);
    setHistory(getHistory());
  }

  function handleCopy() {
    if (!siteURL) return;
    navigator.clipboard.writeText(siteURL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-1 flex-col bg-black text-zinc-100">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-5">
          <span className="text-lg leading-none">▲</span>
          <span className="text-sm font-medium tracking-tight">Deploy</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
        {!projectSlug ? (
          <>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Deploy any repo.
              <br />
              Instantly.
            </h1>
            <p className="mt-4 max-w-md text-zinc-400">
              Paste a public GitHub repository URL and we&apos;ll build and
              host it for you in seconds.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 flex gap-2">
              <input
                type="url"
                required
                value={gitURL}
                onChange={(e) => setGitURL(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {submitting ? "Deploying..." : "Deploy"}
              </button>
            </form>

            {formError && (
              <p className="mt-3 text-sm text-red-400">{formError}</p>
            )}

            <p className="mt-3 text-xs text-zinc-500">
              Don&apos;t have a repo handy? Try{" "}
              <button
                type="button"
                onClick={() => setGitURL(EXAMPLE_REPO)}
                className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
              >
                {EXAMPLE_REPO}
              </button>
            </p>

            <DeploymentHistory
              records={history}
              onRedeploy={handleRedeploy}
              redeployingSlug={redeployingSlug}
            />
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Project
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {projectSlug}
                </h1>
              </div>
              <StatusBadge status={status} />
            </div>

            {siteURL && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5">
                <a
                  href={siteURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`truncate text-sm ${
                    status === "ready"
                      ? "text-blue-400 hover:underline"
                      : "pointer-events-none text-zinc-500"
                  }`}
                >
                  {siteURL}
                </a>
                <button
                  onClick={handleCopy}
                  className="ml-auto shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}

            <div className="mt-6">
              <Terminal lines={logs} />
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleReset}
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                ← Deploy another project
              </button>
              <button
                onClick={() =>
                  gitURL && projectSlug && runDeploy(gitURL, projectSlug)
                }
                disabled={submitting || status === "building"}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-600 disabled:opacity-50"
              >
                Redeploy
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-zinc-600">
          Built on Fargate, S3 and Redis pub/sub.
        </div>
      </footer>
    </div>
  );
}
