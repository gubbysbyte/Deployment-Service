"use client";

import { Fragment } from "react";
import {
  CloudUpload,
  Container,
  Globe,
  Radio,
  Server,
  type LucideIcon,
} from "lucide-react";
import Reveal from "@/components/landing/Reveal";

type Stage = {
  icon: LucideIcon;
  label: string;
  detail: string;
  code: string;
};

const STAGES: Stage[] = [
  {
    icon: Server,
    label: "API server",
    detail: "Express, validates and queues",
    code: "POST /project",
  },
  {
    icon: Container,
    label: "Fargate task",
    detail: "A fresh container per deploy",
    code: "ecs.RunTask",
  },
  {
    icon: CloudUpload,
    label: "Build server",
    detail: "Clone, install, build, upload",
    code: "npm run build",
  },
  {
    icon: Globe,
    label: "S3 + proxy",
    detail: "Resolved by subdomain",
    code: "<slug>.your-domain",
  },
];

function Connector({ delay }: { delay: number }) {
  return (
    <div
      aria-hidden
      className="relative mx-2 hidden w-10 shrink-0 self-center overflow-hidden md:block"
    >
      <div className="h-px w-full bg-zinc-800" />
      <div
        style={{ animationDelay: `${delay}ms` }}
        className="absolute inset-y-0 left-0 h-px w-1/3 animate-packet bg-gradient-to-r from-transparent via-zinc-300 to-transparent motion-reduce:hidden"
      />
    </div>
  );
}

export default function Pipeline() {
  return (
    <section className="mt-28">
      <Reveal>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          What happens when you press deploy
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          Four hops, no servers of your own.
        </h2>
      </Reveal>

      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-stretch md:gap-0">
        {STAGES.map((stage, i) => (
          <Fragment key={stage.label}>
            <Reveal delay={i * 70} className="flex-1">
              <div className="group h-full rounded-lg border border-zinc-900 bg-zinc-950/60 p-4 transition-colors duration-200 ease-out hover:border-zinc-700">
                <stage.icon className="h-4 w-4 text-zinc-500 transition-colors duration-200 ease-out group-hover:text-zinc-300" />
                <p className="mt-3 text-sm font-medium text-zinc-100">
                  {stage.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {stage.detail}
                </p>
                <code className="mt-3 block truncate font-mono text-[11px] text-emerald-400/80">
                  {stage.code}
                </code>
              </div>
            </Reveal>
            {i < STAGES.length - 1 && <Connector delay={i * 320} />}
          </Fragment>
        ))}
      </div>

      <Reveal delay={320}>
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-dashed border-zinc-900 px-4 py-3">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
          <p className="text-xs leading-relaxed text-zinc-500">
            Progress travels back the other way. The build container publishes
            to <span className="text-zinc-300">Redis</span>, the API server
            relays it over <span className="text-zinc-300">socket.io</span>,
            and the logs stream into your browser line by line.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
