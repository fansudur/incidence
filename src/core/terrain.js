// 地形 (零 three 依赖): 以层底斜面为基面、定义在展开连续坐标上的全局噪声场。
// 规则(作者逐条确认):
//  R1【对齐衔接·所有接缝默认】: 第 g 层尾边的高度轮廓 = 第 g+1 层头边的起始轮廓(逐点严格相等)。
//     实现 = 接缝冻结带: 深度坐标 σ 在 [g 层尾边最浅处, g+1 层头边最深处] 区间内冻结,
//     两侧按同一 (σ, 角向w) 采样 → 轮廓相等 → 从 Σ 看, 近脊正好把远切口挡在身后, 缝自动隐形。
//     对任意层数(2/3/...N 层)的每道缝自动成立。
//  R2【首层贴地·仅此一处】: 只有第一层面对 M₁ 的那条边贴地收平(它前面没有可衔接的东西);
//     按【到前边界的平面距离】渐入(前边界是斜切线, 按深度渐入会在边界深端漏一堵墙——已踩过的坑)。
//     其余所有边正常起伏, 切割边缘+裙边保留。
//  其它沿用: 基面=层底斜面; 角向 w=横向/半宽(透视不变, 视线匹配的两点同 w); 手性逐折翻转;
//  σ 自相似 log₂ 采样(层间放大, 正典 W₁<W₂<W₃; "场地拉伸"是装置固有属性, Σ 视角被透视抵消)。
import { planeSection } from './activity.js';
import { v, sub, dot, cross, normalize, dist, planeBasis } from './vec.js';

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
function fbm(u, w, seed, oct = 4) { // 仅模块内部使用(liftField); 不导出
  let acc = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { acc += amp * vnoise(u * f, w * f, seed + o * 101); amp *= 0.5; f *= 2; }
  return acc;
}

// 冻结带合并: 相邻缝的带可能重叠(近镜距/非45°角等参数组合实测 10% 可达组合中招),
// 重叠不合并会让 warpS 在重叠区斜率 -1 → σ 非单调 → 地貌回折、R1 接缝相等失效。
// 排序后把重叠/相接区间并成大带(同时冻结两道缝, R1 语义不变)。
export function mergeBands(bands) {
  if (!bands || bands.length < 2) return bands || [];
  const s = [...bands].sort((p, q) => p[0] - q[0]);
  const out = [s[0].slice()];
  for (let i = 1; i < s.length; i++) {
    const last = out[out.length - 1];
    if (s[i][0] <= last[1]) last[1] = Math.max(last[1], s[i][1]);
    else out.push(s[i].slice());
  }
  return out;
}

// ── 两遍构造编排(单一来源: worldView 与测试共用, 防手抄漂移) ──────────────────
// beam = 中心光路点列 [Σ, M₁心, ...]; regions = safeRegions 输出; basePtsOf(g) = 层底斜面三点;
// opts = { hSlope, wSlope, seed, waves, ampRatio, headFrac }。
// 返回 { regs, fpOf(g, flush=g===0) } — frameOf 含手性翻转(横向轴随反射传递), bands 已合并。
export function terrainSetup(beam, regions, basePtsOf, opts) {
  const S = [0];                                                  // 展开累计深度
  for (let i = 1; i < beam.length; i++) S.push(S[i - 1] + dist(beam[i - 1], beam[i]));
  const frameOf = (g) => {
    const dir = normalize(sub(beam[g + 2], beam[g + 1]));
    const par = g % 2 === 0 ? 1 : -1;                             // ★镜子翻手性: side = rot90(dir)×(-1)^g
    return { P0: beam[g + 1], dir, side: { x: -dir.z * par, y: 0, z: dir.x * par }, S0: S[g + 1] };
  };
  const regs = regions.filter((r) => r.gap + 2 < beam.length);    // 防御(当前几何下恒真)
  const infos = regs.map((r) => regionDepthInfo(r.points, basePtsOf(r.gap), frameOf(r.gap)));
  const raw = [];
  for (let i = 0; i < regs.length - 1; i++)
    if (infos[i] && infos[i + 1] && regs[i + 1].gap === regs[i].gap + 1 && infos[i].tailMinS < infos[i + 1].headMaxS)
      raw.push([infos[i].tailMinS, infos[i + 1].headMaxS]);
  const bands = mergeBands(raw);                                  // ★必须合并: 重叠带 σ 非单调 → R1 失效
  // 基线(作者的坡度控制): 每层只有「结尾高度」是自由变量(链式规则: 下一层起点=上一层结尾)。
  // 锚点定义在 σ 域 → 冻结带内 σ 恒定 → 基线在缝两侧自动严格相等(R1 原样保留)。
  // layerEnds[i] = 第 i 层结尾抬升(×层高, 换算成绝对值=×hSlope×σ); 首层起点恒为 0(贴地, 一条线)。
  const baseAnchors = [];
  if (infos[0]) baseAnchors.push([warpS(infos[0].sMin, bands), 0]);
  for (let i = 0; i < regs.length; i++) {
    if (!infos[i]) continue;
    const sEnd = i < regs.length - 1 ? infos[i].tailMinS : infos[i].sMax;
    const sig = warpS(sEnd, bands);
    const rel = (opts.layerEnds && opts.layerEnds[i]) || 0;
    baseAnchors.push([sig, rel * opts.hSlope * sig]);
  }
  const fpBase = { ...opts, rampA: warpS(S[1], bands), rampB: warpS(S[2], bands), bands, baseAnchors };
  return { regs, bands, fpOf: (g, flush = g === 0) => ({ ...fpBase, ...frameOf(g), flushFront: flush }) };
}

