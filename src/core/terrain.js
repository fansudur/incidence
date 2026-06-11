// 地形 (零 three 依赖): 以【层底斜面】为基面、定义在【展开连续坐标】上的全局噪声场。
// 设计要点(作者逐步确认):
//  - 基面 = 层锥底斜面 → Σ 视角塌到画面下边缘, 地形从画面底边长起、无悬空。
//  - 噪声场画在展开坐标 (s=沿光路累计深度, w=横向/半宽) 上, 三层共用同一个场:
//    45° 反射对镜面平面内的点保持 s/w 分量不变 → 相邻层在镜面接缝处采样同一噪声值,
//    高度【严格相等】→ 三块地形透过折叠读成一片连续大地 (作者的"视觉连接成整体")。
//  - 深度包络 ramp(s): M₁ 处为 0(最前景趋平, 不挡后层), 到 M₂ 平滑升满 (作者的"面对镜1最低")。
//  - 自相似尺度: 噪声沿 log₂(s) 采样 → 山的尺寸随深度等比放大 (正典 W₁<W₂<W₃);
//    幅度 = 系数 × 局部锥高(∝s) × ramp → 深层自适应更大。
//  - 边缘不衰减: 全幅度到安全区边界直接切断 + 垂直裙边(剖切模型感); 只发射全内三角 → 不越界
//    (侧壁均为竖直平面, 竖直抬升不可能横向出界)。
import { planeSection } from './activity.js';
import { v, sub, dot, cross, normalize } from './vec.js';

