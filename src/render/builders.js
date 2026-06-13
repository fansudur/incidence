// 渲染工具 (RENDER 层, 用 THREE): 把点/四边形造成 mesh/line/sprite。几何由 CORE 算好后传入。
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js'; // 实时平面反射(真实反射·轻量路线)

// 镜面中央编号 / 角点编号 的文字精灵
export function makeLabel(text, pos, colorCss, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(text, 48, 48);
  ctx.fillStyle = colorCss; ctx.fillText(text, 48, 48);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
  spr.position.copy(pos); spr.scale.set(size, size, 1);
  return spr;
}

export function buildSphere(pos, opacity, color, radius) {
  const c = color ?? 0xffffff;
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius ?? 0.13, 24, 16),
    new THREE.MeshStandardMaterial({ color: c, emissive: color ? c : 0x556677, metalness: 0.3, roughness: 0.4, transparent: true, opacity }));
  m.position.copy(pos); return m;
}

// 凸多边形 → 扇形剖分 BufferGeometry (镜面/层地面/水平地面共用; 输入 CORE 纯点或 Vector3 均可)
function fanGeometry(poly) {
  const P = poly.map(p => new THREE.Vector3(p.x, p.y, p.z));
  const tris = [];
  for (let i = 1; i < P.length - 1; i++) tris.push(P[0], P[i], P[i + 1]);
  const verts = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => { verts[i * 3] = p.x; verts[i * 3 + 1] = p.y; verts[i * 3 + 2] = p.z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return { geo, P };
}

// 两个四边形之间的截头锥实体 (光锥段边界): 近面 nc, 远面 fc
export function buildFrustumSolid(nc, fc, colorHex, opacity) {
  const g = new THREE.Group();
  const v = [...nc, ...fc]; // 0-3 近, 4-7 远
  const tri = [];
  const quad = (a, b, c2, d) => { tri.push(a, b, c2, a, c2, d); };
  quad(0, 1, 2, 3); quad(7, 6, 5, 4);
  for (let j = 0; j < 4; j++) { const k = (j + 1) % 4; quad(j, k, k + 4, j + 4); }
  const pos = new Float32Array(tri.length * 3);
  tri.forEach((idx, i) => { pos[i * 3] = v[idx].x; pos[i * 3 + 1] = v[idx].y; pos[i * 3 + 2] = v[idx].z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorHex, transparent: true, opacity, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.9, depthWrite: false })));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nc[0], nc[1], nc[2], nc[3], nc[0]]), new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5 })));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([fc[0], fc[1], fc[2], fc[3], fc[0]]), new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5 })));
  for (let j = 0; j < 4; j++) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nc[j], fc[j]]), new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.5 })));
  return g;
}

// 真·镜面四边形: 中性银色金属 + 环境反射 (不跟红黄蓝撞色)
export function buildMirror(c, opacity) {
  const g = new THREE.Group();
  const { geo } = fanGeometry(c);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xccd6e2, metalness: 1.0, roughness: 0.0, envMapIntensity: 1.35,
    transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  })));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([c[0], c[1], c[2], c[3], c[0]]),
    new THREE.LineBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: Math.min(1, opacity * 1.3) }))); // 发光描边
  return g;
}

// 层地面 = 锥段"底面"(视锥下边界): 底边光线发散→朝远处向下倾斜。沿本层镜链看恰好侧对成线;
// 伸进邻段光锥的部分(穿帮段)由 CORE splitFloorByNextCone 切出后分开传入。
// poly = 平面凸多边形顶点(N≥3); 半透明着色 + 描边。
export function buildFloor(poly, colorHex) {
  const g = new THREE.Group();
  const { geo, P } = fanGeometry(poly);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: colorHex, transparent: true, opacity: 0.32, side: THREE.DoubleSide,
    metalness: 0.0, roughness: 0.95, depthWrite: false,
  })));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([...P, P[0]]),
    new THREE.LineBasicMaterial({ color: colorHex })));
  return g;
}