// 分段线性基线插值 (σ 域; 锚点单调)
function baseAt(anchors, sig) {
  if (!anchors || !anchors.length) return 0;
  if (sig <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++)
    if (sig <= anchors[i][0]) {
      const [a, va] = anchors[i - 1], [b, vb] = anchors[i];
      return va + (vb - va) * ((sig - a) / Math.max(1e-9, b - a));
    }
  return anchors[anchors.length - 1][1];
}

// ── 接缝冻结带: σ(s) — 带内冻结, 带外平移, 连续单调 ─────────────────────────
export function warpS(s, bands) {
  if (!bands || !bands.length) return s;
  let sig = s;
  for (const [a, b] of bands) {
    if (s >= b) sig -= (b - a);
    else if (s > a) sig -= (s - a);
  }
  return sig;
}

// ── 全局噪声场: 3D 点 → 竖直抬升 (R1 在此实现) ─────────────────────────────
// fp: P0/dir/side/S0(段坐标系, side 含手性翻转) + hSlope/wSlope + rampA/rampB(σ域)
//     + seed/waves/ampRatio + bands(冻结带列表)
export function liftField(fp, p) {
  const r = sub(p, fp.P0);
  const s = fp.S0 + dot(r, fp.dir);                    // 展开深度(跨镜连续)
  if (s <= 1e-6) return { lift: 0, t: 0 };
  const w = (fp.wSlope * s > 1e-9) ? dot(r, fp.side) / (fp.wSlope * s) : 0; // 角向(透视不变, 用原始 s)
  const sig = warpS(s, fp.bands);                      // 冻结带坐标: 缝两侧同 σ → 轮廓相等
  const u = fp.waves * Math.log2(Math.max(sig, 1e-6)); // 自相似: 山随深度等比放大
  const t = fbm(u, fp.waves * w, fp.seed);
  const ramp = smooth(clamp01((sig - fp.rampA) / Math.max(1e-9, fp.rampB - fp.rampA))); // M₁→M₂ 渐起
  // 职责正交(作者发现的冲突修复): 基线(结尾滑块)=地势中线; 噪声零均值(t-0.5)只管围绕中线的摆幅
  // —— 否则噪声均值≈0.5, 调「起伏幅度」会把整体地形抬高。谷底低于锥底则贴底(平地滩), 不挖穿安全区底。
  const noise = fp.ampRatio * fp.hSlope * sig * ramp * (t - 0.5);
  return { lift: Math.max(0, baseAt(fp.baseAnchors, sig) + noise), t };
}

// ── 基面公共构造 (hull/标架/2D凸包) ────────────────────────────────────────
function basis(regionPoints, basePts) {
  const [pa, pb, pc] = basePts;
  let n = normalize(cross(sub(pb, pa), sub(pc, pa)));
  if (n.y < 0) n = v(-n.x, -n.y, -n.z);
  const hull = planeSection(regionPoints, pa, n);
  if (!hull) return null;
  const { e1, e2 } = planeBasis(n);                    // 平面 2D 标架(与 planeSection 同构造, 单一来源在 vec)
  const to2 = (p) => ({ a: dot(sub(p, pa), e1), b: dot(sub(p, pa), e2) });
  return { pa, n, e1, e2, hull, hull2: hull.map(to2) };
}
// 深度方向在基面标架中的单位投影 (regionDepthInfo / 首层贴地共用)
function dirIn2D(dir, e1, e2) {
  const a = dot(dir, e1), b = dot(dir, e2);
  const l = Math.hypot(a, b) || 1;
  return { a: a / l, b: b / l };
}

