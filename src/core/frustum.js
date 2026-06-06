// 视锥追迹 (零 three 依赖): 参数 → 各镜面四角 + 中心光路 + 四条角光线 + 出射远端 + 穿帮层。
// 这是装置几何的主干: Σ 发出穿过 F 四角的 4 条光线, 逐面 45° 镜面反射; 镜面 = 视锥在该处的截面。
import { v, sub, add, scale, normalize, lerp } from './vec.js';
import { mirrorNormal, reflectDir, rayPlane } from './mirror.js';

export const U = 100; // 内部渲染单位 = 100 原始单位 (纯比例缩放, 形状不变)

export function traceFrustum(params) {
  const fd = params.fDist / U, hw = params.frameW / 2 / U, hh = params.frameH / 2 / U;
  const md = params.mDist.map((x) => x / U);
  const nLayers = Math.round(params.layerCount);

  const seed = v(0, 0, 0);
  const frame = [v(fd, hh, hw), v(fd, hh, -hw), v(fd, -hh, -hw), v(fd, -hh, hw)]; // F 四角 (0上右 1上左 2下左 3下右)

  let rays = frame.map((c) => ({ o: seed, d: normalize(sub(c, seed)) }));
  let cO = seed, cD = v(1, 0, 0);
  const beam = [seed];
  const frustum = rays.map((r) => [r.o]);
  const mirrors = [];
  const planes = []; // 每面镜的 (中心 p, 法向 n) — 供九宫格网格追迹复用
  let bugLayer = 0;

  for (let i = 0; i < nLayers; i++) {
    const P = add(cO, scale(cD, md[i]));      // 镜心 (中心光线落点)
    const n = mirrorNormal(params.mAngle[i]); // 该镜面法向
    const corners = [];
    let ok = true;
    for (let j = 0; j < 4; j++) {
      const hit = rayPlane(rays[j].o, rays[j].d, P, n);
      if (!hit) { bugLayer = i + 1; ok = false; break; } // 角光线越过镜面 → 穿帮
      corners.push(hit);
    }
    if (!ok) break;
    mirrors.push(corners);
    planes.push({ p: P, n });
    beam.push(P);
    for (let j = 0; j < 4; j++) frustum[j].push(corners[j]);
    rays = corners.map((c, j) => ({ o: c, d: reflectDir(rays[j].d, n) }));
    cD = reflectDir(cD, n); cO = P;
  }

  // 收尾镜 M_last₊₁ (终结镜): 沿当前光路再走 mDistEnd, 同 45° 规律真追迹一面。
  // 作用 = 给最后一段活动区一面"后墙", 让它闭合成盒子 (默认隐藏, 见 render/worldView)。
  let endMirror = null;
  if (!bugLayer && mirrors.length >= 1) {
    const Pe = add(cO, scale(cD, (params.mDistEnd ?? 880) / U)); // 终结镜中心
    const ne = mirrorNormal(params.mEndAngle ?? 45);              // 收尾镜角度(可调; 45=续折叠, 改角=改封口朝向)
    const ec = [];
    let ok = true;
    for (let j = 0; j < 4; j++) {
      const hit = rayPlane(rays[j].o, rays[j].d, Pe, ne);
      if (!hit) { ok = false; break; }                            // 角光线打不到 → 不闭合
      ec.push(hit);
    }
    if (ok) {
      endMirror = ec;
      planes.push({ p: Pe, n: ne });
      beam.push(Pe);                                              // 中心光路: Σ + N 镜心 + 终结镜心
      for (let j = 0; j < 4; j++) frustum[j].push(ec[j]);
    }
  }

  return { seed, frame, mirrors, beam, frustum, endMirror, planes, bugLayer };
}

// 九宫格投影: 把取景框 F 切成 nCells×nCells 格, 每个网格点从 Σ 发线、按 planes 逐面反射,
// 返回各截面网格点 [F网格, 第1面, 第2面, ...], 每截面 (nCells+1)² 个点 (行主序: i 行上→下, j 列左→右)。
// 用途(render): 每面镜截面画 nCells×nCells 网格 + 纵向连成"视线管" → 看每层布景范围与跨层遮挡。
export function projectGrid(seed, frame, planes, nCells = 3) {
  const N = nCells + 1;
  const framePt = (i, j) => {
    const top = lerp(frame[1], frame[0], j / nCells); // 上左 → 上右
    const bot = lerp(frame[2], frame[3], j / nCells); // 下左 → 下右
    return lerp(top, bot, i / nCells);
  };
  const sections = [[]];                       // sections[0] = F 上的网格
  const rays = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const g = framePt(i, j);
    sections[0].push(g);
    rays.push({ o: seed, d: normalize(sub(g, seed)) });
  }
  for (const pl of planes) {
    const cs = [];
    for (let r = 0; r < rays.length; r++) {
      const hit = rayPlane(rays[r].o, rays[r].d, pl.p, pl.n);
      if (!hit) return sections;               // 网格线越界 → 截止(返回已成的截面)
      cs.push(hit);
      rays[r] = { o: hit, d: reflectDir(rays[r].d, pl.n) };
    }
    sections.push(cs);
  }
  return sections;
}
