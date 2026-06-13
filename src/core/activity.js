// 活动区 (零 three 依赖): 安全可布景区(黄) + 易穿帮区(红)。输出凸包顶点(点列), 由渲染层成体。
// mc = [...各镜面四角, 出射远端四边形] (来自 frustum.traceFrustum)。
import { v, sub, add, scale, dot, cross, normalize, lerp, dist, planeBasis } from './vec.js';

const planeFrom = (a, b, c) => ({ point: a, normal: normalize(cross(sub(b, a), sub(c, a))) });
export const centroid = (arr) => scale(arr.reduce((s, p) => add(s, p), v(0, 0, 0)), 1 / arr.length); // 点集均值(导出: RENDER 落点/编号也用)
const sd = (pt, pl) => dot(sub(pt, pl.point), pl.normal); // 点到平面的有符号距离

// 平面 ∩ 四边形: 取交线落在四边形内的线段两端点
function planeQuadSeg(plane, quad) {
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4];
    const da = sd(a, plane), db = sd(b, plane);
    if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) pts.push(lerp(a, b, da / (da - db)));
  }
  return pts;
}
// 四边形两条竖直边, 按边长返回 {long, short} (导出: RENDER 脚手架也用, 删掉了 builders 里的同构副本)
export function vEdges(c) {
  const right = [c[0], c[3]], left = [c[1], c[2]];
  return dist(right[0], right[1]) >= dist(left[0], left[1]) ? { long: right, short: left } : { long: left, short: right };
}

// 黄·安全可布景区: 每段 = 前邻锥左壁∩本锥右壁(①) + 后邻锥右壁∩本锥左壁(②) + 复用边
export function safeRegions(mc, seed) {
  const out = [];
  for (let g = 0; g < mc.length - 1; g++) {
    const A = mc[g], B = mc[g + 1];
    const prevLeft = (g === 0) ? planeFrom(seed, A[1], A[2]) : planeFrom(mc[g - 1][1], mc[g - 1][2], A[1]);

    // 末段(B=收尾镜): 后面无邻锥(光在此射出) → 不切后刀, 用整段锥盒只被前邻锥切一刀 → 完整盒子
    if (g === mc.length - 2) {
      let hs = prevLeft;
      if (sd(centroid(B), hs) < 0) hs = { point: hs.point, normal: scale(hs.normal, -1) }; // 法向指向安全侧(收尾镜中心)
      const pts = coneIntersect([...A, ...B], [hs]);
      if (pts.length >= 4) out.push({ gap: g, points: pts });
      continue;
    }

    // 中间段: 前后两面邻锥各切一刀 + 复用竖边 → 8 点盒子
    const rightWall = [A[0], A[3], B[3], B[0]], leftWall = [A[1], A[2], B[2], B[1]];
    const p1 = planeQuadSeg(prevLeft, rightWall);
    const p2 = planeQuadSeg(planeFrom(B[0], B[3], mc[g + 2][0]), leftWall);
    const points = [...p1, ...p2, ...vEdges(A).long, ...vEdges(B).short];
    if (points.length >= 4) out.push({ gap: g, points });
  }
  return out;
}

