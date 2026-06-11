// 锁住地形: 确定性(同种子同山)、安全区约束(永不越界)、随参数伸缩、幅度=层高×系数。
import { test, assert } from './harness.js';
import { traceFrustum } from '../src/core/frustum.js';
import { safeRegions, groundSection, polyArea } from '../src/core/activity.js';
import { terrainGrid, heightAt } from '../src/core/terrain.js';
import { v } from '../src/core/vec.js';

const base = { mAngle: [45, 45, 45], mDist: [550, 359, 634], layerCount: 3, fDist: 170, frameW: 60, frameH: 40 };
const S = v(0, 0, 0);
const H = -0.3;
function region0(p = base) { const r = traceFrustum(p); const mc = r.endMirror ? [...r.mirrors, r.endMirror] : r.mirrors; return safeRegions(mc, S)[0]; }

test('地形: 同种子两次生成逐字节一致 (确定性, 无 Math.random)', () => {
  const r = region0();
  const a = terrainGrid(r.points, H, { seed: 7 }), b = terrainGrid(r.points, H, { seed: 7 });
  assert(a && b, '应能生成');
  assert(a.positions.length === b.positions.length && a.positions.every((x, i) => x === b.positions[i]), '同种子应逐值一致');
  const c = terrainGrid(r.points, H, { seed: 8 });
  assert(c.positions.some((x, i) => x !== a.positions[i]), '换种子应得到不同地貌');
});

test('地形: 所有被索引顶点都在安全区 footprint 内, 高度在 [h, h+amp]', () => {
  const r = region0();
  const g = terrainGrid(r.points, H, { seed: 7, ampRatio: 0.2 });
  const hull = groundSection(r.points, H);
  const inHull = (x, z) => { // 凸包内(同侧)
    let sign = 0;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      const cr = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
      if (Math.abs(cr) < 1e-9) continue;
      if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false;
    }
    return true;
  };
  const used = new Set(g.indices);
  for (const i of used) {
    const x = g.positions[i * 3], y = g.positions[i * 3 + 1], z = g.positions[i * 3 + 2];
    assert(inHull(x, z), `顶点(${x.toFixed(2)},${z.toFixed(2)})应在安全区内`);
    assert(y >= H - 1e-6 && y <= H + g.meta.amp + 1e-6, `高度 ${y} 应在 [h, h+amp]`); // 1e-6: positions 是 Float32
  }
  assert(g.meta.amp > 0, '幅度应>0 (=层高×系数)');
});

test('地形: 镜面距离改变 → footprint 伸缩, 山随归一化坐标跟着变 (不失效不报错)', () => {
  const far = { ...base, mDist: [550, 600, 634] };       // M₁→M₂ 拉远
  const g1 = terrainGrid(region0().points, H, { seed: 7 });
  const g2 = terrainGrid(region0(far).points, H, { seed: 7 });
  assert(g1 && g2, '两组参数都应能生成');
  const spanX = (g) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < g.positions.length; i += 3) { lo = Math.min(lo, g.positions[i]); hi = Math.max(hi, g.positions[i]); } return hi - lo; };
  assert(Math.abs(spanX(g2) - spanX(g1)) > 0.1, '区域变深后地形范围应明显不同');
  // 归一化同位点的相对地貌一致: 两块地形各自中心点的 fbm 值相同(同种子同 (u,v))
  const mid = (g) => heightAt(g.meta, g.meta.minX + g.meta.sx / 2, g.meta.minZ + g.meta.sz / 2) - g.meta.h;
  const r1 = mid(g1) / g1.meta.amp, r2 = mid(g2) / g2.meta.amp;
  assert(Math.abs(r1 - r2) < 0.25, `中心点相对高度应接近 (${r1.toFixed(3)} vs ${r2.toFixed(3)}) — 山不跳变`);
});

test('地形: ampRatio=0 → 退化为平面(全在 h); footprint 面积>0', () => {
  const r = region0();
  const g = terrainGrid(r.points, H, { seed: 7, ampRatio: 0 });
  const used = new Set(g.indices);
  for (const i of used) assert(Math.abs(g.positions[i * 3 + 1] - H) < 1e-6, '幅度0应全平'); // 1e-6: Float32 存 -0.3 有 ~1e-8 舍入
  assert(polyArea(groundSection(r.points, H)) > 0, 'footprint 应有面积');
});
