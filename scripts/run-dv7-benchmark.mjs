import { runDv7CoverageBenchmark } from "../modules/benchmark/dv7.ts";

const report = runDv7CoverageBenchmark();

console.log(JSON.stringify({
  total: report.total,
  passed: report.passed,
  failed: report.failed,
  passRate: Number((report.passRate * 100).toFixed(2)),
  byCategory: report.byCategory,
  failureReasons: report.failureReasons,
  failures: report.failures.slice(0, 30),
}, null, 2));

if (report.failed > 0) process.exitCode = 1;