const E8 = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
function inFace(a, b, c, it) { let n = normalize(cross(sub(b, a), sub(c, a))); if (dot(sub(it, a), n) < 0) n = scale(n, -1); return { point: a, normal: n }; }
const sideWalls = (near, far) => { const it = centroid([...near, ...far]); return [inFace(near[1], near[2], far[2], it), inFace(near[0], near[3], far[3], it)]; }; // 左壁(1,2) 右壁(0,3)
const pyrWalls = (apex, quad) => { const it = centroid([apex, ...quad]); return [inFace(apex, quad[1], quad[2], it), inFace(apex, quad[0], quad[3], it)]; };
// 凸锥 cone(8角) ∩ 各半空间 planes, 返回该凸块顶点
function coneIntersect(cone, planes) {
  const out = [];
  for (const p of cone) if (planes.every((pl) => sd(p, pl) >= -1e-7)) out.push(p);
  for (const [i, j] of E8) {
    const a = cone[i], b = cone[j];
    for (const pl of planes) {
      const da = sd(a, pl), db = sd(b, pl);
      if ((da < 0) !== (db < 0)) { const p = lerp(a, b, da / (da - db)); if (planes.every((q) => sd(p, q) >= -1e-6)) out.push(p); }
    }
  }
  return out;
}
// 红·易穿帮区: 本段锥 被邻锥【左右侧壁】水平切出的重叠(上下高度保持本段锥自身) + Σ→M₁ 锥
export function bugRegions(mc, seed) {
  const out = [];
  for (let g = 0; g < mc.length - 1; g++) {
    const cone = [...mc[g], ...mc[g + 1]];
    const prevW = (g === 0) ? pyrWalls(seed, mc[0]) : sideWalls(mc[g - 1], mc[g]);
    const a = coneIntersect(cone, prevW); if (a.length >= 4) out.push({ gap: g, kind: 'prev', points: a });
    if (g + 2 <= mc.length - 1) { const b = coneIntersect(cone, sideWalls(mc[g + 1], mc[g + 2])); if (b.length >= 4) out.push({ gap: g, kind: 'next', points: b }); }
  }
  out.push({ kind: 'direct', points: [seed, ...mc[0]] }); // Σ→M₁ 锥(布景物落此直接可见)
  return out;
}

// ── 层地面切分 ──────────────────────────────────────────────────────────────
// 地面g 中物理上伸进【下一段光锥】的部分, 会被下一段镜链(错误的链)斜看成一张面(穿帮, 实测逐像素追迹确认);
// 其余部分沿自己的镜链看恰好侧对成线(正确)。锥体 = 6 半空间(上下左右壁+前后截面), 逐面切:
// 每切一刀, 外侧碎片 = 安全(凸, 互不相交), 剩余继续切; 全切完的残余 = 穿帮块。
export const polyArea = (P) => { // 平面多边形面积
  let s = v(0, 0, 0);
  for (let i = 1; i < P.length - 1; i++) s = add(s, cross(sub(P[i], P[0]), sub(P[i + 1], P[0])));
  return Math.sqrt(dot(s, s)) / 2;
};
function splitPolyByPlane(poly, pl) { // 凸多边形 ÷ 平面 → { inside(sd≥0), outside(sd≤0) }
  const EPS = 1e-9, inside = [], outside = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = sd(p, pl), dq = sd(q, pl);
    if (dp >= -EPS) inside.push(p);
    if (dp <= EPS) outside.push(p);
    if ((dp < -EPS && dq > EPS) || (dp > EPS && dq < -EPS)) {
      const x = lerp(p, q, dp / (dp - dq));
      inside.push(x); outside.push(x);
    }
  }
  const ok = (P) => P.length >= 3 && polyArea(P) > 1e-8;
  return { inside: ok(inside) ? inside : null, outside: ok(outside) ? outside : null };
}
// poly = 地面多边形; near/far = 下一段锥的两端截面四边形 (mc[g+1], mc[g+2])。
// 返回 { safe: [凸碎片...], bug: 凸多边形|null }
export function splitFloorByNextCone(poly, near, far) {
  const it = centroid([...near, ...far]);
  const planes = [
    inFace(near[0], near[1], far[1], it), // 上壁
    inFace(near[2], near[3], far[3], it), // 下壁
    inFace(near[1], near[2], far[2], it), // 左壁
    inFace(near[0], near[3], far[3], it), // 右壁
    inFace(near[0], near[1], near[2], it), // 近截面(镜 g+1 所在平面)
    inFace(far[0], far[1], far[2], it),    // 远截面(镜 g+2 所在平面)
  ];
  const safe = [];
  let rest = poly;
  for (const pl of planes) {
    if (!rest) break;
    const r = splitPolyByPlane(rest, pl);
    if (r.outside) safe.push(r.outside);
    rest = r.inside;
  }
  return { safe, bug: rest };
}

