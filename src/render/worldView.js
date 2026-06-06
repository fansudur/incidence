// 建世界 (RENDER 层): 调 CORE 拿纯几何数据 → 造 three 物体。
// buildAllWorlds(params) → { group, bugLayer }; 把"是否穿帮"作为返回值上抛, 不再用共享模块变量。
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { traceFrustum, projectGrid, U } from '../core/frustum.js';
import { safeRegions, bugRegions, sceneryAnchors } from '../core/activity.js';
import { makeLabel, buildSphere, buildQuad, buildFrustumSolid, vEdges, buildMirror, buildProjGrid, buildScenery, buildWall, buildReflector, buildFloor } from './builders.js';
import { SEED_COLOR } from './materials.js';

// 单世界: 视锥追迹 (调 CORE 拿纯数据 → 渲染)。返回 { root, bug }。
function buildSingleWorld(params, base = 0) {
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

  // 层地面(倾斜): 每段锥的底面四边形 = 该层活动区的地面 (视锥底边发散 → 朝远处向下倾斜); 按层色着色, 人/物将站这上面
  if (params.showFloor && !bug && mc.length >= 2) {
    const floorCol = [0xff6a6a, 0x6aff8a, 0x6ab4ff];
    for (let gp = 0; gp < mc.length - 1; gp++)
      root.add(buildFloor([mc[gp][2], mc[gp][3], mc[gp + 1][3], mc[gp + 1][2]], floorCol[gp % 3]));
  }

  // 测试布景: 每层活动区中央放红/绿/蓝标记 (Σ 反射看到什么的地基; 真实反射接入后会被折叠合成)
  if (params.showScenery && !bug && mc.length >= 2) root.add(buildScenery(sceneryAnchors(mcPlain, data.seed), refSize));

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
        root.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffd700, transparent: true, opacity: 0.18, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8, emissive: 0x3a2f00, emissiveIntensity: 0.4, depthWrite: false })));
        root.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffe24a, transparent: true, opacity: 0.6 })));
      } catch (e) { }
    }
  }
  // 红色 = 易穿帮区 (CORE bugRegions: 本段锥 ∩ 邻锥左右侧壁 + Σ→M₁ 锥)
  if (params.showBug && !bug && mc.length >= 2) {
    for (const r of bugRegions(mcPlain, data.seed)) {
      const op = r.kind === 'direct' ? 0.10 : 0.16;
      try {
        const g = new ConvexGeometry(r.points.map(V3));
        root.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xff3344, transparent: true, opacity: op, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.85, emissive: 0xff3344, emissiveIntensity: 0.16, depthWrite: false })));
        root.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.5 })));
      } catch (e) { }
    }
  }

  // 镜面角点编号 (镜面号.角号): 0=上右 1=上左 2=下左 3=下右
  if (params.showLabels) {
    const css = ['#ff8a8a', '#8affa0', '#8ac4ff'];
    for (let i = 0; i < nLayers; i++)
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
  return { root, bug };
}

// 多世界: 绕 Y 均分旋转复制; 返回合并 group + 最深穿帮层(0=无)。
export function buildAllWorlds(params) {
  const all = new THREE.Group();
  let bugLayer = 0;
  const N = Math.max(1, Math.round(params.worldCount));
  for (let k = 0; k < N; k++) {
    const { root, bug } = buildSingleWorld(params, k * Math.round(params.layerCount));
    root.rotation.y = (2 * Math.PI / N) * k;
    all.add(root);
    bugLayer = Math.max(bugLayer, bug);
  }
  return { group: all, bugLayer };
}
