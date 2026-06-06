// 极简零依赖测试工具 (不引 jest 等)。test() 立即执行并累计计数。
export let passed = 0, failed = 0;

export function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
export function near(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }
export function nearVec(p, x, y, z, eps = 1e-6) { return p && near(p.x, x, eps) && near(p.y, y, eps) && near(p.z, z, eps); }