// 2D 凸包边按朝向分类: 外法线的深度分量 → head(朝浅/朝观者) / tail(朝深) / side
function classifyEdges(hull2, d2) {
  let area = 0;
  for (let i = 0; i < hull2.length; i++) { const p = hull2[i], q = hull2[(i + 1) % hull2.length]; area += p.a * q.b - q.a * p.b; }
  const ccw = area > 0;
  const edges = [];
  for (let i = 0; i < hull2.length; i++) {
    const p = hull2[i], q = hull2[(i + 1) % hull2.length];
    let na = q.b - p.b, nb = -(q.a - p.a);             // 边方向转 -90°
    if (!ccw) { na = -na; nb = -nb; }                  // 统一为外法线
    const len = Math.hypot(na, nb) || 1;
    const dd = (na * d2.a + nb * d2.b) / len;
    edges.push({ p, q, type: dd < -0.3 ? 'head' : dd > 0.3 ? 'tail' : 'side' });
  }
  return edges;
}
const distToSeg = (a, b, s0, s1) => { // 2D 点到线段距离
  const dx = s1.a - s0.a, db = s1.b - s0.b, L2 = dx * dx + db * db || 1e-12;
  const t = clamp01(((a - s0.a) * dx + (b - s0.b) * db) / L2);
  return Math.hypot(s0.a + t * dx - a, s0.b + t * db - b);
};

// ── 层深度信息 (worldView 第一遍: 算冻结带用) ───────────────────────────────
// 返回 { sMin, sMax, tailMinS(尾边最浅), headMaxS(头边最深) } | null
export function regionDepthInfo(regionPoints, basePts, fp) {
  const B = basis(regionPoints, basePts);
  if (!B) return null;
  const sOf = (p) => fp.S0 + dot(sub(p, fp.P0), fp.dir);
  const ss = B.hull.map(sOf);
  const sMin = Math.min(...ss), sMax = Math.max(...ss);
  const edges = classifyEdges(B.hull2, dirIn2D(fp.dir, B.e1, B.e2));
  let tailMinS = sMax, headMaxS = sMin;                // 兜底: 无对应类时退化为端值
  edges.forEach((e, i) => {
    const s1 = ss[i], s2 = ss[(i + 1) % ss.length];    // edges[i] 即 hull2[i]→hull2[i+1], 直接用索引(不靠引用同一性)
    if (e.type === 'tail') tailMinS = Math.min(tailMinS, s1, s2);
    if (e.type === 'head') headMaxS = Math.max(headMaxS, s1, s2);
  });
  return { sMin, sMax, tailMinS, headMaxS };
}

// ── 表面抬升采样 (生成/落点共用): 全局场 × 首层前缘贴地(R2, 仅 flushFront) ──
export function liftAt(meta, basePoint) {
  const L = liftField(meta.fp, basePoint);
  if (!meta.frontSegs || !meta.frontSegs.length) return L;
  const a = dot(sub(basePoint, meta.pa), meta.e1), b = dot(sub(basePoint, meta.pa), meta.e2);
  let d = Infinity;
  for (const sg of meta.frontSegs) d = Math.min(d, distToSeg(a, b, sg.p, sg.q));
  const f = smooth(clamp01(d / meta.flushDist));       // 到前边界的平面距离 → 贴地渐入
  return { lift: L.lift * f, t: L.t };
}

