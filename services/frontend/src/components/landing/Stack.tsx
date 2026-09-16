"use client";

import Reveal from "@/components/landing/Reveal";

const STACK: { name: string; role: string }[] = [
  { name: "AWS Fargate", role: "Serverless container per build" },
  { name: "Amazon S3", role: "Static output storage" },
  { name: "Redis pub/sub", role: "Build log fan-out" },
  { name: "socket.io", role: "Browser log streaming" },
  { name: "Next.js 16", role: "Dashboard and landing" },
  { name: "Docker", role: "Reproducible build image" },
];

export default function Stack() {
  return (
    <section className="mt-28">
      <Reveal>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Built with
        </p>
      </Reveal>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STACK.map((item, i) => (
          <Reveal key={item.name} delay={i * 50}>
            <div className="rounded-lg border border-zinc-900 px-4 py-3 transition-colors duration-200 ease-out hover:border-zinc-700">
              <p className="text-sm text-zinc-100">{item.name}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{item.role}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
