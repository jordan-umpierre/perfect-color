import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { toGamut, type Oklch } from "../src/color.ts";

const warmup = 3;
const repetitions = 20;
const workload: Oklch[] = Array.from({ length: 10000 }, (_, i) => ({
  l: 0.35 + (i % 500) / 1000,
  c: 0.02 + (i % 200) / 1000,
  h: (i * 137.5) % 360,
}));
const samples: number[] = [];
for (let i = 0; i < warmup + repetitions; i++) {
  const start = performance.now();
  for (const color of workload) toGamut(color);
  if (i >= warmup) samples.push(performance.now() - start);
}
const sorted = [...samples].sort((a, b) => a - b);
const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const variance =
  samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
const report = {
  standard: {
    warmup,
    repetitions,
    statistic: "median and p95",
    varianceTolerance: "coefficient of variation <= 0.25",
  },
  environment: {
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpu: os.cpus()[0]?.model ?? "unknown",
  },
  build: {
    command: "npm run typecheck && npm run build",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
  },
  workload:
    "10,000 deterministic OKLCH colors gamut-mapped to sRGB; no user data",
  results: {
    samplesMs: samples,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    coefficientOfVariation: Math.sqrt(variance) / mean,
  },
};
writeFileSync(
  new URL("../docs/performance.json", import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log("wrote docs/performance.json");
