// 参数 schema = 单一数据源。GUI 从这里自动生成; 新增/改参数只动这一处。
// gh: 对应原 .gh 滑块编号(推断, 以几何对错为准, 非确证); note: 备注; ref: 需在别处引用的控制器名。
export const PARAM_SCHEMA = [
  { folder: '镜面 (每面独立)', items: [
    { key: 'layerCount', label: '镜面数', type: 'int', min: 1, max: 3, step: 1, def: 3, gh: 12 },
    { key: 'mAngle', type: 'vec3', sub: ['M₁ 角度°', 'M₂ 角度°', 'M₃ 角度°'], min: 0, max: 90, step: 1, def: [45, 45, 45], gh: 9, note: '★45=平行, 核心不变量' },
    { key: 'mDist', type: 'vec3', sub: ['Σ→M₁ 距离', 'M₁→M₂ 距离', 'M₂→M₃ 距离'], min: 20, max: 1200, step: 1, def: [550, 359, 634], gh: '14/6', note: '★作者实测值' },
    { key: 'mEndAngle', label: '收尾镜角度°', type: 'num', min: 0, max: 90, step: 1, def: 45, note: '收尾镜=M(层数+1), 给最后一层活动区封口; 45=续折叠, 改角=改封口朝向' },
    { key: 'mDistEnd', label: '收尾镜距离', type: 'num', min: 20, max: 2000, step: 1, def: 880, note: '收尾镜到最后一面镜的距离 = 最后一块安全盒的深度' },
  ] },
  { folder: '取景框 F', items: [
    { key: 'fDist', label: 'Σ→F 距离', type: 'num', min: 10, max: 600, step: 1, def: 170, gh: 4 },
    { key: 'frameW', label: '取景框宽', type: 'num', min: 10, max: 600, step: 1, def: 60, gh: 5 },
    { key: 'frameH', label: '取景框高', type: 'num', min: 10, max: 600, step: 1, def: 40, gh: null, note: '猜测值, 待核对宽高比' },
    { key: 'wallSize', label: '观影墙大小 (×框)', type: 'num', min: 2, max: 30, step: 0.5, def: 8, note: '观影墙相对取景框的放大倍数; 中间挖框大小的洞' },
  ] },
  { folder: '多世界 (一生二三)', items: [
    { key: 'worldCount', label: '世界数 N', type: 'int', min: 1, max: 6, step: 1, def: 1, gh: '8/11', note: 'N=2→C₂; N=3→C₃' },
  ] },
  { folder: '动画', items: [
    { key: 'expand', label: '展开 t', type: 'num', min: 0, max: 1, step: 0.001, def: 1, gh: 7, ref: 'expand' },
    { key: 'autoPlay', label: '自动展开循环', type: 'bool', def: false },
    { key: 'autoRotate', label: '缓慢自转', type: 'bool', def: false },
  ] },
  { folder: '显示', items: [
    { key: 'showSeed', label: 'Σ+F', type: 'bool', def: true },
    { key: 'showBeam', label: '中心光路', type: 'bool', def: true },
    { key: 'showFrustum', label: '视锥角光线', type: 'bool', def: true },
    { key: 'showWorlds', label: '镜面/活动域 W', type: 'bool', def: true },
    { key: 'showUsable', label: '黄·安全布景区', type: 'bool', def: true, ref: 'showUsable' },
    { key: 'showBug', label: '红·易穿帮区', type: 'bool', def: true, ref: 'showBug' },
    { key: 'showActiveVol', label: '锥段脚手架', type: 'bool', def: false },
    { key: 'showLabels', label: '角点编号', type: 'bool', def: true },
    { key: 'showMirrorId', label: '镜面编号 M#', type: 'bool', def: true },
    { key: 'showEndMirror', label: '收尾镜 M₄ (可隐藏)', type: 'bool', def: true },
    { key: 'showGrid', label: '九宫格视线投影', type: 'bool', def: true },
    { key: 'showScenery', label: '测试布景 (红绿蓝/层)', type: 'bool', def: true },
    { key: 'showWall', label: '观影墙 (沉浸遮挡)', type: 'bool', def: true },
    { key: 'realMirror', label: '真实反射 (Reflector·实时)', type: 'bool', def: false, ref: 'realMirror' },
    { key: 'pathTrace', label: '路径追踪 (高保真·渐进)', type: 'bool', def: false, ref: 'pathTrace' },
  ] },
  { folder: '路径追踪精度 (开路径追踪后生效)', items: [
    { key: 'ptScale', label: '渲染分辨率 (低=糊但快)', type: 'num', min: 0.25, max: 1, step: 0.05, def: 1, ref: 'ptScale', note: '★模糊主因: 0.5=半分辨率上采样→糊; 1=全分辨率最清晰(更吃 GPU)' },
    { key: 'ptBounces', label: '光线反弹次数', type: 'int', min: 1, max: 16, step: 1, def: 8, ref: 'ptBounces', note: '嵌套镜子要看到深层反射需更多反弹; 越高越准也越慢' },
    { key: 'ptSamples', label: '采样上限 (越高越干净)', type: 'int', min: 16, max: 512, step: 16, def: 128, ref: 'ptSamples', note: '累积到此样本数停止; 越高噪点越少, 收敛更久' },
  ] },
];

// 由 schema 生成初始参数对象 (取各项默认值; 数组深拷贝)
export function defaultParams(schema = PARAM_SCHEMA) {
  const p = {};
  for (const grp of schema) for (const it of grp.items) p[it.key] = Array.isArray(it.def) ? it.def.slice() : it.def;
  return p;
}
