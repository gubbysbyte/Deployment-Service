import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

export const metadata: Metadata = {
  title: "Engineering - Deploy",
  description: "How the deploy pipeline works, and why it's shaped this way.",
};

const FACTS = [
  { label: "Runtime", value: "AWS Fargate" },
  { label: "Artifact store", value: "Amazon S3" },
  { label: "Realtime", value: "Redis + socket.io" },
  { label: "Interface", value: "Next.js 16" },
];

const LIFECYCLE = [
  {
    label: "Submit",
    detail: "The dashboard posts the repository URL to POST /project.",
  },
  {
    label: "Queue",
    detail:
      "api-server validates the input, reserves build capacity in Redis, and starts an ECS task.",
  },
  {
    label: "Build",
    detail:
      "A fresh Fargate container installs dependencies, runs the build, and streams progress.",
  },
  {
    label: "Publish",
    detail: "The build output is uploaded to S3 and served from its own subdomain.",
  },
];

const SERVICES = [
  {
    name: "api-server",
    role: "Control plane",
    detail:
      "Exposes POST /project, starts ECS tasks, and relays build logs to the browser over socket.io.",
  },
  {
    name: "build-server",
    role: "Isolated worker",
    detail:
      "The Docker image ECS runs per deploy: installs dependencies, builds, and uploads to S3.",
  },
  {
    name: "s3-reverse-proxy",
    role: "Delivery path",
    detail: "Resolves a project's subdomain and serves the matching files out of S3.",
  },
  {
    name: "frontend",
    role: "Operator UI",
    detail: "Triggers deploys, shows the live terminal, and keeps a local deploy history.",
  },
];

const RATE_LIMIT_STATS = [
  { value: "3", label: "quick deploys before an IP's bucket empties" },
  { value: "10 min", label: "for that IP to earn one deploy back" },
  { value: "3", label: "builds allowed to run at once, platform-wide" },
];

const RATE_LIMIT_LAYERS = [
  {
    name: "Per-IP pace",
    mechanism: "A Redis Lua script tracks a token bucket per IP.",
    onFailure: "Redis hiccups fail open. Fairness bends before the demo breaks.",
  },
  {
    name: "Global capacity",
    mechanism: "A Redis sorted set acts as an atomic semaphore across all IPs.",
    onFailure: "Redis hiccups fail closed. This is the real cost ceiling.",
  },
];

const RATE_LIMIT_JOURNEYS = [
  {
    label: "Normal use",
    detail: "One token is spent, one build slot is reserved, and the build starts.",
  },
  {
    label: "Too many clicks",
    detail:
      "A fourth deploy from the same IP inside the refill window gets a 429 with a Retry-After header and a plain wait message.",
  },
  {
    label: "Platform is busy",
    detail:
      "Even with tokens left, a request is rejected once three builds are active anywhere.",
  },
  {
    label: "Build ends",
    detail:
      "When the worker logs \"Upload Complete\" or \"Build failed,\" its slot is released. A heartbeat also renews the reservation on every log line in between, so a build that is merely slow is never mistaken for one that died.",
  },
];

const DECISIONS = [
  {
    title: "One container per deployment",
    detail:
      "Each build runs in its own Fargate task, which keeps user projects isolated and makes failures easier to reason about.",
  },
  {
    title: "Redis is the realtime spine",
    detail:
      "The build task publishes logs to logs:<slug>; the API server relays that channel to the browser over socket.io.",
  },
  {
    title: "Static output is the product boundary",
    detail:
      "The system expects a build artifact in dist/ and serves that artifact from S3 through a thin reverse proxy.",
  },
];

const LIMITS = [
  "Public GitHub repos only.",
  "Build command currently assumes npm install && npm run build.",
  "Output directory is expected at dist/.",
  "Region and S3 bucket are fixed in the worker today.",
  "Rate limits are IP-based until the product has an identity layer.",
];

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

// Every row in the doc that cascades in on scroll shares one stagger rhythm:
// short delay steps, capped so a long list doesn't crawl in.
function stagger(i: number, stepMs = 70, capAt = 6) {
  return Math.min(i, capAt) * stepMs;
}