// ── 主函数: 安全区点集 + 基面三点 + 场参数 → 地形网格(纯数据) ────────────────
// 返回 { positions, indices, rel, meta } | null。rel: 表面=噪声相对值0..1, 裙边底=-1。
export function terrainOnPlane(regionPoints, basePts, fp, res = 64) {
  const B = basis(regionPoints, basePts);
  if (!B) return null;
  const { pa, n, e1, e2, hull2 } = B;
  let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
  for (const q of hull2) { minA = Math.min(minA, q.a); maxA = Math.max(maxA, q.a); minB = Math.min(minB, q.b); maxB = Math.max(maxB, q.b); }
  const sa = maxA - minA || 1e-9, sb = maxB - minB || 1e-9;
  const meta = { pa, n, e1, e2, minA, minB, sa, sb, hull2, fp, frontSegs: null, flushDist: 0 };

  if (fp.flushFront) {                                  // R2: 仅首层 — 前(head)边贴地, 按边界距离
    const d2 = dirIn2D(fp.dir, e1, e2);
    meta.frontSegs = classifyEdges(hull2, d2).filter((e) => e.type === 'head');
    const depths = hull2.map((q) => q.a * d2.a + q.b * d2.b);
    const ext = Math.max(...depths) - Math.min(...depths) || 1e-9; // 层深(基面内)
    meta.flushDist = Math.max(1e-9, (fp.headFrac ?? 0.25) * ext);
  }

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
    const L = inside[idx] ? liftAt(meta, base) : { lift: 0, t: 0 };
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

// 行走环线: 安全区 footprint 凸包向质心收缩后(默认 0.55, 稳在安全区内)的周线, 按弧长均匀参数化。
// t∈[0,1) 绕一圈; 返回 { point(表面3D点, 脚贴地形—与生成同一采样), perimeter(周长, 调用方用于匀速) }。
export function loopPoint(meta, t, shrink = 0.55) {
  const h = meta.hull2;
  let ca = 0, cb = 0;
  for (const q of h) { ca += q.a; cb += q.b; }
  ca /= h.length; cb /= h.length;
  const pts = h.map((q) => ({ a: ca + (q.a - ca) * shrink, b: cb + (q.b - cb) * shrink }));
  const segs = [];
  let per = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const L = Math.hypot(q.a - p.a, q.b - p.b);
    segs.push({ p, q, L }); per += L;
  }
  let d = (((t % 1) + 1) % 1) * per;
  for (const sgm of segs) {
    if (d <= sgm.L) {
      const k = sgm.L > 1e-12 ? d / sgm.L : 0;
      const a = sgm.p.a + (sgm.q.a - sgm.p.a) * k, b = sgm.p.b + (sgm.q.b - sgm.p.b) * k;
      const base = {
        x: meta.pa.x + meta.e1.x * a + meta.e2.x * b,
        y: meta.pa.y + meta.e1.y * a + meta.e2.y * b,
        z: meta.pa.z + meta.e1.z * a + meta.e2.z * b,
      };
      return { point: v(base.x, base.y + liftAt(meta, base).lift, base.z), perimeter: per };
    }
    d -= sgm.L;
  }
  return { point: pointAt(meta, 0.5, 0.5), perimeter: per }; // 数值兜底(浮点累计误差走到段外)
}

// 参数坐标 (a,b)(基面标架, 单位=世界距离) → 地表 3D 点(贴地形)。游走在 (a,b) 里推进, 每帧调它落地。
export function surfaceAt(meta, a, b) {
  const base = {
    x: meta.pa.x + meta.e1.x * a + meta.e2.x * b,
    y: meta.pa.y + meta.e1.y * a + meta.e2.y * b,
    z: meta.pa.z + meta.e1.z * a + meta.e2.z * b,
  };
  return v(base.x, base.y + liftAt(meta, base).lift, base.z);
}

// 安全区内部随机点(确定性: 由 3 个 [0,1) 随机数定)。收缩凸包→质心三角扇→按面积权重选三角→重心采样
// → 始终落在安全区内(无规则游走的航点用)。返回 { point(地表3D), a, b(参数坐标) }。
export function hullPoint(meta, r1, r2, r3, shrink = 0.55) {
  const h = meta.hull2;
  let ca = 0, cb = 0;
  for (const q of h) { ca += q.a; cb += q.b; }
  ca /= h.length; cb /= h.length;
  const pts = h.map((q) => ({ a: ca + (q.a - ca) * shrink, b: cb + (q.b - cb) * shrink }));
  const tris = []; let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const area = Math.abs((p.a - ca) * (q.b - cb) - (q.a - ca) * (p.b - cb)) / 2;
    tris.push({ p, q, area }); total += area;
  }
  let pick = (((r1 % 1) + 1) % 1) * total, tri = tris[tris.length - 1];
  for (const t of tris) { if (pick <= t.area) { tri = t; break; } pick -= t.area; }
  let s = (((r2 % 1) + 1) % 1), u = (((r3 % 1) + 1) % 1);
  if (s + u > 1) { s = 1 - s; u = 1 - u; }                 // 折回三角形内 → 均匀重心采样
  const a = ca + s * (tri.p.a - ca) + u * (tri.q.a - ca);
  const b = cb + s * (tri.p.b - cb) + u * (tri.q.b - cb);
  return { point: surfaceAt(meta, a, b), a, b };
}

// 表面点采样: 归一化 (u,w)∈0..1 → 基面点 + 抬升 (人物落点/行走路径用, 与生成同一函数)
export function pointAt(meta, u, w) {
  const a = meta.minA + meta.sa * u, b = meta.minB + meta.sb * w;
  const base = {
    x: meta.pa.x + meta.e1.x * a + meta.e2.x * b,
    y: meta.pa.y + meta.e1.y * a + meta.e2.y * b,
    z: meta.pa.z + meta.e1.z * a + meta.e2.z * b,
  };
  return v(base.x, base.y + liftAt(meta, base).lift, base.z);
}
