// 零依赖测试 runner: 跑本目录下所有 *.test.js, 汇总通过/失败。用法: node test/run.js
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(dir).filter((f) => f.endsWith('.test.js'))) {
  console.log('\n' + f);
  await import(pathToFileURL(join(dir, f)).href);
}
const { passed, failed } = await import('./harness.js');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
