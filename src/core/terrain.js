// 地形 (零 three 依赖): 每层安全区内的噪声起伏地形 —— 以【层底斜面】(视锥下边界) 为基面。
// 设计要点(与作者确认):
//  - 基面 = 该层锥底斜面, 不是水平面。所有层的斜底面同属过 Σ 的边界平面 → Σ 视角下全部塌到画面下边缘
//    → 地形从画面底边长起, 无悬空虚空; 三层呈层层后退的山脊线, 层间空隙(红区)透天。
//  - 形状画在基面的【归一化标架坐标】(u,v) + 固定种子 → 区域伸缩山跟着比例变, 不跳变;
//    幅度 = 层高 × 系数(深层世界自动更大, 正典 W₁<W₂<W₃); 起伏沿【世界竖直】抬升(重力方向)。
//  - 边缘【不衰减】: 噪声全幅度跑到安全区边界, 直接切断 + 垂直裙边(剖面墙) → 场地剖切模型的切割感。
//  - 只发射全顶点在 footprint 内的三角形 → 永不越出安全区(防跨层穿帮)。
import { planeSection } from './activity.js';
import { v, sub, dot, cross, normalize } from './vec.js';

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
function vnoise(u, w, seed) {
  const iu = Math.floor(u), iw = Math.floor(w), fu = smooth(u - iu), fw = smooth(w - iw);
  const a = hash2(iu, iw, seed), b = hash2(iu + 1, iw, seed);
  const c = hash2(iu, iw + 1, seed), d = hash2(iu + 1, iw + 1, seed);
  return (a + (b - a) * fu) * (1 - fw) + (c + (d - c) * fu) * fw;
}
export function fbm(u, w, seed, oct = 4) {
  let acc = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { acc += amp * vnoise(u * f, w * f, seed + o * 101); amp *= 0.5; f *= 2; }
  return acc;
}