// ── 水平地面 ────────────────────────────────────────────────────────────────
// 水平面是 45°镜系统的不变量(镜法线水平, 反射不改高度): 高度 h 的水平面折叠后仍是高度 h 的水平面
// → Σ 看到连续平地; 错链所见与正链重合(自遮盖), 地面无需邻锥裁剪; 各段在镜面处无缝拼接。
// planeSection(points, p0, n): 凸点云 ∩ 任意平面(过 p0 法向 n) → 平面内凸多边形 (不足则 null)。
// 取所有点对连线与平面的交点(含内部对角线交点, 都在截面内), 投到平面 2D 标架做凸包 = 精确截面。
export function planeSection(points, p0, n) {
  const nn = normalize(n);
  const sdp = (p) => dot(sub(p, p0), nn);
  const EPS = 1e-9; // 容差: 贴面点(如"锥体被自己的底面切"时的底角)直接收进截面, 防 1e-17 级抖动把截面掐成一点
  const pts = [];
  for (const p of points) if (Math.abs(sdp(p)) <= EPS) pts.push(p);
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const a = points[i], b = points[j], da = sdp(a), db = sdp(b);
    if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) pts.push(lerp(a, b, da / (da - db)));
  }
  if (pts.length < 3) return null;
  const { e1, e2 } = planeBasis(nn); // 平面内 2D 标架(构造统一在 vec.planeBasis)
  const uv = (p) => ({ x: dot(sub(p, p0), e1), z: dot(sub(p, p0), e2), p });
  // Andrew 单调链 2D 凸包 (标架坐标)
  const s = pts.map(uv).sort((p, q) => p.x - q.x || p.z - q.z);
  const cr = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lo = [], up = [];
  for (const p of s) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...s].reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = [...lo.slice(0, -1), ...up.slice(0, -1)].map((q) => q.p);
  return hull.length >= 3 && polyArea(hull) > 1e-9 ? hull : null;
}

// 水平截面 = planeSection 的 y=h 特例 (保持原 API; 水平地面/人物落点用)
export function groundSection(points, h) {
  return planeSection(points, v(0, h, 0), v(0, 1, 0));
}

// 同层人群编排(确定性·零 three): 由种子+层号生成 N 个人, 分成"结伴(2人)/独行(1人)"小组。
// 组间速度/方向各异→沿环线漂移→相遇; 同组相位贴近→结伴同行。三层种子不同→布置不雷同。
// 返回 [{ group, dir(±1), speed(0.7~1.3 因子), phase(0~1 环线初相) }]。无 Math.random → 可复现、预设稳定、不随重建跳动。
function rng(s) { // mulberry32(整数种子→确定性序列)
  let a = (s | 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function peoplePlan(seed, gap, maxCount = 3) {
  const m = Math.max(1, Math.round(maxCount));
  const rnd = rng((seed * 73856093) ^ ((gap + 1) * 19349663));
  const n = 1 + Math.floor(rnd() * m);                    // 1..m 人(各层不同)
  const people = [];
  let i = 0, group = 0;
  while (i < n) {
    const size = (n - i >= 2 && rnd() < 0.45) ? 2 : 1;     // 结伴(2) 或 独行(1)
    const dir = rnd() < 0.5 ? 1 : -1;
    const speed = 0.7 + rnd() * 0.6;
    const base = rnd();
    for (let k = 0; k < size; k++) people.push({ group, dir, speed, phase: (base + k * 0.05) % 1 }); // 同组贴近=结伴
    i += size; group++;
  }
  return people;
}

// 布景锚点: 每层安全区里放一个布景的位置 + 尺寸。复用 safeRegions, 纯数据零 three。
// 竖向按九宫格错开: 层1=最下 / 层2=中 / 层3=最上 (防近大远小时近层挡住远层); 尺寸≈该层格子大小。
export function sceneryAnchors(mc, seed) {
  const frac = [1 / 6, 1 / 2, 5 / 6]; // 下 / 中 / 上 (各竖三分之一的中心)
  return safeRegions(mc, seed).map((r) => {
    const c = centroid(r.points);
    const ys = r.points.map((p) => p.y);
    const lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo;
    return { layer: r.gap, center: v(c.x, lo + span * frac[r.gap % 3], c.z), size: (span / 3) * 0.4 };
  });
}
