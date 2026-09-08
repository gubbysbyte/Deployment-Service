"use client";

type TerminalProps = {
  lines: string[];
  emptyHint?: string;
};

export default function Terminal({ lines, emptyHint }: TerminalProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black">
      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="ml-2 text-xs text-zinc-500">Build logs</span>
      </div>
      <div className="h-80 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-zinc-600">{emptyHint ?? "Waiting for logs..."}</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap text-zinc-300">
              <span className="mr-2 select-none text-zinc-600">{">"}</span>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
