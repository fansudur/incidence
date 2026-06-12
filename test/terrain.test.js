// 锁住地形规则(作者确认版):
//  R1 对齐衔接(所有缝): 冻结带内同角向两点抬升严格相等 → 近脊遮远口, 缝自动隐形
//  R2 贴地仅首层: 第一层 head 边全线抬升=0(按边界距离, 防斜切线漏墙); 其余层不贴地
import { test, assert } from './harness.js';
import { traceFrustum } from '../src/core/frustum.js';
import { safeRegions } from '../src/core/activity.js';
import { terrainOnPlane, pointAt, liftField, liftAt, regionDepthInfo, warpS, mergeBands } from '../src/core/terrain.js';
import { v, sub, dot, cross, normalize, dist, lerp } from '../src/core/vec.js';

const base = { mAngle: [45, 45, 45], mDist: [550, 359, 634], layerCount: 3, fDist: 170, frameW: 60, frameH: 40 };
const S0pt = v(0, 0, 0);

// 复刻 worldView 两遍构造: frames → regionDepthInfo → 冻结带 → fp
function setup(p = base, opts = {}) {
  const r = traceFrustum(p);
  const mc = r.endMirror ? [...r.mirrors, r.endMirror] : r.mirrors;
  const bm = r.beam;
  const S = [0];
  for (let i = 1; i < bm.length; i++) S.push(S[i - 1] + dist(bm[i - 1], bm[i]));
  const frameOf = (g) => {
    const dir = normalize(sub(bm[g + 2], bm[g + 1]));
    const par = g % 2 === 0 ? 1 : -1;
    return { P0: bm[g + 1], dir, side: { x: -dir.z * par, y: 0, z: dir.x * par }, S0: S[g + 1] };
  };
  const regs = safeRegions(mc, S0pt).filter((q) => q.gap + 2 < bm.length && q.gap + 1 < mc.length);
  const basePtsOf = (g) => [mc[g][2], mc[g][3], mc[g + 1][3]];
  const infos = regs.map((q) => regionDepthInfo(q.points, basePtsOf(q.gap), frameOf(q.gap)));
  const rawBands = [];
  for (let i = 0; i < regs.length - 1; i++)
    if (infos[i] && infos[i + 1] && regs[i + 1].gap === regs[i].gap + 1 && infos[i].tailMinS < infos[i + 1].headMaxS)
      rawBands.push([infos[i].tailMinS, infos[i + 1].headMaxS]);
  const bands = mergeBands(rawBands); // 与 worldView 同: 重叠带必须合并
  const fpBase = {
    hSlope: p.frameH / p.fDist, wSlope: (p.frameW / 2) / p.fDist,
    rampA: warpS(S[1], bands), rampB: warpS(S[2], bands),
    seed: opts.seed ?? 7, waves: opts.waves ?? 3, ampRatio: opts.ampRatio ?? 0.15,
    headFrac: opts.headFrac ?? 0.25, bands,
  };
  const fpOf = (g, flush = g === 0) => ({ ...fpBase, ...frameOf(g), flushFront: flush });
  return { mc, bm, S, regs, infos, bands, basePtsOf, fpOf };
}
// 在段坐标系里按 (s, 角向θ) 造水平点
const ptAt = (fp, s, th) => ({
  x: fp.P0.x + fp.dir.x * (s - fp.S0) + fp.side.x * (th * fp.wSlope * s),
  y: fp.P0.y,
  z: fp.P0.z + fp.dir.z * (s - fp.S0) + fp.side.z * (th * fp.wSlope * s),
});