// 水平地面 (真实世界地, 不透明): poly = 水平凸多边形 (CORE groundSection 产物)。
// 水平面是 45°镜系统的不变量 → 各段无缝拼接、错链自遮盖, 不需邻锥裁剪。
export function buildGround(poly, colorHex) {
  return new THREE.Mesh(fanGeometry(poly).geo, new THREE.MeshStandardMaterial({
    color: colorHex, metalness: 0.0, roughness: 0.92, side: THREE.DoubleSide,
  }));
}

// 地形 (CORE terrainOnPlane 产物 → mesh): 顶点色按相对高度插值(谷暗坡亮), 裙边剖面=深土色;
// 无图片贴图 → 无失真且 PT/光栅一致
export function buildTerrain(grid, opacity = 1, lowHex = 0x5f5a4e, highHex = 0xd9d3c5, cutHex = 0x4f4a42) { // 剖面色与地表同族略深: 近黑会让远层(掠射视角下正对的是剖面墙)整体读成黑块
  const { positions, indices, rel } = grid;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  const lo = new THREE.Color(lowHex), hi = new THREE.Color(highHex), cut = new THREE.Color(cutHex), c = new THREE.Color();
  // ★顶点色用 4 分量 RGBA: three-gpu-pathtracer 给无顶点色网格补的是 itemSize=4 的填充,
  //   3 分量与之合并会 itemSize 撞车 → setScene 崩 (RangeError: Invalid typed array length)
  const colors = new Float32Array(rel.length * 4);
  for (let i = 0; i < rel.length; i++) {
    if (rel[i] < 0) c.copy(cut);                                  // 裙边底 = 剖面色 (插值后切面呈土层渐暗)
    else c.lerpColors(lo, hi, Math.max(0, Math.min(1, rel[i])));
    colors[i * 4] = c.r; colors[i * 4 + 1] = c.g; colors[i * 4 + 2] = c.b; colors[i * 4 + 3] = 1;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.0, roughness: 0.93, side: THREE.DoubleSide,
    transparent: opacity < 1, opacity, depthWrite: opacity >= 1, // 半透明 → 透视检查层间衔接(作者用途)
  }));
}

// 两骨 IK(矢状面): 给定脚相对髋枢轴的位移(zf 前后, vDown 向下距离)与大小腿长 → 髋/膝绕 X 旋转角。
// 几何约定: 关节 0 角=肢向正下(-Y); 绕 X 正转令末端朝 -Z(故下方用 -zf 喂入)。膝朝前屈(髋角取 γ−α)。
function legIK(zf, vDown, L1, L2) {
  const h = -zf;                                     // 水平分量(与旋转方向匹配)
  let d = Math.hypot(h, vDown);
  d = Math.max(Math.abs(L1 - L2) + 1e-4, Math.min(L1 + L2 - 1e-4, d)); // 夹到可达范围
  const clamp = (c) => Math.acos(Math.min(1, Math.max(-1, c)));
  const gamma = Math.atan2(h, vDown);                // 目标方向相对正下的夹角
  const alpha = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)); // 髋: 大腿与髋→脚连线夹角
  const knee = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)); // 膝内角
  return { hip: gamma - alpha, knee: Math.PI - knee };
}