function NumberedList({
  items,
}: {
  items: { label: string; detail: string }[];
}) {
  return (
    <ol className="mt-7 space-y-7">
      {items.map((item, i) => (
        <Reveal key={item.label} delay={stagger(i)}>
          <li className="group -mx-3 flex gap-4 rounded-lg px-3 py-1 transition-colors duration-200 ease-out hover:bg-zinc-950">
            <span className="shrink-0 pt-0.5 font-mono text-sm text-zinc-600 transition-colors duration-200 ease-out group-hover:text-emerald-400/80">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-base leading-relaxed text-zinc-300">
              <span className="font-medium text-zinc-100">{item.label}.</span>{" "}
              {item.detail}
            </p>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}

export default function EngineeringPage() {
  return (
    <div className="flex flex-1 flex-col bg-black text-zinc-100">
      <div
        aria-hidden
        className="reading-progress pointer-events-none fixed inset-x-0 top-0 z-20 h-1 origin-left bg-emerald-400/80"
      />

      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-4">
          <span className="text-lg leading-none">▲</span>
          <span className="text-sm font-medium tracking-tight">Deploy</span>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors duration-150 ease-out hover:text-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Demo
          </Link>
          <a
            href="https://github.com/gubbysbyte/Deployment-Service"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-[color,transform] duration-150 ease-out hover:text-zinc-100 active:scale-[0.97] motion-reduce:active:scale-100"
          >
            <GitHubMark />
            Source
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-180 px-6 pb-32 pt-16">
        <article>
          <p className="animate-rise text-sm text-zinc-500">
            By gubbysbyte, 6 min read
          </p>
          <h1
            style={{ animationDelay: "60ms" }}
            className="animate-rise mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1]"
          >
            How the deploy pipeline works
          </h1>
          <p
            style={{ animationDelay: "120ms" }}
            className="animate-rise mt-5 text-lg leading-relaxed text-zinc-400"
          >
            A git URL becomes an isolated Fargate build, a static bundle in
            S3, and a live log stream back to the browser. This is how the
            pieces fit together, and why.
          </p>

          <div
            style={{ animationDelay: "180ms" }}
            className="animate-rise mt-12 flex flex-wrap gap-x-10 gap-y-6 border-y border-zinc-900 py-6"
          >
            {FACTS.map((fact) => (
              <div key={fact.label}>
                <p className="text-xs text-zinc-600">{fact.label}</p>
                <p className="mt-1.5 text-base text-zinc-200">{fact.value}</p>
              </div>
            ))}
          </div>

          <Reveal>
            <section className="mt-24">
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Overview
              </h2>
              <p className="mt-5 max-w-[65ch] text-base leading-loose text-zinc-300">
                The service does one thing: take a public git repository,
                build it in isolation, and serve the result from its own
                subdomain. There is no login and no persistent backend state
                outside of Redis and S3. That scope is deliberate. It keeps
                the system small enough to reason about end to end, and
                honest about what it does not yet do (see{" "}
                <a
                  href="#constraints"
                  className="text-zinc-100 underline decoration-zinc-700 underline-offset-2 transition-colors duration-150 ease-out hover:decoration-zinc-400"
                >
                  current constraints
                </a>
                , below).
              </p>
            </section>
          </Reveal>

          <section className="mt-24">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Request lifecycle
              </h2>
            </Reveal>
            <NumberedList items={LIFECYCLE} />
          </section>

          <section className="mt-24">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                How the pieces fit
              </h2>
            </Reveal>
            <div className="mt-7 divide-y divide-zinc-900">
              {SERVICES.map((service, i) => (
                <Reveal key={service.name} delay={stagger(i)}>
                  <div className="group -mx-3 rounded-lg px-3 py-6 transition-colors duration-200 ease-out first:pt-1 hover:bg-zinc-950">
                    <span className="inline-flex items-center rounded border border-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300 transition-colors duration-200 ease-out group-hover:border-emerald-400/40 group-hover:text-emerald-400/80">
                      {service.name}
                    </span>
                    <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-zinc-400">
                      <span className="text-zinc-200">{service.role}.</span>{" "}
                      {service.detail}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <Reveal>
            <section className="mt-24">
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Data flow
              </h2>
              <p className="mt-5 max-w-[65ch] text-base leading-loose text-zinc-300">
                Two flows run in opposite directions. The deploy command moves
                forward through the control plane: browser to API server to
                ECS. Build progress moves back through a separate channel: the
                build container publishes to Redis, and the API server relays
                that channel to the browser over socket.io. Splitting the two
                keeps the initial API response fast, and makes the build
                observable without polling.
              </p>
              <div className="mt-7 rounded-lg border border-zinc-900 bg-zinc-950/50 p-5">
                <div className="grid gap-2.5 font-mono text-[12.5px] leading-relaxed text-zinc-500">
                  <p>
                    browser {"->"} POST /project {"->"}{" "}
                    <span className="text-emerald-400/80">api-server</span>
                  </p>
                  <p>
                    api-server {"->"} ecs.RunTask {"->"}{" "}
                    <span className="text-emerald-400/80">Fargate build task</span>
                  </p>
                  <p>
                    build task {"->"} dist/ {"->"}{" "}
                    <span className="text-emerald-400/80">S3 __outputs/&lt;slug&gt;</span>
                  </p>
                  <p>
                    build task {"->"} Redis logs:&lt;slug&gt; {"->"} socket.io{" "}
                    {"->"} <span className="text-emerald-400/80">browser terminal</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-500">
                The two paths a deploy takes: forward through the control
                plane, and back through the log relay.
              </p>
            </section>
          </Reveal>

          <section className="mt-24">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Rate limiting
              </h2>
              <p className="mt-5 max-w-[65ch] text-base leading-loose text-zinc-300">
                The service has no login wall by design, so IP-based rate
                limiting is the only real defense on POST /project.
              </p>
              <p className="mt-6 max-w-[60ch] text-xl leading-snug text-zinc-100">
                Every call starts a real Fargate task, so this endpoint is
                protected by two independent layers.
              </p>
            </Reveal>

            <div className="mt-10 grid grid-cols-3 gap-6 border-y border-zinc-900 py-8">
              {RATE_LIMIT_STATS.map((stat, i) => (
                <Reveal key={stat.label} delay={stagger(i, 90)}>
                  <div>
                    <p className="font-mono text-3xl text-white sm:text-4xl">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      {stat.label}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {RATE_LIMIT_LAYERS.map((layer, i) => (
                <Reveal key={layer.name} delay={stagger(i, 90)}>
                  <div className="rounded-lg border border-zinc-900 p-5 transition-colors duration-200 ease-out hover:border-zinc-700">
                    <p className="text-sm font-medium text-zinc-100">
                      {layer.name}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {layer.mechanism}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                      {layer.onFailure}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <h3 className="mt-14 text-lg font-semibold text-white">
                How the IP is identified
              </h3>
              <p className="mt-4 max-w-[65ch] text-base leading-loose text-zinc-300">
                The limiter keys on the request&apos;s IP, taken from
                Express&apos;s req.ip. In local development that is the raw
                socket address. Behind a proxy, that address is instead the
                proxy&apos;s own IP unless the proxy is explicitly trusted, so
                production sets TRUST_PROXY=1 to read the real client IP from
                the X-Forwarded-For header. That flag has to match how many
                proxies actually sit in front of the server, or the identity
                the limiter uses either collapses to one shared IP for
                everyone, or becomes something a client can forge.
              </p>

              <h3 className="mt-14 text-lg font-semibold text-white">
                What happens on each click
              </h3>
            </Reveal>
            <NumberedList items={RATE_LIMIT_JOURNEYS} />
          </section>

          <section className="mt-24">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Design decisions
              </h2>
            </Reveal>
            <div className="mt-7 divide-y divide-zinc-900">
              {DECISIONS.map((decision, i) => (
                <Reveal key={decision.title} delay={stagger(i)}>
                  <div className="-mx-3 rounded-lg px-3 py-6 transition-colors duration-200 ease-out first:pt-1 hover:bg-zinc-950">
                    <p className="text-base font-medium text-zinc-100">
                      {decision.title}
                    </p>
                    <p className="mt-2 max-w-[65ch] text-base leading-relaxed text-zinc-400">
                      {decision.detail}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section id="constraints" className="mt-24">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Current constraints
              </h2>
            </Reveal>
            <ul className="mt-7 space-y-3">
              {LIMITS.map((limit, i) => (
                <Reveal key={limit} delay={stagger(i, 50)}>
                  <li className="-mx-3 rounded-lg px-3 py-1.5 text-base leading-relaxed text-zinc-400 transition-colors duration-200 ease-out hover:bg-zinc-950 hover:text-zinc-300">
                    {limit}
                  </li>
                </Reveal>
              ))}
            </ul>
          </section>
        </article>
      </main>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center">
          <span>Architecture notes for the deployment service.</span>
          <Link
            href="/"
            className="transition-colors duration-150 ease-out hover:text-zinc-400 sm:ml-auto"
          >
            Back to deploy
          </Link>
        </div>
      </footer>
    </div>
  );
}