test('mergeBands: 重叠/相接带合并; 合并后 warpS 恢复单调 (重叠会让 σ 斜率-1 回折 — 实测可达组合的回归)', () => {
  const m = mergeBands([[6.679, 11.51], [10.39, 19.538]]);       // 默认 mDist 配 mAngle=[45,30,30] 的实测重叠带
  assert(m.length === 1 && Math.abs(m[0][0] - 6.679) < 1e-12 && Math.abs(m[0][1] - 19.538) < 1e-12, '重叠应并成一条大带');
  let prev = -Infinity;
  for (let s = 0; s <= 25; s += 0.1) { const sig = warpS(s, m); assert(sig >= prev - 1e-12, `σ 应单调 (s=${s.toFixed(1)})`); prev = sig; }
  // 真实参数路径: 非45°角下 setup 产出的带应已合并且 σ 全程单调
  const { bands } = setup({ ...base, mAngle: [45, 30, 30] });
  for (let i = 1; i < bands.length; i++) assert(bands[i][0] > bands[i - 1][1], '产出带之间不应重叠');
  prev = -Infinity;
  for (let s = 0; s <= 30; s += 0.1) { const sig = warpS(s, bands); assert(sig >= prev - 1e-12, '真实带下 σ 应单调'); prev = sig; }
});

test('warpS: 单调连续, 冻结带内严格平坦', () => {
  const bands = [[5, 7], [10, 11]];
  assert(warpS(5, bands) === warpS(6, bands) && warpS(6, bands) === warpS(7, bands), '带内应平坦');
  assert(warpS(4.9, bands) < warpS(5, bands) + 1e-12 && warpS(7.1, bands) > warpS(7, bands), '带外应递增');
  assert(Math.abs(warpS(8, bands) - (8 - 2)) < 1e-12, '带后应平移带宽');
});

test('地形: 同种子逐值一致, 换种子不同 (确定性)', () => {
  const { mc, regs, basePtsOf, fpOf } = setup();
  const g0 = terrainOnPlane(regs[0].points, basePtsOf(0), fpOf(0));
  const g0b = terrainOnPlane(regs[0].points, basePtsOf(0), fpOf(0));
  const s9 = setup(base, { seed: 9 });
  const g0c = terrainOnPlane(s9.regs[0].points, s9.basePtsOf(0), s9.fpOf(0));
  assert(g0 && g0b && g0c, '应能生成');
  assert(g0.positions.every((x, i) => x === g0b.positions[i]), '同种子应逐值一致');
  assert(g0c.positions.some((x, i) => x !== g0.positions[i]), '换种子应不同');
});

test('★R1 对齐衔接: 冻结带内同角向, 第g层与第g+1层抬升严格相等 (每道缝)', () => {
  const { bands, fpOf, regs } = setup();
  assert(bands.length >= 2, `应有≥2条冻结带(实际 ${bands.length})`);
  for (let k = 0; k < bands.length; k++) {
    const [a, b] = bands[k];
    const fA = fpOf(regs[k].gap, false), fB = fpOf(regs[k + 1].gap, false);
    for (const th of [-0.5, 0, 0.6]) {
      const LA = liftField(fA, ptAt(fA, a + (b - a) * 0.1, th)).lift;  // 带内偏尾侧(第g层一侧)
      const LB = liftField(fB, ptAt(fB, a + (b - a) * 0.9, th)).lift;  // 带内偏头侧(第g+1层一侧)
      assert(Math.abs(LA - LB) < 1e-9, `缝${k} θ=${th}: 两层抬升应严格相等 (${LA} vs ${LB})`);
    }
  }
});

test('R2-a 首层贴地: 第一层 head 边【全线】抬升=0 (含斜切线深端 — 此前漏墙的回归)', () => {
  const { regs, basePtsOf, fpOf } = setup();
  const g = terrainOnPlane(regs[0].points, basePtsOf(0), fpOf(0, true));
  const m = g.meta;
  assert(m.frontSegs && m.frontSegs.length >= 1, '首层应识别出前(head)边');
  const to3D = (q) => ({ x: m.pa.x + m.e1.x * q.a + m.e2.x * q.b, y: m.pa.y + m.e1.y * q.a + m.e2.y * q.b, z: m.pa.z + m.e1.z * q.a + m.e2.z * q.b });
  for (const sg of m.frontSegs) for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const q = { a: sg.p.a + (sg.q.a - sg.p.a) * t, b: sg.p.b + (sg.q.b - sg.p.b) * t };
    const L = liftAt(m, to3D(q)).lift;
    assert(Math.abs(L) < 1e-9, `前边上点(t=${t})抬升应为0, 实际 ${L}`);
  }
});