// 占位人形 (关节骨架 + 脚部IK): 躯干/头/两臂(FK摆)/两腿(IK踩地)/小脚掌。脚立在 foot, 沿 up 朝向。
// 走动 = 只转关节枢轴(不重建几何) → 拓扑不变, 动态PT 走 bvh.refit 快路径(与整体移动同级)。
// 比例使腿够得着地(腿展>髋高→站立略屈膝, 自然); 行走时脚在支撑相贴地、摆动相抬起划弧 → 不再飘/陷。
// 暴露 userData.gait(相位)/ setHeading(yaw) / strideLen。
export function buildFigure(foot, up, height, colorHex) {
  const H = height;
  const g = new THREE.Group();
  g.userData.dragId = 'figure';                      // 拖拽编辑的根标识
  const facing = new THREE.Group();                  // 朝向枢轴(yaw); g 只管 位置+up, 朝向独立转, 不与 up 四元数打架
  g.add(facing);
  const mat = new THREE.MeshStandardMaterial({ color: colorHex ?? 0xcfc7ba, roughness: 0.7, metalness: 0.0 });
  const cap = (rad, len) => new THREE.Mesh(new THREE.CapsuleGeometry(rad, Math.max(0.001, len), 4, 8), mat); // 低分段: PT 友好

  // 比例(以 H 为基准, 脚≈y0): 髋 0.46 / 肩 0.82 / 头心 0.90; 腿展 0.52 > 髋高 0.46 → 站立时略屈膝(可踩地)
  const hipY = 0.46 * H, shoulderY = 0.82 * H;
  const upperLeg = 0.27 * H, lowerLeg = 0.25 * H, upperArm = 0.18 * H, lowerArm = 0.16 * H;
  const hipHalf = 0.085 * H, shoulderHalf = 0.13 * H, footLen = 0.13 * H;

  const pelvis = new THREE.Group(); pelvis.position.y = hipY; facing.add(pelvis);
  const torso = cap(0.10 * H, (shoulderY - hipY) - 0.16 * H); // 躯干: 髋→肩
  torso.position.y = (shoulderY - hipY) / 2; pelvis.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085 * H, 12, 10), mat);
  head.position.y = (shoulderY - hipY) + 0.12 * H; pelvis.add(head);

  // 肢: 枢轴在关节处, 子网格中心向下偏移半段 → 绕枢轴 X 轴转=前后摆; 末端再挂下一段枢轴
  const limb = (parent, x, topLen, botLen, rad, withFoot) => {
    const hip = new THREE.Group(); hip.position.set(x, 0, 0); parent.add(hip);
    const up1 = cap(rad, topLen - 2 * rad); up1.position.y = -topLen / 2; hip.add(up1);
    const knee = new THREE.Group(); knee.position.y = -topLen; hip.add(knee);
    const lo1 = cap(rad * 0.85, botLen - 2 * rad); lo1.position.y = -botLen / 2; knee.add(lo1);
    let ankle = null;
    if (withFoot) {                                  // 脚掌: 挂踝处, 反向旋转保持水平(踩平地面)
      ankle = new THREE.Group(); ankle.position.y = -botLen; knee.add(ankle);
      const fb = new THREE.Mesh(new THREE.BoxGeometry(rad * 1.8, rad * 0.9, footLen), mat);
      fb.position.set(0, -rad * 0.45, footLen * 0.28); ankle.add(fb); // 脚向前伸
    }
    return { hip, knee, ankle };
  };
  const legL = limb(pelvis, -hipHalf, upperLeg, lowerLeg, 0.05 * H, true);
  const legR = limb(pelvis, hipHalf, upperLeg, lowerLeg, 0.05 * H, true);
  const shoulders = new THREE.Group(); shoulders.position.y = shoulderY - hipY; pelvis.add(shoulders);
  const armL = limb(shoulders, -shoulderHalf, upperArm, lowerArm, 0.035 * H, false);
  const armR = limb(shoulders, shoulderHalf, upperArm, lowerArm, 0.035 * H, false);
  armL.hip.rotation.z = 0.08; armR.hip.rotation.z = -0.08; // 手臂微外张(自然垂)

  const stride = 0.40 * H, half = stride / 2, swingLift = 0.10 * H;
  const footDrop = 0.045 * H;                         // 踝到脚掌底的高差 → 支撑相踝抬到此高度, 脚掌底正好落 y0
  // 一条腿: 相位 ph∈[0,1) → 脚(踝)目标(前后 zf, 高 yf) → IK 解髋膝 → 踝反旋保持脚掌水平
  const placeLeg = (leg, ph, bob) => {
    let zf, yf;
    if (ph < 0.6) { zf = half - (ph / 0.6) * stride; yf = footDrop; }     // 支撑相: 脚掌贴地, 由前划到后
    else { const t = (ph - 0.6) / 0.4; zf = -half + t * stride; yf = footDrop + swingLift * Math.sin(Math.PI * t); } // 摆动相: 抬脚划弧前送
    const sol = legIK(zf, hipY + bob - yf, upperLeg, lowerLeg);
    leg.hip.rotation.x = sol.hip; leg.knee.rotation.x = sol.knee;
    if (leg.ankle) leg.ankle.rotation.x = -(sol.hip + sol.knee);          // 脚掌保持水平
  };
  g.userData.gait = (p) => {
    const bob = -0.015 * H * (1 + Math.cos(2 * Math.PI * 2 * p));         // 躯干轻微起伏(双脚支撑时最高)
    pelvis.position.y = hipY + bob;
    placeLeg(legL, p % 1, bob);
    placeLeg(legR, (p + 0.5) % 1, bob);                                   // 左右反相半步
    const s = Math.sin(2 * Math.PI * p);
    armL.hip.rotation.x = -0.35 * s; armR.hip.rotation.x = 0.35 * s;      // 臂与对侧腿协同
    armL.knee.rotation.x = 0.25; armR.knee.rotation.x = 0.25;             // 肘微屈
  };
  // 交谈姿(相遇时): 站立(腿踩地不动) + 双臂比划(右臂为主、左臂小幅), 由时间 t 驱动 → 有肢体动作
  g.userData.talk = (t) => {
    pelvis.position.y = hipY;
    placeLeg(legL, 0.3, 0); placeLeg(legR, 0.3, 0);
    const a = Math.sin(t * 3.0), b = Math.sin(t * 2.3 + 1.0);
    armR.hip.rotation.x = -0.5 - 0.35 * a; armR.knee.rotation.x = 0.9 + 0.45 * a; armR.hip.rotation.z = -0.16; // 右手抬起比划
    armL.hip.rotation.x = -0.12 + 0.18 * b; armL.knee.rotation.x = 0.45 + 0.22 * b; armL.hip.rotation.z = 0.12; // 左手小幅
  };
  // 站立姿(静态人物): 双脚都踩在中点(略屈膝, 不飘不陷), 臂自然垂、肘微屈
  pelvis.position.y = hipY;
  placeLeg(legL, 0.3, 0); placeLeg(legR, 0.3, 0);     // ph=0.3 → zf=0,yf=0(支撑相中点)
  armL.hip.rotation.x = 0; armR.hip.rotation.x = 0; armL.knee.rotation.x = 0.2; armR.knee.rotation.x = 0.2;
  g.userData.setHeading = (yaw) => { facing.rotation.y = yaw; };
  g.userData.strideLen = stride;                     // 行走相位 = 走过距离 / 步幅

  g.position.copy(foot);
  if (up && Math.abs(up.y - 1) > 1e-6)               // up≠世界Y 时才旋转(竖直站立默认不转)
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up.clone().normalize());
  return g;
}

