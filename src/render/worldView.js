// 建世界 (RENDER 层): 调 CORE 拿纯几何数据 → 造 three 物体。
// buildAllWorlds(params) → { group, bugLayer }; 把"是否穿帮"作为返回值上抛, 不再用共享模块变量。
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { traceFrustum, projectGrid, U } from '../core/frustum.js';
import { safeRegions, bugRegions, sceneryAnchors, splitFloorByNextCone, groundSection, planeSection, centroid, vEdges, peoplePlan } from '../core/activity.js';
import { terrainOnPlane, liftAt, terrainSetup, hullPoint } from '../core/terrain.js';
import { makeLabel, buildSphere, buildFrustumSolid, buildMirror, buildProjGrid, buildScenery, buildWall, buildReflector, buildFloor, buildGround, buildTerrain, buildFigure, buildZoneSun } from './builders.js';
import { SAFE_COLOR, SAFE_EDGE_COLOR, BUG_COLOR, BUG_EDGE_COLOR } from './materials.js';

// 整色混合 (a→b 按 t): 地形按层着色 / 人物按层染色 共用
const mixHex = (a, b, t) => {
  const f = (sh) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return (f(16) << 16) | (f(8) << 8) | f(0);
};
const LAYER_TINT = [0xff6a6a, 0x6aff8a, 0x6ab4ff]; // 红/绿/蓝 层色(布景块/地形着色/人物染色 同一来源)

