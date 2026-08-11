import { runDv10Benchmark, validateDv10BenchmarkArtifact } from "../modules/benchmark/dv10.ts";

const validation = await validateDv10BenchmarkArtifact();
if (!validation.valid) throw new Error(`DV10 frozen benchmark validation failed: ${JSON.stringify(validation)}`);
console.log(JSON.stringify(await runDv10Benchmark(), null, 2));
