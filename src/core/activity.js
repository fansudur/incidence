// 活动区 (零 three 依赖): 安全可布景区(黄) + 易穿帮区(红)。输出凸包顶点(点列), 由渲染层成体。
// mc = [...各镜面四角, 出射远端四边形] (来自 frustum.traceFrustum)。
import { v, sub, add, scale, dot, cross, normalize, lerp, dist } from './vec.js';

const planeFrom = (a, b, c) => ({ point: a, normal: normalize(cross(sub(b, a), sub(c, a))) });
const centroid = (arr) => scale(arr.reduce((s, p) => add(s, p), v(0, 0, 0)), 1 / arr.length);
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
// 四边形两条竖直边, 按边长返回 {long, short}
function vEdges(c) {
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
