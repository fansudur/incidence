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

// 四边形(填充 + 描边)。metal=true 给金属感(活动域 W)。
export function buildQuad(c, colorHex, opacity, metal) {
  const g = new THREE.Group();
  const p = new Float32Array([
    c[0].x, c[0].y, c[0].z, c[1].x, c[1].y, c[1].z, c[2].x, c[2].y, c[2].z,
    c[0].x, c[0].y, c[0].z, c[2].x, c[2].y, c[2].z, c[3].x, c[3].y, c[3].z,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: colorHex, transparent: true, opacity: opacity * (metal ? 0.34 : 0.20), side: THREE.DoubleSide,
    metalness: metal ? 0.9 : 0.1, roughness: metal ? 0.12 : 0.85, emissive: colorHex, emissiveIntensity: 0.14, depthWrite: false,
  })));
  const loop = new THREE.BufferGeometry().setFromPoints([c[0], c[1], c[2], c[3], c[0]]);
  g.add(new THREE.Line(loop, new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity })));
  return g;
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

// 四边形的两条竖直边, 返回 {long, short} (按边长)
export function vEdges(c) {
  const right = [c[0], c[3]], left = [c[1], c[2]];
  return right[0].distanceTo(right[1]) >= left[0].distanceTo(left[1]) ? { long: right, short: left } : { long: left, short: right };
}

// 真·镜面四边形: 中性银色金属 + 环境反射 (不跟红黄蓝撞色)
export function buildMirror(c, opacity) {
  const g = new THREE.Group();
  const p = new Float32Array([
    c[0].x, c[0].y, c[0].z, c[1].x, c[1].y, c[1].z, c[2].x, c[2].y, c[2].z,
    c[0].x, c[0].y, c[0].z, c[2].x, c[2].y, c[2].z, c[3].x, c[3].y, c[3].z,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xccd6e2, metalness: 1.0, roughness: 0.0, envMapIntensity: 1.35,
    transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  })));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([c[0], c[1], c[2], c[3], c[0]]),
    new THREE.LineBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: Math.min(1, opacity * 1.3) }))); // 发光描边
  return g;
}

// 层地面 = 锥段"底面"(视锥下边界): 底边光线发散→朝远处向下倾斜。沿本层镜链看恰好侧对成线;
// 伸进邻段光锥的部分(穿帮段)由 CORE splitFloorByNextPlane 切出后分开传入。
// poly = 平面凸多边形顶点(N≥3, CORE 纯点或 Vector3 均可); 半透明着色 + 描边。
export function buildFloor(poly, colorHex) {
  const g = new THREE.Group();
  const P = poly.map(p => new THREE.Vector3(p.x, p.y, p.z));
  const tris = [];
  for (let i = 1; i < P.length - 1; i++) tris.push(P[0], P[i], P[i + 1]); // 凸多边形扇形剖分
  const verts = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => { verts[i * 3] = p.x; verts[i * 3 + 1] = p.y; verts[i * 3 + 2] = p.z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
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
  const P = poly.map(p => new THREE.Vector3(p.x, p.y, p.z));
  const tris = [];
  for (let i = 1; i < P.length - 1; i++) tris.push(P[0], P[i], P[i + 1]);
  const verts = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => { verts[i * 3] = p.x; verts[i * 3 + 1] = p.y; verts[i * 3 + 2] = p.z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: colorHex, metalness: 0.0, roughness: 0.92, side: THREE.DoubleSide,
  }));
}

// 占位人形 (低模: 胶囊身 + 球头): 脚立在 foot, 沿 up 朝向 (默认世界竖直=重力方向)。
// height = 身高(场景单位)。先验证站位/受光/反射, 之后再换精模或加走动。
export function buildFigure(foot, up, height, colorHex) {
  const g = new THREE.Group();
  const r = height * 0.12, bodyLen = height * 0.56; // 胶囊半径 / 直段长
  const mat = new THREE.MeshStandardMaterial({ color: colorHex ?? 0xcfc7ba, roughness: 0.75, metalness: 0.0 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, bodyLen, 6, 14), mat);
  body.position.y = r + bodyLen / 2;                 // 胶囊几何中心居中 → 底(脚)落在 y=0
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(height * 0.13, 18, 12), mat);
  head.position.y = r + bodyLen + height * 0.07;
  g.add(head);
  g.position.copy(foot);
  if (up && Math.abs(up.y - 1) > 1e-6)               // up≠世界Y 时才旋转(竖直站立默认不转)
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up.clone().normalize());
  return g;
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
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
      new THREE.MeshStandardMaterial({ color: col[i], metalness: 0.2, roughness: 0.5, emissive: col[i], emissiveIntensity: 0.25, flatShading: true }));
    m.position.set(a.center.x, a.center.y, a.center.z);
    g.add(m);
    g.add(makeLabel(String(a.layer + 1), new THREE.Vector3(a.center.x, a.center.y + r * 1.7, a.center.z), css[i], refSize * 0.08));
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