test('R2-b 其余层不贴地: 第二层 liftAt 与原始场逐点一致 (作者纠正的回归)', () => {
  const { regs, basePtsOf, fpOf } = setup();
  const fp1 = fpOf(regs[1].gap);                       // gap≠0 → flushFront=false
  assert(fp1.flushFront === false, '第二层不应启用贴地');
  const g = terrainOnPlane(regs[1].points, basePtsOf(regs[1].gap), fp1);
  const m = g.meta;
  assert(!m.frontSegs, '第二层不应有贴地前边');
  const to3D = (q) => ({ x: m.pa.x + m.e1.x * q.a + m.e1.y * 0 + m.e2.x * q.b, y: m.pa.y + m.e1.y * q.a + m.e2.y * q.b, z: m.pa.z + m.e1.z * q.a + m.e2.z * q.b });
  for (const q of m.hull2) {
    const p = { x: m.pa.x + m.e1.x * q.a + m.e2.x * q.b, y: m.pa.y + m.e1.y * q.a + m.e2.y * q.b, z: m.pa.z + m.e1.z * q.a + m.e2.z * q.b };
    assert(Math.abs(liftAt(m, p).lift - liftField(fp1, p).lift) < 1e-12, '第二层各边界点应=原始场(无贴地)');
  }
});

test('M₁ 近端趋平(深度包络)仍成立; 表面/裙边/越界约束不回退', () => {
  const { mc, regs, basePtsOf, fpOf } = setup();
  const fp0 = fpOf(0, false);
  const nearPt = lerp(mc[0][2], mc[0][3], 0.5);
  assert(Math.abs(liftField(fp0, nearPt).lift) < 0.005, 'M₁ 近端应趋平');
  const g = terrainOnPlane(regs[0].points, basePtsOf(0), fp0);
  let n = normalize(cross(sub(mc[0][3], mc[0][2]), sub(mc[1][3], mc[0][2])));
  if (n.y < 0) n = v(-n.x, -n.y, -n.z);
  const yBase = (x, z) => mc[0][2].y - (n.x * (x - mc[0][2].x) + n.z * (z - mc[0][2].z)) / n.y;
  const used = new Set(g.indices);
  let surf = 0, skirt = 0;
  for (const i of used) {
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1], z = g.positions[i * 3 + 2];
    const lift = y - yBase(x, z);
    if (g.rel[i] >= 0) { surf++; assert(lift >= -1e-4, `表面抬升应≥0, 实际 ${lift}`); }
    else { skirt++; assert(Math.abs(lift) < 1e-4, `裙边底应贴基面, 偏差 ${lift}`); }
  }
  assert(surf > 0 && skirt > 0, '应同时有表面与裙边');
});

test('ampRatio=0 → 全贴基面; pointAt 与 liftAt 一致', () => {
  const { mc, regs, basePtsOf, fpOf } = setup(base, { ampRatio: 0 });
  const g = terrainOnPlane(regs[0].points, basePtsOf(0), fpOf(0));
  let n = normalize(cross(sub(mc[0][3], mc[0][2]), sub(mc[1][3], mc[0][2])));
  if (n.y < 0) n = v(-n.x, -n.y, -n.z);
  const yBase = (x, z) => mc[0][2].y - (n.x * (x - mc[0][2].x) + n.z * (z - mc[0][2].z)) / n.y;
  const used = new Set(g.indices);
  for (const i of used) {
    if (g.rel[i] < 0) continue;
    assert(Math.abs(g.positions[i * 3 + 1] - yBase(g.positions[i * 3], g.positions[i * 3 + 2])) < 1e-4, '幅度0应全贴基面');
  }
  const p = pointAt(g.meta, 0.5, 0.5);
  assert(Math.abs(p.y - yBase(p.x, p.z)) < 1e-9, 'pointAt 幅度0应落基面');
});
