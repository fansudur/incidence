// 锁住地形(斜面基面版): 确定性、不越出安全区、抬升在 [0,amp]、裙边贴基面、随参数伸缩不跳变。
import { test, assert } from './harness.js';
import { traceFrustum } from '../src/core/frustum.js';
import { safeRegions } from '../src/core/activity.js';
import { terrainOnPlane, pointAt } from '../src/core/terrain.js';
import { v, sub, dot, cross, normalize } from '../src/core/vec.js';

const base = { mAngle: [45, 45, 45], mDist: [550, 359, 634], layerCount: 3, fDist: 170, frameW: 60, frameH: 40 };
const S = v(0, 0, 0);
function setup(p = base) {
  const r = traceFrustum(p);
  const mc = r.endMirror ? [...r.mirrors, r.endMirror] : r.mirrors;
  const reg = safeRegions(mc, S)[0];
  return { reg, basePts: [mc[0][2], mc[0][3], mc[1][3]] };
}
function planeUp(basePts) { // 基面朝上法向 + y_base(x,z)
  const [pa, pb, pc] = basePts;
  let n = normalize(cross(sub(pb, pa), sub(pc, pa)));
  if (n.y < 0) n = v(-n.x, -n.y, -n.z);
  return { n, yBase: (x, z) => pa.y - (n.x * (x - pa.x) + n.z * (z - pa.z)) / n.y };
}

test('地形(斜面): 同种子逐值一致, 换种子不同 (确定性)', () => {
  const { reg, basePts } = setup();
  const a = terrainOnPlane(reg.points, basePts, { seed: 7 });
  const b = terrainOnPlane(reg.points, basePts, { seed: 7 });
  const c = terrainOnPlane(reg.points, basePts, { seed: 8 });
  assert(a && b && c, '应能生成');
  assert(a.positions.length === b.positions.length && a.positions.every((x, i) => x === b.positions[i]), '同种子应一致');
  assert(c.positions.some((x, i) => x !== a.positions[i]), '换种子应不同');
});

test('地形(斜面): 表面竖直抬升∈[0,amp], 裙边底点贴基面, 表面点在 footprint 内', () => {
  const { reg, basePts } = setup();
  const g = terrainOnPlane(reg.points, basePts, { seed: 7, ampRatio: 0.2 });
  const { yBase } = planeUp(basePts);
  const m = g.meta;
  const inHull2 = (a, b) => { // 与 CORE 同判定
    let sign = 0;
    for (let i = 0; i < m.hull2.length; i++) {
      const p = m.hull2[i], q = m.hull2[(i + 1) % m.hull2.length];
      const cr = (q.a - p.a) * (b - p.b) - (q.b - p.b) * (a - p.a);
      if (Math.abs(cr) < 1e-9) continue;
      if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false;
    }
    return true;
  };
  const used = new Set(g.indices);
  let surf = 0, skirt = 0;
  for (const i of used) {
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1], z = g.positions[i * 3 + 2];
    const lift = y - yBase(x, z);
    if (g.rel[i] >= 0) { // 表面点
      surf++;
      assert(lift >= -1e-4 && lift <= m.amp + 1e-4, `表面抬升 ${lift} 应∈[0,amp=${m.amp.toFixed(3)}]`);
      // 横向越界检查投【基面点】(竖直抬升不会横向出界: 安全区侧壁全为竖直平面)
      const bp = { x, y: y - g.rel[i] * m.amp, z };
      const a = dot(sub(bp, m.pa), m.e1), b = dot(sub(bp, m.pa), m.e2);
      assert(inHull2(a, b), `基面投影点应在安全区 footprint 内`);
    } else { // 裙边底点
      skirt++;
      assert(Math.abs(lift) < 1e-4, `裙边底应贴基面, 偏差 ${lift}`);
    }
  }
  assert(surf > 0 && skirt > 0, `应同时有表面(${surf})与裙边(${skirt}) — 切割边缘存在`);
});

test('地形(斜面): 镜距改变 → 范围伸缩, 同 (u,v) 相对地貌不变 (山不跳变)', () => {
  const s1 = setup(), s2 = setup({ ...base, mDist: [550, 600, 634] });
  const g1 = terrainOnPlane(s1.reg.points, s1.basePts, { seed: 7 });
  const g2 = terrainOnPlane(s2.reg.points, s2.basePts, { seed: 7 });
  assert(g1 && g2, '两组参数都应能生成');
  assert(Math.abs(g2.meta.sa - g1.meta.sa) + Math.abs(g2.meta.sb - g1.meta.sb) > 0.1, '范围应明显不同');
  const relLift = (g) => { const p = pointAt(g.meta, 0.5, 0.5); const { yBase } = planeUp([g.meta.pa, v(g.meta.pa.x + g.meta.e1.x, g.meta.pa.y + g.meta.e1.y, g.meta.pa.z + g.meta.e1.z), v(g.meta.pa.x + g.meta.e2.x, g.meta.pa.y + g.meta.e2.y, g.meta.pa.z + g.meta.e2.z)]); return (p.y - yBase(p.x, p.z)) / g.meta.amp; };
  const r1 = relLift(g1), r2 = relLift(g2);
  assert(Math.abs(r1 - r2) < 1e-9, `同 (u,v) 同种子相对高度应严格相等 (${r1} vs ${r2})`);
});

test('地形(斜面): ampRatio=0 → 表面退化为基面(无起伏)', () => {
  const { reg, basePts } = setup();
  const g = terrainOnPlane(reg.points, basePts, { seed: 7, ampRatio: 0 });
  const { yBase } = planeUp(basePts);
  const used = new Set(g.indices);
  for (const i of used) {
    if (g.rel[i] < 0) continue;
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1], z = g.positions[i * 3 + 2];
    assert(Math.abs(y - yBase(x, z)) < 1e-4, '幅度0应全贴基面');
  }
});
