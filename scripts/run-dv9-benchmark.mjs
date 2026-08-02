import { runDv9Benchmark } from "../modules/benchmark/dv9.ts";

console.log(JSON.stringify(await runDv9Benchmark(), null, 2));
