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
  { folder: '环境 (天空·太阳)', items: [
    { key: 'sunAz', label: '太阳方位角°', type: 'num', min: 0, max: 360, step: 1, def: 135, ref: 'sunAz', note: '绕 Y 轴, 决定阳光从哪个水平方向来 (各镜面层受光面随之不同)' },
    { key: 'sunEl', label: '太阳高度角°', type: 'num', min: -5, max: 90, step: 1, def: 48, ref: 'sunEl', note: '太阳离地平线的高度; 低=长影暖光, 高=顶光' },
    { key: 'sunIntensity', label: '太阳强度', type: 'num', min: 0, max: 6, step: 0.1, def: 2.6, ref: 'sunIntensity' },
    { key: 'skyTop', label: '天空顶色', type: 'color', def: '#4a78b8', ref: 'skyTop' },
    { key: 'skyHorizon', label: '地平线色', type: 'color', def: '#d8c4a8', ref: 'skyHorizon' },
  ] },
  { folder: '地面·地形·人物', items: [
    { key: 'showGround', label: '水平地面 (世界地)', type: 'bool', def: false, note: '默认隐藏(作者: 平坦灰地反而压缩空间感, 用地形起伏拉深浅); 水平面是45°镜系统不变量→各段无缝拼接、错链自遮盖' },
    { key: 'groundY', label: '地面高度 (相对Σ·负=下)', type: 'num', min: -150, max: -5, step: 1, def: -30, note: '原始单位; 仅水平地面与"无地形时人物落点兜底"用; 地形基面=层底斜面, 与此无关' },
    { key: 'showTerrain', label: '地形 (起伏·按层)', type: 'bool', def: true, note: '总开关。范围=黄色安全区; 基面=层底斜面; 跨缝轮廓出自同一连续场' },
    { key: 'terrainL1', label: '地形·层1', type: 'bool', def: true, note: '单层隐藏 → 检查层间衔接/第二层起始高度在取景框里的位置' },
    { key: 'terrainL2', label: '地形·层2', type: 'bool', def: true },
    { key: 'terrainL3', label: '地形·层3', type: 'bool', def: true },
    { key: 'terrainOpacity', label: '地形不透明度', type: 'num', min: 0.15, max: 1, step: 0.05, def: 1, note: '半透明 → 透视检查各层地面高度是否吻合衔接' },
    { key: 'terrainTint', label: '地形按层着色 (红绿蓝)', type: 'bool', def: false, note: '检查工具: 一眼分清哪块地形属于哪层(配合单层开关/半透明排查遮挡与衔接)' },
    { key: 'editDrag', label: '编辑·拖拽布景/人物', type: 'bool', def: false, note: '单视口模式生效; 按住块/人直接拖, 位置存档(重建后保留); 沿相机平行面移动' },
    { key: 'terrainAmp', label: '起伏幅度 (×层高)', type: 'num', min: 0, max: 0.5, step: 0.01, def: 0.15, note: '幅度=层高×系数, 深层自动更大(W₁<W₂<W₃); 太高会挡住后层(作者预言过的遮挡)' },
    { key: 'terrainWaves', label: '起伏尺度 (波数)', type: 'num', min: 1, max: 8, step: 0.5, def: 3, note: '一层里大约几座山; 小=缓丘, 大=碎丘' },
    { key: 'terrainSeed', label: '地形种子', type: 'int', min: 1, max: 999, step: 1, def: 7, note: '换一个数=换一套地貌; 同种子永远长同样的山' },
    { key: 'terrainHead', label: '首层前缘贴地 (×层深)', type: 'num', min: 0, max: 0.6, step: 0.05, def: 0.25, note: '仅第一层面对M₁的前边贴地(它前面无可衔接物); 其余层正常起伏, 接缝靠对齐衔接隐藏(近脊遮远口)' },
    { key: 'terrainEnd1', label: '层1 结尾抬升 (×层高)', type: 'num', min: 0, max: 0.5, step: 0.01, def: 0, note: '坡度基线(链式): 首层起点恒贴地(一条线)→爬到此值; 层2起点自动=层1结尾(σ域冻结带保证严格相等)' },
    { key: 'terrainEnd2', label: '层2 结尾抬升 (×层高)', type: 'num', min: 0, max: 0.5, step: 0.01, def: 0, note: '层2从层1结尾起步→爬到此值; 层3起点自动对齐' },
    { key: 'terrainEnd3', label: '层3 结尾抬升 (×层高)', type: 'num', min: 0, max: 0.5, step: 0.01, def: 0, note: '末层结尾; 调三个结尾=控制整体坡度走势(噪声起伏叠加在基线之上); 太高会顶穿锥顶' },
    { key: 'figureH', label: '人物身高', type: 'num', min: 10, max: 300, step: 1, def: 80, note: '原始单位 (取景框高默认40作参照); 脚自动贴地形' },
    { key: 'figureFixed', label: '人物固定世界坐标 (穿越)', type: 'bool', def: false, ref: 'figureFixed', note: '开启=人钉在当前位置不再跟随安全区; 拖镜距/取景框让分层扫过他 → 单见→重影→换层(结构性穿越, 档案·开放方向5)' },
    { key: 'figureWalk', label: '人物行走 (环线)', type: 'bool', def: false, ref: 'figureWalk', note: '沿层1安全区收缩环线匀速行走, 脚贴地形。与PT互斥(运动无法累积采样): 走动用光栅/真实反射看, 定格高保真→停走开PT。停走时人留在原地' },
    { key: 'walkSpeed', label: '行走速度', type: 'num', min: 10, max: 200, step: 5, def: 60, note: '原始单位/秒' },
  ] },
  { folder: '多世界 (一生二三)', items: [
    { key: 'worldCount', label: '世界数 N', type: 'int', min: 1, max: 6, step: 1, def: 1, gh: '8/11', note: 'N=2→C₂; N=3→C₃' },
  ] },
  { folder: '动画', items: [
    { key: 'expand', label: '展开 t', type: 'num', min: 0, max: 1, step: 0.001, def: 1, gh: 7, ref: 'expand' },
    { key: 'autoPlay', label: '自动展开循环', type: 'bool', def: false, ref: 'autoPlay', note: '与路径追踪互斥(每帧重建几何, PT 跟着每帧全量重建会冻死)' },
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
    { key: 'showEndMirror', label: '收尾镜 M₄ (可隐藏)', type: 'bool', def: false },
    { key: 'showGrid', label: '九宫格视线投影', type: 'bool', def: true },
    { key: 'showScenery', label: '测试布景 (红绿蓝/层)', type: 'bool', def: true },
    { key: 'showFloor', label: '层地面 (倾斜·安全段)', type: 'bool', def: false, note: '调试参考; 地形接管地面后默认关(与地形基面共面会 z-fighting 条纹)' },
    { key: 'showFloorBug', label: '层地面·穿帮段 (红)', type: 'bool', def: false, note: '伸进下一段光锥的部分, 会被错误镜链斜看成面; 默认隐藏备查' },
    { key: 'showFigures', label: '人物 (占位·站立)', type: 'bool', def: true },
    { key: 'showWall', label: '观影墙 (沉浸遮挡)', type: 'bool', def: true },
    { key: 'realMirror', label: '真实反射 (Reflector·实时)', type: 'bool', def: false, ref: 'realMirror' },
    { key: 'pathTrace', label: '路径追踪 (高保真·渐进)', type: 'bool', def: true, ref: 'pathTrace' },
  ] },
  { folder: '路径追踪精度 (开路径追踪后生效)', items: [
    { key: 'ptScale', label: '渲染分辨率 (低=糊但快)', type: 'num', min: 0.25, max: 1, step: 0.05, def: 1, ref: 'ptScale', note: '★模糊主因: 0.5=半分辨率上采样→糊; 1=全分辨率最清晰(更吃 GPU)' },
    { key: 'ptBounces', label: '光线反弹次数', type: 'int', min: 1, max: 16, step: 1, def: 8, ref: 'ptBounces', note: '嵌套镜子要看到深层反射需更多反弹; 越高越准也越慢' },
    { key: 'ptSamples', label: '采样上限 (越高越干净)', type: 'int', min: 16, max: 512, step: 16, def: 128, ref: 'ptSamples', note: '累积到此样本数停止; 越高噪点越少, 收敛更久' },
    { key: 'ptDynamic', label: '动态PT (走动实时·停走凝固)', type: 'bool', def: true, note: '行走+PT 同开时生效: 低分辨率每帧1采样=活的噪点画面(真实反射含二三层运动); 停走→全分辨率累积"凝固"成形。拓扑不变走 BVH refit 快路径' },
    { key: 'ptDynScale', label: '动态PT分辨率', type: 'num', min: 0.2, max: 0.6, step: 0.05, def: 0.35, note: '走动期间的渲染分辨率(低=流畅); 定格后自动恢复「渲染分辨率」设置' },
  ] },
];

// 由 schema 生成初始参数对象 (取各项默认值; 数组深拷贝)
export function defaultParams(schema = PARAM_SCHEMA) {
  const p = {};
  for (const grp of schema) for (const it of grp.items) p[it.key] = Array.isArray(it.def) ? it.def.slice() : it.def;
  return p;
}
