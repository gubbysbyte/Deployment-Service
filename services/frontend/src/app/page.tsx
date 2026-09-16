"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { deployProject, SOCKET_URL } from "@/lib/api";
import {
  useDeploymentHistory,
  upsertRecord,
  updateRecordStatus,
  type DeploymentRecord,
} from "@/lib/history";
import Terminal from "@/components/Terminal";
import StatusBadge, { type DeployStatus } from "@/components/StatusBadge";
import DeploymentHistory from "@/components/DeploymentHistory";
import Pipeline from "@/components/landing/Pipeline";
import Stack from "@/components/landing/Stack";
import AmbientGlow from "@/components/landing/AmbientGlow";


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

  const history = useDeploymentHistory();
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
      upsertRecord({
        projectSlug: res.data.projectSlug,
        gitURL: url,
        url: res.data.url,
        status: "queued",
        updatedAt: Date.now(),
      });
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
      <AmbientGlow />
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-4">
          <span className="text-lg leading-none">▲</span>
          <span className="text-sm font-medium tracking-tight">Deploy</span>
          <a
            href="/engineering"
            className="ml-auto rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors duration-150 ease-out hover:text-zinc-100"
          >
            Engineering
          </a>
          <a
            href="https://github.com/gubbysbyte/Deployment-Service"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-[color,transform] duration-150 ease-out hover:text-zinc-100 active:scale-[0.97] motion-reduce:active:scale-100"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className="h-3.5 w-3.5 fill-current"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            Source
          </a>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-28 pt-16">
        {!projectSlug ? (
          <div key="hero">
            <div className="animate-rise">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live demo - no signup
              </span>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl sm:leading-[1.05]">
                Push a repo.
                <br />
                <span className="text-zinc-500">Get a URL.</span>
              </h1>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-400">
                Paste any public GitHub repository. It gets cloned and built in
                a fresh container on AWS Fargate, uploaded to S3, and served
                back at its own subdomain with the build logs streaming to you
                as it happens.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-9 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="url"
                  required
                  value={gitURL}
                  onChange={(e) => setGitURL(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  disabled={submitting}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors duration-200 ease-out focus:border-zinc-500 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex min-w-[124px] items-center justify-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-medium text-black transition-[transform,opacity] duration-150 ease-out hover:opacity-85 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 motion-reduce:active:scale-100"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Deploying" : "Deploy"}
                </button>
              </form>

              {formError && (
                <p className="mt-3 animate-rise text-sm text-red-400">
                  {formError}
                </p>
              )}

              <p className="mt-4 text-xs text-zinc-500">
                No repo handy?{" "}
                <button
                  type="button"
                  onClick={() => setGitURL(EXAMPLE_REPO)}
                  className="inline-flex items-center gap-0.5 text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition-colors duration-150 ease-out hover:text-zinc-100 hover:decoration-zinc-400"
                >
                  Use the example repo
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </p>

              <DeploymentHistory
                records={history}
                onRedeploy={handleRedeploy}
                redeployingSlug={redeployingSlug}
              />
            </div>

            <Pipeline />
            <Stack />
          </div>
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

      <footer className="relative border-t border-zinc-900">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-6 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center">
          <span>Built on Fargate, S3 and Redis pub/sub.</span>
          <a
            href="https://github.com/gubbysbyte"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150 ease-out hover:text-zinc-400 sm:ml-auto"
          >
            gubbysbyte
          </a>
        </div>
      </footer>
    </div>
  );
}