// ── 确定性噪声 (无 Math.random) ─────────────────────────────────────────────
function hash2(ix, iz, seed) {
  let h = Math.imul((ix | 0) ^ 0x9E3779B9, 0x85EBCA6B)
        ^ Math.imul((iz | 0) ^ 0xC2B2AE35, 0x27D4EB2F)
        ^ Math.imul((seed | 0) + 0x165667B1, 0x9E3779B1);
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
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

// ── 全局噪声场: 3D 点 → 竖直抬升 ───────────────────────────────────────────
// fp(每层一份, 场参数全局一致): P0=该段光路起点(镜心), dir=该段光路方向(水平单位), side=水平横向单位,
//   S0=展开累计深度(到 P0), hSlope=锥高/深度(frameH/fDist), wSlope=半宽/深度(frameW/2/fDist),
//   rampA/rampB=包络起止深度(M₁/M₂ 处), seed/waves/ampRatio。
// 反射不变性: 镜面平面内的点对相邻两段 fp 算出同一 (s,lat) → 接缝高度严格相等。
export function liftField(fp, p) {
  const r = sub(p, fp.P0);
  const s = fp.S0 + dot(r, fp.dir);                    // 展开累计深度 (跨镜连续)
  if (s <= 1e-6) return { lift: 0, t: 0 };
  const w = (fp.wSlope * s > 1e-9) ? dot(r, fp.side) / (fp.wSlope * s) : 0; // 横向/半宽 ∈ ~[-1,1]
  const u = fp.waves * Math.log2(s);                   // 自相似: 山随深度等比放大
  const t = fbm(u, fp.waves * w, fp.seed);
  const ramp = smooth(clamp01((s - fp.rampA) / Math.max(1e-9, fp.rampB - fp.rampA))); // M₁→M₂ 渐起
  return { lift: fp.ampRatio * fp.hSlope * s * ramp * t, t };
}

// ── 主函数: 安全区点集 + 基面三点 + 场参数 → 地形网格(纯数据) ────────────────
// 返回 { positions, indices, rel, meta } | null。rel: 表面顶点=噪声相对值0..1, 裙边底=-1 (着色用)。
export function terrainOnPlane(regionPoints, basePts, fp, res = 64) {
  const [pa, pb, pc] = basePts;
  let n = normalize(cross(sub(pb, pa), sub(pc, pa)));
  if (n.y < 0) n = v(-n.x, -n.y, -n.z);
  const hull = planeSection(regionPoints, pa, n);
  if (!hull) return null;
  const ref = Math.abs(n.y) < 0.9 ? v(0, 1, 0) : v(1, 0, 0);
  const e1 = normalize(cross(n, ref)), e2 = cross(n, e1);
  const A = (p) => dot(sub(p, pa), e1), B = (p) => dot(sub(p, pa), e2);
  const hull2 = hull.map((p) => ({ a: A(p), b: B(p) }));
  let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
  for (const q of hull2) { minA = Math.min(minA, q.a); maxA = Math.max(maxA, q.a); minB = Math.min(minB, q.b); maxB = Math.max(maxB, q.b); }
  const sa = maxA - minA || 1e-9, sb = maxB - minB || 1e-9;
  const meta = { pa, n, e1, e2, minA, minB, sa, sb, hull2, fp };

  const inside2 = (a, b) => {
    let sign = 0;
    for (let i = 0; i < hull2.length; i++) {
      const p = hull2[i], q = hull2[(i + 1) % hull2.length];
      const cr = (q.a - p.a) * (b - p.b) - (q.b - p.b) * (a - p.a);
      if (Math.abs(cr) < 1e-12) continue;
      if (sign === 0) sign = Math.sign(cr);
      else if (Math.sign(cr) !== sign) return false;
    }
    return true;
  };

  const N = res + 1;
  const positions = [], rel = [], lifts = [], inside = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const a = minA + (sa * j) / res, b = minB + (sb * i) / res;
    const idx = i * N + j;
    inside[idx] = inside2(a, b) ? 1 : 0;
    const base = { x: pa.x + e1.x * a + e2.x * b, y: pa.y + e1.y * a + e2.y * b, z: pa.z + e1.z * a + e2.z * b };
    const L = inside[idx] ? liftField(fp, base) : { lift: 0, t: 0 };
    positions.push(base.x, base.y + L.lift, base.z);
    rel.push(L.t);
    lifts.push(L.lift);
  }
  const tris = [];
  for (let i = 0; i < res; i++) for (let j = 0; j < res; j++) {
    const a0 = i * N + j, b0 = a0 + 1, c0 = a0 + N, d0 = c0 + 1;
    if (inside[a0] && inside[b0] && inside[c0] && inside[d0]) tris.push(a0, c0, b0, b0, c0, d0);
  }
  if (!tris.length) return null;

  // 裙边(剖面墙): 仅被一个三角形使用的边 = 切割边缘 → 竖直降回基面
  const edgeUse = new Map();
  const ek = (i, j) => (i < j ? i * 1048576 + j : j * 1048576 + i);
  for (let t = 0; t < tris.length; t += 3)
    for (const [i, j] of [[tris[t], tris[t + 1]], [tris[t + 1], tris[t + 2]], [tris[t + 2], tris[t]]])
      edgeUse.set(ek(i, j), (edgeUse.get(ek(i, j)) || 0) + 1);
  const baseIdx = new Map();
  const baseOf = (i) => {
    if (baseIdx.has(i)) return baseIdx.get(i);
    const k = positions.length / 3;
    positions.push(positions[i * 3], positions[i * 3 + 1] - lifts[i], positions[i * 3 + 2]);
    rel.push(-1); lifts.push(0);
    baseIdx.set(i, k);
    return k;
  };
  const surfTris = tris.length;
  for (let t = 0; t < surfTris; t += 3)
    for (const [i, j] of [[tris[t], tris[t + 1]], [tris[t + 1], tris[t + 2]], [tris[t + 2], tris[t]]])
      if (edgeUse.get(ek(i, j)) === 1) { const bi = baseOf(i), bj = baseOf(j); tris.push(i, j, bj, i, bj, bi); }

  return { positions: new Float32Array(positions), indices: new Uint32Array(tris), rel: new Float32Array(rel), meta };
}

// 表面点采样: 归一化 (u,w)∈0..1 → 基面点 + 全局场抬升 (人物落点/行走路径用, 与生成同一函数)
export function pointAt(meta, u, w) {
  const a = meta.minA + meta.sa * u, b = meta.minB + meta.sb * w;
  const base = {
    x: meta.pa.x + meta.e1.x * a + meta.e2.x * b,
    y: meta.pa.y + meta.e1.y * a + meta.e2.y * b,
    z: meta.pa.z + meta.e1.z * a + meta.e2.z * b,
  };
  return v(base.x, base.y + liftField(meta.fp, base).lift, base.z);
}