// 分区太阳: 一盏聚光灯, 只照一块黄区(gap=层号)。target=黄区表面中心, radius=黄区半径(场景单位)。
// 方位/高度/强度按层独立(zoneSunAz/El/Int[gap]); 远距(dist) + 按 radius 自动收窄的锥 → 光线近平行(像太阳)、
// 锥外为零(关在这块区里, 不打到别区/镜面)。decay=0(无距离衰减, 全区等亮如日)、distance=0(无范围截断)、penumbra 柔边。
// 灯本身不可见、不进几何遮挡。dist/spread/soft 三层共用。
export function buildZoneSun(target, radius, p, gap = 0, placedPos = null) {
  const i = Math.min(gap, 2);                         // 三层独立, 超出按末层
  const az = THREE.MathUtils.degToRad(p.zoneSunAz[i]), el = THREE.MathUtils.degToRad(p.zoneSunEl[i]);
  const up = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)); // 黄区→该层太阳
  const dist = Math.max(20, p.zoneSunDist ?? 120);
  const half = Math.min(Math.PI / 2 - 0.01, Math.atan(radius / dist) * (p.zoneSunSpread ?? 1.4)); // 锥半角 = 刚好罩住黄区 × 余量
  const grp = new THREE.Group();
  const tgt = new THREE.Object3D(); tgt.position.copy(target); grp.add(tgt); // 瞄准点=黄区中心(固定, 不随灯移动)
  const rig = new THREE.Group();                      // 灯+标记 的可拖拽组(target 不在其内 → 拖灯时仍瞄黄区)
  rig.userData.dragId = 'zonesun-' + gap;
  rig.position.copy(placedPos || new THREE.Vector3().copy(target).addScaledVector(up, dist)); // 拖放存档优先, 否则按方位/高度/灯距自动摆
  const light = new THREE.SpotLight(0xffffff, p.zoneSunInt[i], 0, half, p.zoneSunSoft ?? 0.6, 0);
  light.target = tgt; rig.add(light);                 // 灯在 rig 原点; 移 rig=移灯, 仍瞄固定 tgt
  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.18 + 0.06, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd24a })); // 太阳色小球: 标出灯位(仅编辑时显示, 不进最终成像)
  marker.userData.isZoneSunMarker = true;
  rig.add(marker);
  const end = new THREE.Vector3().copy(target).sub(rig.position);           // 灯→黄区 的连线(rig 本地坐标)
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), end]),
    new THREE.LineBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.4 })); // 指明这盏灯照哪块、从哪打来
  line.userData.isZoneSunMarker = true;
  rig.add(line);
  grp.add(rig);
  return grp;
}

