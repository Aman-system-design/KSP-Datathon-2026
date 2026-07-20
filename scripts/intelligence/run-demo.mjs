import fs from 'node:fs';
import { evaluatePipeline, runIntelligencePipeline } from '@ksp/intelligence-core';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));
const output = runIntelligencePipeline(input);
const evaluation = evaluatePipeline(output, truth);

fs.mkdirSync('artifacts/intelligence', { recursive: true });
fs.writeFileSync('artifacts/intelligence/demo-report.json', `${JSON.stringify({ output, evaluation }, null, 2)}\n`);
console.log(`${evaluation.pass ? 'PASS' : 'FAIL'}: intelligence demo ${input.fixtureVersion}`);
if (!evaluation.pass) process.exitCode = 1;
