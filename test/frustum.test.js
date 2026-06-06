// 锁住视锥追迹: 三层尺寸递增、结构正确、极端角度触发穿帮。
import { test, assert } from './harness.js';
import { traceFrustum, projectGrid } from '../src/core/frustum.js';
import { dist } from '../src/core/vec.js';

// 作者 .gh 实测参数
const base = { mAngle: [45, 45, 45], mDist: [550, 359, 634], layerCount: 3, fDist: 170, frameW: 60, frameH: 40 };
const quadSize = (q) => dist(q[0], q[2]); // 四边形对角线长

test('默认参数: 3 面镜, 不穿帮', () => {
  const r = traceFrustum(base);
  assert(r.bugLayer === 0, `不应穿帮, 实际 bugLayer=${r.bugLayer}`);
  assert(r.mirrors.length === 3, `应有 3 面镜, 实际 ${r.mirrors.length}`);
  assert(r.endMirror !== null && r.endMirror.length === 4, '应有收尾镜 endMirror(4 角)');
});

test('三层镜面尺寸递增 (W₁ < W₂ < W₃) — 视锥发散的自然结果', () => {
  const s = traceFrustum(base).mirrors.map(quadSize);
  assert(s[0] < s[1] && s[1] < s[2], `应递增, 实际 [${s.map((x) => x.toFixed(1))}]`);
});

test('中心光路 = Σ + 3 镜心 + 收尾镜心 = 5 个点', () => {
  assert(traceFrustum(base).beam.length === 5, '默认应有 5 个 beam 点');
});

test('收尾镜 endMirror: 4 角齐全 (给末段活动区当后墙)', () => {
  const r = traceFrustum(base);
  assert(r.endMirror && r.endMirror.length === 4, `应有收尾镜 4 角, 实际 ${r.endMirror && r.endMirror.length}`);
});

test('镜面角度大幅偏移 → 角光线越过 → 穿帮 (bugLayer>0)', () => {
  const r = traceFrustum({ ...base, mAngle: [45, 88, 45] });
  assert(r.bugLayer > 0, `M₂=88° 应触发穿帮, 实际 bugLayer=${r.bugLayer}`);
});

test('层数=1: 只 1 面镜, 仍有效', () => {
  const r = traceFrustum({ ...base, layerCount: 1 });
  assert(r.bugLayer === 0 && r.mirrors.length === 1, `层数1应有1面镜, 实际 ${r.mirrors.length}`);
});

test('九宫格投影: 截面数 = F + 各镜面, 每截面 16 点 (4×4)', () => {
  const r = traceFrustum(base);
  const secs = projectGrid(r.seed, r.frame, r.planes, 3);
  assert(secs.length === r.planes.length + 1, `应 = F + ${r.planes.length} 面截面, 实际 ${secs.length}`);
  assert(secs.every((s) => s.length === 16), '每截面应 4×4=16 点');
});

test('九宫格: F 上网格四角 = 取景框四角 (行主序 上左/上右/下左/下右)', () => {
  const r = traceFrustum(base);
  const g = projectGrid(r.seed, r.frame, r.planes, 3)[0];
  const near = (a, b) => dist(a, b) < 1e-9;
  assert(near(g[0], r.frame[1]) && near(g[3], r.frame[0]) && near(g[12], r.frame[2]) && near(g[15], r.frame[3]), '网格四角应对上 frame');
});