// 九宫格投影网格: sections = 各截面的 V3 网格点(行主序), N = 每边点数(=格数+1)。
// 横竖网格线(每截面截出该层九宫格) + 纵向连线(截面间, =N² 条视线管, 看跨层遮挡)。
export function buildProjGrid(sections, N, color) {
  const g = new THREE.Group();
  const lat = []; // 横竖网格线
  for (const cs of sections)
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const idx = i * N + j;
      if (j < N - 1) lat.push(cs[idx], cs[idx + 1]);  // 横
      if (i < N - 1) lat.push(cs[idx], cs[idx + N]);  // 竖
    }
  const lon = []; // 视线管 (截面之间)
  for (let k = 0; k < sections.length - 1; k++)
    for (let idx = 0; idx < N * N; idx++) lon.push(sections[k][idx], sections[k + 1][idx]);
  const seg = (pts, op) => g.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })));
  if (lat.length) seg(lat, 0.75);
  if (lon.length) seg(lon, 0.3);
  return g;
}

// 测试布景: 每层活动区中央放一个该层色(红/绿/蓝)标记 + 层号。
// 用来检验"Σ 透过 F 反射出布景"——现阶段直接可见, 接入真实反射后会被镜面折叠合成。
export function buildScenery(anchors, refSize) {
  const g = new THREE.Group();
  const col = [0xff6a6a, 0x6aff8a, 0x6ab4ff];      // 红/绿/蓝 三层
  const css = ['#ff8a8a', '#8affa0', '#8ac4ff'];
  for (const a of anchors) {
    const i = a.layer % 3;
    const r = a.size || refSize * 0.05; // 每层按其九宫格格子大小, 防溢出挡到邻层
    const sub = new THREE.Group();                  // 每块布景一个子组(几何在原点) → 拖拽时块+编号一起走
    sub.position.set(a.center.x, a.center.y, a.center.z);
    sub.userData.dragId = 'scenery-' + a.layer;     // 拖拽编辑的根标识
    sub.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
      new THREE.MeshStandardMaterial({ color: col[i], metalness: 0.2, roughness: 0.5, emissive: col[i], emissiveIntensity: 0.25, flatShading: true })));
    sub.add(makeLabel(String(a.layer + 1), new THREE.Vector3(0, r * 1.7, 0), css[i], refSize * 0.08));
    g.add(sub);
  }
  return g;
}

