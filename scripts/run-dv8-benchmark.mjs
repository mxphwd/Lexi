import { runDv8BlindBenchmark } from "../modules/benchmark/dv8.ts";

const report = runDv8BlindBenchmark();
console.log(JSON.stringify(report, null, 2));

if (report.total < 3_000) process.exitCode = 1;