// 单世界: 视锥追迹 (调 CORE 拿纯数据 → 渲染)。返回 { root, bug, foot }。
// runtime.fixedFoot: 人物钉在固定世界坐标(结构性穿越演示) — 人不动, 拖参数让分层扫过他。
function buildSingleWorld(params, base = 0, runtime = {}) {
  const root = new THREE.Group();
  const nLayers = Math.round(params.layerCount);
  const md = params.mDist.map(v => v / U);
  const refSize = (md[0] + md[1] + md[2]) || 5;
  const sR = refSize * 0.012; // 视点球半径随尺度
  const V3 = p => new THREE.Vector3(p.x, p.y, p.z); // CORE 纯点 → THREE.Vector3

  // ── CORE: 纯几何(零 three 依赖) ──
  const data = traceFrustum(params);
  const bug = data.bugLayer;
  const S = V3(data.seed);
  const Fc = data.frame.map(V3);
  const mirrorsV = data.mirrors.map(q => q.map(V3));
  const beam = data.beam.map(V3);
  const fpaths = data.frustum.map(fp => fp.map(V3));
  const endV = data.endMirror ? data.endMirror.map(V3) : null;                       // 收尾镜(终结镜)四角
  const mc = endV ? [...mirrorsV, endV] : [...mirrorsV];                              // 渲染/编号用(含收尾镜)
  const mcPlain = data.endMirror ? [...data.mirrors, data.endMirror] : data.mirrors; // CORE 活动区用(纯点)

  // ── 渲染 ──
  if (params.showSeed) {
    const sp = buildSphere(S, 1, null, sR); sp.name = 'seedSphere'; root.add(sp); // 命名供 Σ 观影位时隐藏
    if (!params.showWall) root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([...Fc, Fc[0]]), new THREE.LineBasicMaterial({ color: 0x6b7686 }))); // 取景框描边(半透明白填充已去; 有墙时墙的洞即框, 不再画)
  }
  if (params.showWall) root.add(buildWall(Fc, params.wallSize, 0x111418)); // 观影墙: 暗墙挖出框大小的洞(= 取景框)

  const useReflector = params.realMirror && !params.pathTrace; // PT 模式用金属网格(路径追踪器能追), 不用 Reflector
  if (params.showWorlds) for (let i = 0; i < mirrorsV.length; i++) { // 镜面四边形(随 expand 逐层显)
    const local = THREE.MathUtils.clamp(params.expand * nLayers - i, 0, 1);
    if (useReflector) root.add(buildReflector(mirrorsV[i]));        // 实时反射(Reflector)
    else if (local > 0.001) root.add(buildMirror(mirrorsV[i], params.pathTrace ? 1 : 0.6 * local)); // 银色金属镜(PT 当镜面追)
  }
  if (params.showWorlds && params.showEndMirror && endV) root.add(useReflector ? buildReflector(endV) : buildMirror(endV, params.pathTrace ? 1 : 0.6)); // 收尾镜
  if (params.showBeam) root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(beam),
    new THREE.LineBasicMaterial({ color: 0xffd070 })));
  if (params.showFrustum) for (const fp of fpaths) root.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(fp), new THREE.LineBasicMaterial({ color: 0x3a6a8a })));

  // 九宫格视线投影: F 切 3×3 → 在每面镜截面画网格 + 纵向视线管 (读每层布景范围 / 跨层遮挡)
  if (params.showGrid && !bug && data.planes.length) {
    const secs = projectGrid(data.seed, data.frame, data.planes, 3).map(cs => cs.map(V3));
    root.add(buildProjGrid(secs, 4, 0x4a90d0));
  }

  // 层地面(视锥下边界, 倾斜): 每段锥的底面四边形。沿本层镜链看恰好侧对成线;
  // 但其"高于下一段地面平面"的部分物理上伸进下一段光锥 → 被错误镜链斜看成面(=红区理论的穿帮)。
  // 故切成两份: 安全段(showFloor) + 穿帮段(showFloorBug, 红色, 默认隐藏备用)。末段无下一平面, 不切。
  if ((params.showFloor || params.showFloorBug) && !bug && mc.length >= 2) {
    const floorCol = [0xff6a6a, 0x6aff8a, 0x6ab4ff];
    for (let gp = 0; gp < mc.length - 1; gp++) {
      const quad = [mc[gp][2], mc[gp][3], mc[gp + 1][3], mc[gp + 1][2]];
      if (gp + 2 < mc.length) {
        const s = splitFloorByNextCone(quad, mc[gp + 1], mc[gp + 2]);
        if (params.showFloor) for (const frag of s.safe) root.add(buildFloor(frag, floorCol[gp % 3]));
        if (params.showFloorBug && s.bug) root.add(buildFloor(s.bug, BUG_COLOR));
      } else if (params.showFloor) root.add(buildFloor(quad, floorCol[gp % 3]));
    }
  }

  // 测试布景: 每层活动区中央放红/绿/蓝标记; 拖拽编辑过的块用 runtime.placed 存档位置(重建后仍生效)
  if (params.showScenery && !bug && mc.length >= 2) {
    const sc = buildScenery(sceneryAnchors(mcPlain, data.seed), refSize);
    for (const ch of sc.children) {
      const p = runtime.placed?.[ch.userData.dragId];
      if (p) ch.position.set(p.x, p.y, p.z);
    }
    root.add(sc);
  }

  // 水平地面 (真实世界地): 每段光锥 ∩ 平面 y=groundY → 水平多边形, 镜面处无缝拼接 (水平面=镜系统不变量)
  const gY = (params.groundY ?? -30) / U;
  if (params.showGround && !bug && mcPlain.length >= 1) {
    const chain = [data.frame, ...mcPlain];                       // F → M1 → … → 末镜, 逐段
    for (let i = 0; i < chain.length - 1; i++) {
      const sec = groundSection([...chain[i], ...chain[i + 1]], gY);
      if (sec) root.add(buildGround(sec, 0x8a8378));
    }
  }

  // 地形 (起伏·按层·安全区内): 基面=层底斜面(Σ视角塌到画面下边缘, 无悬空); 噪声场画在【展开连续坐标】
  // (s=沿光路累计深度, w=横向/半宽)上, 三层共用 → 相邻层在镜面接缝处高度严格相等(反射不变性), 读成一片连续大地;
  // 深度包络 M₁→M₂ 渐起(最前景趋平不挡后层); 边缘全幅度切断+垂直裙边(剖切模型感)
  const terrains = []; // [ {gap, grid} ] — 人物落点采样复用
  if (params.showTerrain && !bug && mcPlain.length >= 2) {
    // 编排(展开深度/手性坐标系/冻结带合并/σ域包络)统一在 CORE terrainSetup — worldView 与测试共用, 防手抄漂移
    const basePtsOf = (g) => [mcPlain[g][2], mcPlain[g][3], mcPlain[g + 1][3]]; // 层底斜面三点
    const { regs, fpOf } = terrainSetup(data.beam, safeRegions(mcPlain, data.seed), basePtsOf, {
      hSlope: params.frameH / params.fDist, wSlope: (params.frameW / 2) / params.fDist,
      seed: Math.round(params.terrainSeed ?? 7), waves: params.terrainWaves ?? 3, ampRatio: params.terrainAmp ?? 0.15,
      headFrac: params.terrainHead ?? 0.25,
      layerEnds: [params.terrainEnd1 ?? 0, params.terrainEnd2 ?? 0, params.terrainEnd3 ?? 0], // 坡度基线: 各层结尾抬升(链式)
    });
    // 范围=黄色安全区(红区腾空); R2 贴地仅第一层(fpOf 默认 gap0 才 flushFront); terrainL1/2/3 只控显示
    for (const r of regs) {
      if (params['terrainL' + (r.gap + 1)] === false) continue;
      const grid = terrainOnPlane(r.points, basePtsOf(r.gap), fpOf(r.gap));
      if (!grid) continue;
      terrains.push({ gap: r.gap, grid });
      const op = params.terrainOpacity ?? 1;
      if (params.terrainTint) {
        const c = LAYER_TINT[r.gap % 3];
        root.add(buildTerrain(grid, op, mixHex(0x5f5a4e, c, 0.55), mixHex(0xd9d3c5, c, 0.55)));
      } else root.add(buildTerrain(grid, op));
    }
  }

  // 占位人 · 每层人群(作者方案): 每个有地形的安全区放 N 人(种子确定性编排, 三层不雷同), 同一身高 ——
  // 解读: 红绿蓝=不同的人/不同世界/不同人生但同框; 同层内结伴+相遇(交互在 index.html 逐帧驱动)。
  // 每人锚定优先级: placed['figure-层-序'](拖放存档) > fixedFoot(仅层1首人, 结构性穿越钉点) > 环线初相点贴地形。
  let figFoot = null;                            // 层1首人脚点(穿越捕获 lastFoot 用)
  const figures = [];                            // [{gap,idx,id,obj,meta,group,dir,speed,phase}] — 行走/相遇逐帧驱动
  if (params.showFigures && !bug && mcPlain.length >= 2) {
    for (const r of safeRegions(mcPlain, data.seed)) {
      const tr = terrains.find((t) => t.gap === r.gap);
      if (!tr) continue;                         // 该层地形隐藏/缺失 → 无地可站, 不放人
      const m = tr.grid.meta;
      const plan = peoplePlan(data.seed, r.gap, params.peopleMax ?? 3);
      plan.forEach((spec, idx) => {
        const id = `figure-${r.gap}-${idx}`;
        let foot = null;
        const pl = runtime.placed?.[id];
        const wp = runtime.walkPos?.[id];
        if (pl) foot = new THREE.Vector3(pl.x, pl.y, pl.z);
        else if (r.gap === 0 && idx === 0 && runtime.fixedFoot) foot = new THREE.Vector3(runtime.fixedFoot.x, runtime.fixedFoot.y, runtime.fixedFoot.z);
        else if (wp) foot = new THREE.Vector3(wp.x, wp.y, wp.z);                // 行走中重建: 接上次位置, 不跳
        else { const hp = hullPoint(m, spec.phase, (spec.phase * 7.13 + idx * 0.31) % 1, (spec.phase * 13.7 + idx * 0.57) % 1); foot = new THREE.Vector3(hp.point.x, hp.point.y, hp.point.z); } // 区内确定性散点
        if (!foot) return;
        const f = buildFigure(foot, new THREE.Vector3(0, 1, 0), (params.figureH ?? 80) / U,
          mixHex(0xcfc7ba, LAYER_TINT[r.gap % 3], 0.6)); // 按层染色(同地形层色)
        f.userData.dragId = id;
        root.add(f);
        figures.push({ gap: r.gap, idx, id, obj: f, meta: m, group: spec.group, dir: spec.dir, speed: spec.speed, phase: spec.phase });
        if (r.gap === 0 && idx === 0) figFoot = foot;
      });
    }
  }

  // 分区太阳(作者方案): 每个有地形的黄区一盏约束聚光灯, 光只落自己那块(锥外为零→不漏到别区/镜面)。
  // 灯方向沿全局太阳方位/高度角; 全局方向光由 scene.js 在此模式下置 0。仅 PT 里看真实效果(灯不可见、不遮挡)。
  if (params.zoneSun && !bug && mcPlain.length >= 2) {
    for (const r of safeRegions(mcPlain, data.seed)) {
      const tr = terrains.find((t) => t.gap === r.gap);
      if (!tr) continue;
      const m = tr.grid.meta;
      const sec = planeSection(r.points, m.pa, m.n);
      if (!sec) continue;
      const bp = centroid(sec);
      const surf = new THREE.Vector3(bp.x, bp.y + liftAt(m, bp).lift, bp.z);   // 黄区表面中心 = 灯对准点
      let rad = 0; for (const q of sec) rad = Math.max(rad, Math.hypot(q.x - bp.x, q.y - bp.y, q.z - bp.z)); // 黄区半径
      const ps = runtime.placed?.['zonesun-' + r.gap];                       // 拖放存档的灯位(优先)
      const sun = buildZoneSun(surf, rad, params, r.gap, ps ? new THREE.Vector3(ps.x, ps.y, ps.z) : null);
      sun.traverse((o) => { if (o.userData.isZoneSunMarker) o.visible = !!params.editDrag; }); // 标记仅"编辑拖拽"时显示, 不污染成像
      root.add(sun);
    }
  }

  // 活动空间(布尔差集的输入): 各镜面间的截头锥段 + 4 个复用点(M_g 长边 / M_{g+1} 短边)
  if (params.showActiveVol && !bug) {
    for (let gp = 0; gp < mc.length - 1; gp++) {
      root.add(buildFrustumSolid(mc[gp], mc[gp + 1], 0x3344cc, 0.05)); // 锥段边界(半透明, 重叠区会变浓 = 穿帮区)
      const eA = vEdges(mc[gp]).long;       // M_g 竖直长边 (面向下一镜)
      const eB = vEdges(mc[gp + 1]).short;  // M_{g+1} 竖直短边 (面向上一镜)
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eA), new THREE.LineBasicMaterial({ color: 0xff9030 })));
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eB), new THREE.LineBasicMaterial({ color: 0x30ffd0 })));
      for (const p of eA) root.add(buildSphere(p, 1, 0xff9030, sR * 0.85));
      for (const p of eB) root.add(buildSphere(p, 1, 0x30ffd0, sR * 0.85));
    }
  }

  // 黄色 = 安全可布景区 (CORE safeRegions)
  if (params.showUsable && !bug && mc.length >= 2) {
    for (const r of safeRegions(mcPlain, data.seed)) {
      try {
        const geo = new ConvexGeometry(r.points.map(V3));
        root.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SAFE_COLOR, transparent: true, opacity: 0.18, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8, emissive: 0x3a2f00, emissiveIntensity: 0.4, depthWrite: false })));
        root.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: SAFE_EDGE_COLOR, transparent: true, opacity: 0.6 })));
      } catch (e) { }
    }
  }
  // 红色 = 易穿帮区 (CORE bugRegions: 本段锥 ∩ 邻锥左右侧壁 + Σ→M₁ 锥)
  if (params.showBug && !bug && mc.length >= 2) {
    for (const r of bugRegions(mcPlain, data.seed)) {
      const op = r.kind === 'direct' ? 0.10 : 0.16;
      try {
        const g = new ConvexGeometry(r.points.map(V3));
        root.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: BUG_COLOR, transparent: true, opacity: op, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.85, emissive: BUG_COLOR, emissiveIntensity: 0.16, depthWrite: false })));
        root.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: BUG_EDGE_COLOR, transparent: true, opacity: 0.5 })));
      } catch (e) { }
    }
  }

  // 镜面角点编号 (镜面号.角号): 0=上右 1=上左 2=下左 3=下右
  // ★上界用 mirrorsV.length 而非 nLayers: 穿帮时 mirrors 比层数短, 用 nLayers 会越界 → rebuild 崩溃且穿帮警告永不显示
  if (params.showLabels) {
    const css = ['#ff8a8a', '#8affa0', '#8ac4ff'];
    for (let i = 0; i < mirrorsV.length; i++)
      for (let j = 0; j < 4; j++)
        root.add(makeLabel(`${i + 1}.${j}`, mc[i][j], css[i % 3], refSize * 0.07));
  }
  // 镜面编号 M1/M2/M3... 标在镜面中央; 多世界时由 base 连续编号(M4/M5/M6...), 不重复
  if (params.showMirrorId) {
    for (let i = 0; i < mirrorsV.length; i++) {
      const ctr = mirrorsV[i].reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
      root.add(makeLabel('M' + (base + i + 1), ctr, '#e6eef8', refSize * 0.11));
    }
    if (params.showEndMirror && endV) { // 收尾镜编号(淡蓝区分; 多世界时也连续)
      const ctr = endV.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
      root.add(makeLabel('M' + (base + mirrorsV.length + 1), ctr, '#bfe6ff', refSize * 0.11));
    }
  }
  if (bug) root.add(buildSphere(beam[beam.length - 1], 1, 0xff5ad0, sR * 1.4));
  return { root, bug, foot: figFoot, figures }; // figures: 行走逐帧驱动(各层各自的环线 meta), 不经 rebuild
}

// 多世界: 绕 Y 均分旋转复制; 返回合并 group + 最深穿帮层(0=无) + 首世界人物脚点(穿越模式捕获用)。
export function buildAllWorlds(params, runtime = {}) {
  const all = new THREE.Group();
  let bugLayer = 0, foot = null, figures = [];
  const N = Math.max(1, Math.round(params.worldCount));
  for (let k = 0; k < N; k++) {
    const w = buildSingleWorld(params, k * Math.round(params.layerCount), runtime);
    w.root.rotation.y = (2 * Math.PI / N) * k;
    all.add(w.root);
    bugLayer = Math.max(bugLayer, w.bug);
    if (k === 0) foot = w.foot;
    figures = figures.concat(w.figures); // 各世界都收(多世界行走同步): 同参旋转复制 → 环线周长一致, 相位推进天然一致
  }
  return { group: all, bugLayer, foot, figures };
}