// 观影墙: 取景框 F 所在平面(x=fd)上的一面暗墙, 中间挖出 F 大小的洞 → 只透过 F 看到里面内容(沉浸/影院感)。
// Fc = F 四角 V3 (0上右 1上左 2下左 3下右); K = 墙相对 F 的放大倍数。
export function buildWall(Fc, K, colorHex) {
  const fd = Fc[0].x, hh = Math.abs(Fc[0].y), hw = Math.abs(Fc[0].z);
  const HH = hh * K, ZZ = hw * K;
  const q = (y0, y1, z0, z1) => [fd, y1, z1, fd, y1, z0, fd, y0, z0, fd, y1, z1, fd, y0, z0, fd, y0, z1]; // y,z 矩形 @ x=fd (2 三角)
  const tris = [
    ...q(hh, HH, -ZZ, ZZ),   // 上
    ...q(-HH, -hh, -ZZ, ZZ), // 下
    ...q(-hh, hh, -ZZ, -hw), // 左
    ...q(-hh, hh, hw, ZZ),   // 右 (中间 y∈[-hh,hh] z∈[-hw,hw] = F, 留空)
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris), 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
}

// 真实反射镜面: 把镜面四角 c 转成一面定向的 THREE.Reflector(实时反射场景)。
// 反射平面由四角定向: 局部 +Z = 四角法向, 矩形覆盖该四边形。单次反射真实, 多跳嵌套近似(Reflector 局限)。
export function buildReflector(c, color) {
  const g = new THREE.Group();
  const e1 = new THREE.Vector3().subVectors(c[1], c[0]); // 上右 → 上左
  const e2 = new THREE.Vector3().subVectors(c[3], c[0]); // 上右 → 下右
  const X = e1.clone().normalize();
  const n = new THREE.Vector3().crossVectors(e1, e2).normalize(); // 四边形法向
  const Y = new THREE.Vector3().crossVectors(n, X).normalize();
  const center = new THREE.Vector3();
  for (const p of c) center.add(p);
  center.multiplyScalar(1 / c.length);
  // ★反射面 = 真实四边形(Σ 经 F 射出的截面), 不用矩形近似 → 不压缩、边界不变。
  // 把世界四角投到局部 XY 平面(原点=中心, 轴=X/Y/n), 组成两三角。
  const loc = c.map((p) => { const d = new THREE.Vector3().subVectors(p, center); return [d.dot(X), d.dot(Y)]; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    loc[0][0], loc[0][1], 0, loc[1][0], loc[1][1], 0, loc[2][0], loc[2][1], 0,
    loc[0][0], loc[0][1], 0, loc[2][0], loc[2][1], 0, loc[3][0], loc[3][1], 0,
  ]), 3));
  const r = new Reflector(geo, { color: color ?? 0x9aa3ad, textureWidth: 512, textureHeight: 512 });
  r.position.copy(center);
  r.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, n));
  r.material.side = THREE.DoubleSide; // 双面镜(正反都反射)
  g.add(r);
  // 发光描边: 真四角【向外扩 4%】成外围环 → 在镜面外围、不侵入反射面/不改边界; depthTest 关→始终可见
  const out = c.map((p) => new THREE.Vector3().subVectors(p, center).multiplyScalar(1.04).add(center));
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints([out[0], out[1], out[2], out[3], out[0]]),
    new THREE.LineBasicMaterial({ color: 0x7df9ff, depthTest: false, transparent: true }));
  edge.renderOrder = 999;
  g.add(edge);
  return g;
}