// ── 2D 工具 (基面标架坐标 (a,b)) ────────────────────────────────────────────
function insideHull2(a, b, hull2) {
  let sign = 0;
  for (let i = 0; i < hull2.length; i++) {
    const p = hull2[i], q = hull2[(i + 1) % hull2.length];
    const cr = (q.a - p.a) * (b - p.b) - (q.b - p.b) * (a - p.a);
    if (Math.abs(cr) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(cr);
    else if (Math.sign(cr) !== sign) return false;
  }
  return true;
}

// ── 主函数: 安全区点集 + 基面三点 → 地形网格(纯数据) ─────────────────────────
// basePts = [pa,pb,pc] 基面上三点(层底斜面: 本镜下左/下右 + 次镜下右); opts = { seed, ampRatio, waves, res }
// 返回 { positions, indices, rel, meta } | null。rel: 表面顶点=相对高度0..1, 裙边底顶点=-1 (渲染层着色用)。
export function terrainOnPlane(regionPoints, basePts, opts = {}) {
  const { seed = 7, ampRatio = 0.15, waves = 3, res = 64 } = opts;
  const [pa, pb, pc] = basePts;
  let n = normalize(cross(sub(pb, pa), sub(pc, pa)));
  if (n.y < 0) n = v(-n.x, -n.y, -n.z);                      // 法向取朝上侧 (n.y≠0: 层底斜面非竖直)
  const hull = planeSection(regionPoints, pa, n);
  if (!hull) return null;
  const ys = regionPoints.map((p) => p.y);
  const amp = (Math.max(...ys) - Math.min(...ys)) * ampRatio; // 幅度 = 层高 × 系数
  // 基面 2D 标架 (与 planeSection 同构造)
  const ref = Math.abs(n.y) < 0.9 ? v(0, 1, 0) : v(1, 0, 0);
  const e1 = normalize(cross(n, ref)), e2 = cross(n, e1);
  const A = (p) => dot(sub(p, pa), e1), B = (p) => dot(sub(p, pa), e2);
  const hull2 = hull.map((p) => ({ a: A(p), b: B(p) }));
  let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
  for (const q of hull2) { minA = Math.min(minA, q.a); maxA = Math.max(maxA, q.a); minB = Math.min(minB, q.b); maxB = Math.max(maxB, q.b); }
  const sa = maxA - minA || 1e-9, sb = maxB - minB || 1e-9;
  const meta = { pa, n, e1, e2, minA, minB, sa, sb, amp, seed, waves, hull2 };

  // 表面网格: 基面点 + 世界竖直抬升 (全幅度到边, 无衰减)
  const N = res + 1;
  const positions = [], rel = [], inside = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const a = minA + (sa * j) / res, b = minB + (sb * i) / res;
    const idx = i * N + j;
    inside[idx] = insideHull2(a, b, hull2) ? 1 : 0;
    const base = { x: pa.x + e1.x * a + e2.x * b, y: pa.y + e1.y * a + e2.y * b, z: pa.z + e1.z * a + e2.z * b };
    const t = fbm(((a - minA) / sa) * waves, ((b - minB) / sb) * waves, seed);
    const h = inside[idx] ? amp * t : 0;
    positions.push(base.x, base.y + h, base.z);
    rel.push(amp > 1e-12 ? h / amp : 0);
  }
  const tris = [];
  for (let i = 0; i < res; i++) for (let j = 0; j < res; j++) {
    const a0 = i * N + j, b0 = a0 + 1, c0 = a0 + N, d0 = c0 + 1;
    if (inside[a0] && inside[b0] && inside[c0] && inside[d0]) tris.push(a0, c0, b0, b0, c0, d0);
  }
  if (!tris.length) return null;

  // 裙边(剖面墙): 只被一个三角形使用的边 = 切割边缘 → 沿竖直降回基面, 封出剖切面
  const edgeUse = new Map();
  const ek = (i, j) => (i < j ? i * 1048576 + j : j * 1048576 + i);
  for (let t = 0; t < tris.length; t += 3)
    for (const [i, j] of [[tris[t], tris[t + 1]], [tris[t + 1], tris[t + 2]], [tris[t + 2], tris[t]]])
      edgeUse.set(ek(i, j), (edgeUse.get(ek(i, j)) || 0) + 1);
  const baseIdx = new Map(); // 表面顶点 → 其基面投影顶点
  const baseOf = (i) => {
    if (baseIdx.has(i)) return baseIdx.get(i);
    const k = positions.length / 3;
    const x = positions[i * 3], y = positions[i * 3 + 1] - rel[i] * amp, z = positions[i * 3 + 2];
    positions.push(x, y, z); rel.push(-1);
    baseIdx.set(i, k);
    return k;
  };
  const surfTris = tris.length;
  for (let t = 0; t < surfTris; t += 3)
    for (const [i, j] of [[tris[t], tris[t + 1]], [tris[t + 1], tris[t + 2]], [tris[t + 2], tris[t]]])
      if (edgeUse.get(ek(i, j)) === 1) { const bi = baseOf(i), bj = baseOf(j); tris.push(i, j, bj, i, bj, bi); }

  return { positions: new Float32Array(positions), indices: new Uint32Array(tris), rel: new Float32Array(rel), meta };
}

// 表面点采样: 归一化 (u,w)∈0..1 → 基面点+噪声抬升 (人物落点/行走路径用, 与生成同一函数)
export function pointAt(meta, u, w) {
  const a = meta.minA + meta.sa * u, b = meta.minB + meta.sb * w;
  const h = meta.amp * fbm(u * meta.waves, w * meta.waves, meta.seed);
  return v(
    meta.pa.x + meta.e1.x * a + meta.e2.x * b,
    meta.pa.y + meta.e1.y * a + meta.e2.y * b + h,
    meta.pa.z + meta.e1.z * a + meta.e2.z * b,
  );
}
