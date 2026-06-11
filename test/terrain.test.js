// 锁住地形(展开连续场版): 确定性、不越界、【镜面接缝高度严格相等】、M₁ 近端趋平、幅度0退化。
import { test, assert } from './harness.js';
import { traceFrustum } from '../src/core/frustum.js';
import { safeRegions } from '../src/core/activity.js';
import { terrainOnPlane, pointAt, liftField } from '../src/core/terrain.js';
import { v, sub, dot, cross, normalize, dist, lerp, scale, add } from '../src/core/vec.js';

const base = { mAngle: [45, 45, 45], mDist: [550, 359, 634], layerCount: 3, fDist: 170, frameW: 60, frameH: 40 };
const S0 = v(0, 0, 0);
function setup(p = base, opts = {}) {
  const r = traceFrustum(p);
  const mc = r.endMirror ? [...r.mirrors, r.endMirror] : r.mirrors;
  const bm = r.beam;
  const S = [0];
  for (let i = 1; i < bm.length; i++) S.push(S[i - 1] + dist(bm[i - 1], bm[i]));
  const fpBase = {
    hSlope: p.frameH / p.fDist, wSlope: (p.frameW / 2) / p.fDist,
    rampA: S[1], rampB: S[2],
    seed: opts.seed ?? 7, waves: opts.waves ?? 3, ampRatio: opts.ampRatio ?? 0.15,
  };
  const frame = (g) => {
    const dir = normalize(sub(bm[g + 2], bm[g + 1]));
    const par = g % 2 === 0 ? 1 : -1; // 横向轴随反射传递(镜子翻手性), 与 worldView 同构造
    return { ...fpBase, P0: bm[g + 1], dir, side: { x: -dir.z * par, y: 0, z: dir.x * par }, S0: S[g + 1] };
  };
  return { mc, regions: safeRegions(mc, S0), frame };
}

test('地形(连续场): 同种子逐值一致, 换种子不同 (确定性)', () => {
  const { mc, regions, frame } = setup();
  const basePts = [mc[0][2], mc[0][3], mc[1][3]];
  const a = terrainOnPlane(regions[0].points, basePts, frame(0));
  const b = terrainOnPlane(regions[0].points, basePts, frame(0));
  const { frame: f9 } = setup(base, { seed: 9 });
  const c = terrainOnPlane(regions[0].points, basePts, f9(0));
  assert(a && b && c, '应能生成');
  assert(a.positions.every((x, i) => x === b.positions[i]), '同种子应逐值一致');
  assert(c.positions.some((x, i) => x !== a.positions[i]), '换种子应不同');
});

test('地形(连续场): ★镜面接缝处相邻两层抬升严格相等 (反射不变性 → 跨层连成整体)', () => {
  const { mc, frame } = setup();
  const f0 = frame(0), f1 = frame(1);
  for (const t of [0.15, 0.5, 0.85]) {                          // M₂ 下边上的若干点(两层的公共缝)
    const p = lerp(mc[1][2], mc[1][3], t);
    const L0 = liftField(f0, p).lift, L1 = liftField(f1, p).lift;
    assert(Math.abs(L0 - L1) < 1e-9, `接缝点 t=${t}: 两层抬升应严格相等 (${L0} vs ${L1})`);
  }
  // 不止下边: 镜面平面内任意点都不变 (取下边中点向上抬一点仍在镜面平面内? 不一定; 用下边两端+中点已足够锁住)
});

test('地形(连续场): M₁ 近端趋平 (深度包络 ramp=0), 向 M₂ 渐起', () => {
  const { mc, frame } = setup();
  const f0 = frame(0);
  const nearPt = lerp(mc[0][2], mc[0][3], 0.5);                  // M₁ 下边中点 (s≈rampA)
  const farPt = lerp(mc[1][2], mc[1][3], 0.5);                   // M₂ 下边中点 (s≈rampB)
  const Ln = liftField(f0, nearPt).lift, Lf = liftField(f0, farPt).lift;
  assert(Math.abs(Ln) < 0.005, `M₁ 近端应趋平(边中点 s 略过 M₁, 容许渐变残量), 实际抬升 ${Ln}`);
  assert(Lf > 0.01 && Lf > Ln * 10, `M₂ 端应明显高于近端, 实际 近${Ln} 远${Lf}`);
});

test('地形(连续场): 表面抬升≥0且有界, 基面投影在 footprint 内, 裙边贴基面', () => {
  const { mc, regions, frame } = setup();
  const f0 = frame(0);
  const g = terrainOnPlane(regions[0].points, [mc[0][2], mc[0][3], mc[1][3]], f0);
  const m = g.meta;
  const inHull2 = (a, b) => {
    let sign = 0;
    for (let i = 0; i < m.hull2.length; i++) {
      const p = m.hull2[i], q = m.hull2[(i + 1) % m.hull2.length];
      const cr = (q.a - p.a) * (b - p.b) - (q.b - p.b) * (a - p.a);
      if (Math.abs(cr) < 1e-9) continue;
      if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false;
    }
    return true;
  };
  // 基面平面 y(x,z)
  let n = normalize(cross(sub(mc[0][3], mc[0][2]), sub(mc[1][3], mc[0][2])));
  if (n.y < 0) n = v(-n.x, -n.y, -n.z);
  const yBase = (x, z) => mc[0][2].y - (n.x * (x - mc[0][2].x) + n.z * (z - mc[0][2].z)) / n.y;
  const used = new Set(g.indices);
  let surf = 0, skirt = 0;
  for (const i of used) {
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1], z = g.positions[i * 3 + 2];
    const lift = y - yBase(x, z);
    if (g.rel[i] >= 0) {
      surf++;
      assert(lift >= -1e-4, `表面抬升应≥0, 实际 ${lift}`);
      const bp = { x, y: y - lift, z };
      const a = dot(sub(bp, m.pa), m.e1), b = dot(sub(bp, m.pa), m.e2);
      assert(inHull2(a, b), '基面投影点应在安全区 footprint 内');
    } else { skirt++; assert(Math.abs(lift) < 1e-4, `裙边底应贴基面, 偏差 ${lift}`); }
  }
  assert(surf > 0 && skirt > 0, `应同时有表面(${surf})与裙边(${skirt})`);
});

test('地形(连续场): ampRatio=0 → 全贴基面; pointAt 与 liftField 一致', () => {
  const { mc, regions, frame } = setup(base, { ampRatio: 0 });
  const f0 = frame(0);
  const g = terrainOnPlane(regions[0].points, [mc[0][2], mc[0][3], mc[1][3]], f0);
  let n = normalize(cross(sub(mc[0][3], mc[0][2]), sub(mc[1][3], mc[0][2])));
  if (n.y < 0) n = v(-n.x, -n.y, -n.z);
  const yBase = (x, z) => mc[0][2].y - (n.x * (x - mc[0][2].x) + n.z * (z - mc[0][2].z)) / n.y;
  const used = new Set(g.indices);
  for (const i of used) {
    if (g.rel[i] < 0) continue;
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1], z = g.positions[i * 3 + 2];
    assert(Math.abs(y - yBase(x, z)) < 1e-4, '幅度0应全贴基面');
  }
  const p = pointAt(g.meta, 0.5, 0.5);                           // pointAt 路径一致性
  assert(Math.abs(p.y - yBase(p.x, p.z)) < 1e-9, 'pointAt 在幅度0时应落在基面上');
});
