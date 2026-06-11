// 地形 (零 three 依赖): 每层安全区内的噪声起伏地形。
// 设计要点(与作者确认过的机制):
//  - 地形 = 安全区的函数: footprint(安全区在地面高度的水平截面) 每次从当前几何重算, 参数动它就动。
//  - 形状画在【归一化坐标】(u,v∈0..1)里 + 固定种子 → 区域伸缩时山跟着按比例伸缩(层间相似放大),
//    但"哪里有山"不变、不跳变; 幅度=层高×系数 → 深层世界自动更大(正典 W₁<W₂<W₃)。
//  - 边缘衰减到 0 + 只发射全部顶点都在 footprint 内的三角形 → 地形永不越出安全区(防跨层穿帮)。
//  - 无图片贴图: 着色由渲染层按海拔做顶点色, 无失真问题。
import { groundSection } from './activity.js';

// ── 确定性噪声 (无 Math.random; 种子+整点 → [0,1)) ───────────────────────────
function hash2(ix, iz, seed) {
  let h = Math.imul((ix | 0) ^ 0x9E3779B9, 0x85EBCA6B)
        ^ Math.imul((iz | 0) ^ 0xC2B2AE35, 0x27D4EB2F)
        ^ Math.imul((seed | 0) + 0x165667B1, 0x9E3779B1);
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(u, v, seed) { // 2D value noise: 整点哈希 + 双线性平滑插值
  const iu = Math.floor(u), iv = Math.floor(v), fu = smooth(u - iu), fv = smooth(v - iv);
  const a = hash2(iu, iv, seed), b = hash2(iu + 1, iv, seed);
  const c = hash2(iu, iv + 1, seed), d = hash2(iu + 1, iv + 1, seed);
  return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
}
export function fbm(u, v, seed, oct = 4) { // 分形叠加, 值域≈[0,1)
  let acc = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { acc += amp * vnoise(u * f, v * f, seed + o * 101); amp *= 0.5; f *= 2; }
  return acc;
}

// ── 2D 工具 ((x,z) 平面) ─────────────────────────────────────────────────────
function insideHull(x, z, hull) { // 凸多边形内 (对各边同侧; 容忍任一环向)
  let sign = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const cr = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (Math.abs(cr) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(cr);
    else if (Math.sign(cr) !== sign) return false;
  }
  return true;
}
function edgeDist(x, z, hull) { // 到多边形边界的最近距离
  let best = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const L2 = dx * dx + dz * dz || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    const px = a.x + t * dx - x, pz = a.z + t * dz - z;
    best = Math.min(best, Math.hypot(px, pz));
  }
  return best;
}

// ── 主函数: 安全区点集 → 地形网格(纯数据) ──────────────────────────────────
// regionPoints = safeRegions 单层点集; h = 地面高度; opts = { seed, ampRatio(×层高), waves(波数), res(分段) }
// 返回 { positions: Float32Array, indices: Uint32Array, meta } | null。meta 供 heightAt 采样。
export function terrainGrid(regionPoints, h, opts = {}) {
  const { seed = 7, ampRatio = 0.15, waves = 3, res = 56 } = opts;
  const hull = groundSection(regionPoints, h);
  if (!hull) return null;
  const ys = regionPoints.map((p) => p.y);
  const span = Math.max(...ys) - Math.min(...ys);            // 层高 → 幅度基准(层间相似放大)
  const amp = span * ampRatio;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of hull) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const sx = maxX - minX || 1e-9, sz = maxZ - minZ || 1e-9;
  const fadeW = 0.14 * Math.min(sx, sz);                     // 边缘衰减带宽
  const meta = { h, amp, seed, waves, minX, minZ, sx, sz, hull, fadeW };

  const N = res + 1;
  const positions = new Float32Array(N * N * 3);
  const inside = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = minX + (sx * j) / res, z = minZ + (sz * i) / res;
    const idx = i * N + j;
    const ok = insideHull(x, z, hull);
    inside[idx] = ok ? 1 : 0;
    positions[idx * 3] = x;
    positions[idx * 3 + 1] = ok ? heightAt(meta, x, z) : h;
    positions[idx * 3 + 2] = z;
  }
  const tris = [];
  for (let i = 0; i < res; i++) for (let j = 0; j < res; j++) {
    const a = i * N + j, b = a + 1, c = a + N, d = c + 1;
    if (inside[a] && inside[b] && inside[c] && inside[d]) tris.push(a, c, b, b, c, d); // 全内才发射 → 不越界
  }
  if (!tris.length) return null;
  return { positions, indices: new Uint32Array(tris), meta };
}

// 地形高度采样 (人物/布景落点用): 与生成同一套函数, 保证脚贴地
export function heightAt(meta, x, z) {
  const u = (x - meta.minX) / meta.sx, v = (z - meta.minZ) / meta.sz;     // 归一化坐标(形状随区域伸缩)
  const fade = smooth(Math.max(0, Math.min(1, edgeDist(x, z, meta.hull) / meta.fadeW))); // 边缘→0
  return meta.h + meta.amp * fbm(u * meta.waves, v * meta.waves, meta.seed) * fade;
}
