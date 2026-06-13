// 参数 schema = 单一数据源。GUI 从这里自动生成; 新增/改参数只动这一处。
// gh: 对应原 .gh 滑块编号(推断, 以几何对错为准, 非确证); note: 备注; ref: 需在别处引用的控制器名。
// folder.collapsed: 该 folder 默认折叠(常用的展开, 庞杂/低频的收起 → 侧边栏不再一屏铺满)。
export const PARAM_SCHEMA = [
  { folder: '镜面 (每面独立)', items: [
    { key: 'layerCount', label: '镜面数', type: 'int', min: 1, max: 3, step: 1, def: 3, gh: 12 },
    { key: 'mAngle', type: 'vec3', sub: ['M₁ 角度°', 'M₂ 角度°', 'M₃ 角度°'], min: 0, max: 90, step: 1, def: [45, 45, 45], gh: 9, note: '★45=平行, 核心不变量' },
    { key: 'mDist', type: 'vec3', sub: ['Σ→M₁ 距离', 'M₁→M₂ 距离', 'M₂→M₃ 距离'], min: 20, max: 3000, step: 1, def: [299, 780, 1200], gh: '14/6', note: '★作者定版构图(原.gh实测550/359/634); 上限可大幅拉远' },
    { key: 'mEndAngle', label: '收尾镜角度°', type: 'num', min: 0, max: 90, step: 1, def: 3, note: '收尾镜=M(层数+1), 给最后一层活动区封口; 45=续折叠, 改角=改封口朝向' },
    { key: 'mDistEnd', label: '收尾镜距离', type: 'num', min: 20, max: 3500, step: 1, def: 1295, note: '收尾镜到最后一面镜的距离 = 最后一块安全盒的深度' },
    { key: 'showEndMirror', label: '收尾镜 M₄ (可隐藏)', type: 'bool', def: false },
  ] },
  { folder: '取景框 F · 观影墙', items: [
    { key: 'fDist', label: 'Σ→F 距离', type: 'num', min: 10, max: 600, step: 1, def: 120, gh: 4 },
    { key: 'frameW', label: '取景框宽', type: 'num', min: 10, max: 600, step: 1, def: 60, gh: 5 },
    { key: 'frameH', label: '取景框高', type: 'num', min: 10, max: 600, step: 1, def: 33, gh: null, note: '作者定版构图(原猜测40)' },
    { key: 'wallSize', label: '观影墙大小 (×框)', type: 'num', min: 2, max: 30, step: 0.5, def: 8, note: '观影墙相对取景框的放大倍数; 中间挖框大小的洞' },
    { key: 'showWall', label: '观影墙 (沉浸遮挡)', type: 'bool', def: true },
  ] },
  { folder: '天空与太阳 (全局)', items: [
    { key: 'sunAz', label: '太阳方位角°', type: 'num', min: 0, max: 360, step: 1, def: 135, ref: 'sunAz', note: '绕 Y 轴, 阳光的水平来向 (各镜面层受光面随之不同)。开"分区太阳"后此全局太阳自动关闭' },
    { key: 'sunEl', label: '太阳高度角°', type: 'num', min: -5, max: 90, step: 1, def: 48, ref: 'sunEl', note: '太阳离地平线的高度; 低=长影暖光, 高=顶光' },
    { key: 'sunIntensity', label: '太阳强度', type: 'num', min: 0, max: 6, step: 0.1, def: 2.6, ref: 'sunIntensity' },
    { key: 'skyEnv', label: '环境天空 (背景+全局补光)', type: 'bool', def: false, ref: 'skyEnv', note: '一键开/关天空: 关=去掉天空背景与全场补光→纯黑宇宙, 只剩太阳/分区灯。PT 里实时生效(比调黑颜色更彻底, 改色只改背景不改采样补光)' },
    { key: 'skyTop', label: '天空顶色', type: 'color', def: '#4a78b8', ref: 'skyTop', note: '天空也给全场一层环境补光(全局); 想纯靠分区灯/宇宙黑 → 直接关上面的「环境天空」' },
    { key: 'skyHorizon', label: '地平线色', type: 'color', def: '#d8c4a8', ref: 'skyHorizon' },
  ] },
  { folder: '分区太阳 (每黄区独立)', collapsed: true, items: [
    { key: 'zoneSun', label: '◉ 开启分区太阳 (自动关全局太阳)', type: 'bool', def: true, ref: 'zoneSun', note: '开=关掉全局太阳, 每个有地形的黄区各一盏远距窄锥聚光灯, 光只落自己那块(锥外为零→不打别区/镜面)。三层的方位/高度/强度各自独立可调。灯本身不可见、不遮挡; 效果在 PT 里看' },
    { key: 'zoneSunAz', type: 'vec3', sub: ['层1 方位°', '层2 方位°', '层3 方位°'], min: 0, max: 360, step: 1, def: [360, 360, 360], note: '每层各自的水平来向 — 想让某层避开背光就单独转它' },
    { key: 'zoneSunEl', type: 'vec3', sub: ['层1 高度°', '层2 高度°', '层3 高度°'], min: 5, max: 90, step: 1, def: [48, 48, 48], note: '每层各自的太阳高度角' },
    { key: 'zoneSunInt', type: 'vec3', sub: ['层1 强度', '层2 强度', '层3 强度'], min: 0, max: 8, step: 0.1, def: [2.6, 2.6, 2.6], note: '每层各自的亮度 — 深层偏暗就单独提它' },
    { key: 'zoneSunDist', label: '灯距 (远=更像太阳·共用)', type: 'num', min: 20, max: 400, step: 5, def: 120, note: '灯离黄区越远→光线越接近平行(像太阳)、锥自动收窄保持只罩黄区。三层共用' },
    { key: 'zoneSunSpread', label: '光锥余量 (×黄区·共用)', type: 'num', min: 0.6, max: 3, step: 0.1, def: 1.4, note: '光锥相对黄区半径的覆盖倍数; 1=刚好, 大=带边距, 太大会扫到镜面。三层共用' },
    { key: 'zoneSunSoft', label: '光斑柔边 (半影·共用)', type: 'num', min: 0, max: 1, step: 0.05, def: 0.6, note: '光斑边缘柔化; 0=硬边圆圈, 1=最柔。三层共用' },
  ] },
  { folder: '地形', collapsed: true, items: [
    { key: 'showTerrain', label: '地形 (起伏·按层)', type: 'bool', def: true, note: '总开关。范围=黄色安全区; 基面=层底斜面; 跨缝轮廓出自同一连续场' },
    { key: 'terrainL1', label: '地形·层1', type: 'bool', def: true, note: '单层隐藏 → 检查层间衔接/第二层起始高度在取景框里的位置' },
    { key: 'terrainL2', label: '地形·层2', type: 'bool', def: true },
    { key: 'terrainL3', label: '地形·层3', type: 'bool', def: true },
    { key: 'terrainOpacity', label: '地形不透明度', type: 'num', min: 0.15, max: 1, step: 0.05, def: 1, note: '半透明 → 透视检查各层地面高度是否吻合衔接' },
    { key: 'terrainTint', label: '地形按层着色 (红绿蓝)', type: 'bool', def: true, note: '检查工具: 一眼分清哪块地形属于哪层(配合单层开关/半透明排查遮挡与衔接)' },
    { key: 'terrainAmp', label: '起伏幅度 (×层高)', type: 'num', min: 0, max: 1, step: 0.01, def: 0.2, note: '幅度=层高×系数, 深层自动更大(W₁<W₂<W₃); 太高会挡住后层(作者预言过的遮挡)' },
    { key: 'terrainWaves', label: '起伏尺度 (波数)', type: 'num', min: 1, max: 8, step: 0.5, def: 4, note: '一层里大约几座山; 小=缓丘, 大=碎丘' },
    { key: 'terrainSeed', label: '地形种子', type: 'int', min: 1, max: 999, step: 1, def: 377, note: '换一个数=换一套地貌; 同种子永远长同样的山' },
    { key: 'terrainHead', label: '首层前缘贴地 (×层深)', type: 'num', min: 0, max: 0.6, step: 0.05, def: 0.6, note: '仅第一层面对M₁的前边贴地(它前面无可衔接物); 其余层正常起伏, 接缝靠对齐衔接隐藏(近脊遮远口)' },
    { key: 'terrainEnd1', label: '层1 结尾抬升 (×层高)', type: 'num', min: 0, max: 1.5, step: 0.01, def: 0.07, note: '坡度基线(链式): 首层起点恒贴地(一条线)→爬到此值; 层2起点自动=层1结尾(σ域冻结带保证严格相等)' },
    { key: 'terrainEnd2', label: '层2 结尾抬升 (×层高)', type: 'num', min: 0, max: 1.5, step: 0.01, def: 0.26, note: '层2从层1结尾起步→爬到此值; 层3起点自动对齐' },
    { key: 'terrainEnd3', label: '层3 结尾抬升 (×层高)', type: 'num', min: 0, max: 1.5, step: 0.01, def: 0.5, note: '末层结尾; 调三个结尾=控制整体坡度走势(噪声起伏叠加在基线之上); 太高会顶穿锥顶' },
    { key: 'showFloor', label: '层地面 (倾斜·安全段)', type: 'bool', def: false, note: '调试参考; 地形接管地面后默认关(与地形基面共面会 z-fighting 条纹)' },
    { key: 'showFloorBug', label: '层地面·穿帮段 (红)', type: 'bool', def: false, note: '伸进下一段光锥的部分, 会被错误镜链斜看成面; 默认隐藏备查' },
    { key: 'showGround', label: '水平地面 (世界地)', type: 'bool', def: false, note: '默认隐藏(作者: 平坦灰地反而压缩空间感, 用地形起伏拉深浅); 水平面是45°镜系统不变量→各段无缝拼接、错链自遮盖' },
    { key: 'groundY', label: '地面高度 (相对Σ·负=下)', type: 'num', min: -150, max: -5, step: 1, def: -30, note: '原始单位; 仅水平地面与"无地形时人物落点兜底"用; 地形基面=层底斜面, 与此无关' },
  ] },
  { folder: '人物', items: [
    { key: 'showFigures', label: '人物 (每层人群)', type: 'bool', def: true, note: '每个有地形的安全区放 N 人(种子确定性编排, 三层不雷同, 红绿蓝=不同的人/世界/人生但同框); 行走时同层内结伴+相遇交谈' },
    { key: 'peopleMax', label: '每区人数 (上限)', type: 'int', min: 1, max: 6, step: 1, def: 4, note: '每个黄区人数上限; 实际人数按种子在 1..上限 间变化(各层不同)。越多越吃 PT, 按真机调' },
    { key: 'figureTint', label: '人物按层着色 (红绿蓝)', type: 'bool', def: true, note: '独立于地形着色: 关=人物统一米白色(便于在关掉地形红绿蓝时单独控制人物配色)' },
    { key: 'figureH', label: '人物身高', type: 'num', min: 10, max: 300, step: 1, def: 80, note: '原始单位 (取景框高默认40作参照); 脚自动贴地形' },
    { key: 'figureWalk', label: '人物行走 (无规则游走)', type: 'bool', def: false, ref: 'figureWalk', note: '在各层安全区内无规则游走(朝随机航点走, 到了换航点; 结伴同行+相遇交谈), 脚贴地形、关节摆动、互相不穿模。开"动态PT"可走动实时看、停走凝固; 关则与PT互斥(走动退PT)' },
    { key: 'walkSpeed', label: '行走速度', type: 'num', min: 10, max: 200, step: 5, def: 20, note: '原始单位/秒' },
    { key: 'figureFixed', label: '人物固定世界坐标 (穿越)', type: 'bool', def: false, ref: 'figureFixed', note: '钉住【层1的人】(其余人不受影响); 拖镜距/取景框让分层扫过他 → 单见→重影→换层(结构性穿越, 档案·开放方向5)' },
    { key: 'editDrag', label: '编辑·拖拽布景/人物', type: 'bool', def: false, note: '单视口模式生效; 按住块/人直接拖, 位置存档(重建后保留); 沿相机平行面移动' },
  ] },
  { folder: '渲染 (反射·路径追踪)', items: [
    { key: 'realMirror', label: '真实反射 (Reflector·实时)', type: 'bool', def: false, ref: 'realMirror' },
    { key: 'pathTrace', label: '路径追踪 (高保真·渐进)', type: 'bool', def: true, ref: 'pathTrace' },
    { key: 'ptScale', label: '渲染分辨率 (低=糊但快)', type: 'num', min: 0.25, max: 1, step: 0.05, def: 1, ref: 'ptScale', note: '★模糊主因: 0.5=半分辨率上采样→糊; 1=全分辨率最清晰(更吃 GPU)' },
    { key: 'ptBounces', label: '光线反弹次数', type: 'int', min: 1, max: 16, step: 1, def: 10, ref: 'ptBounces', note: '嵌套镜子要看到深层反射需更多反弹; 越高越准也越慢' },
    { key: 'ptSamples', label: '采样上限 (越高越干净)', type: 'int', min: 16, max: 512, step: 16, def: 512, ref: 'ptSamples', note: '累积到此样本数停止; 越高噪点越少, 收敛更久' },
    { key: 'ptDynamic', label: '动态PT (走动实时·停走凝固)', type: 'bool', def: true, note: '行走+PT 同开时生效: 低分辨率每帧1采样=活的噪点画面(真实反射含二三层运动); 停走→全分辨率累积"凝固"成形。拓扑不变走 BVH refit 快路径' },
    { key: 'ptDynScale', label: '动态PT分辨率', type: 'num', min: 0.2, max: 0.6, step: 0.05, def: 0.6, note: '走动期间的渲染分辨率(低=流畅); 定格后自动恢复「渲染分辨率」设置' },
  ] },
  { folder: '多世界 (一生二三)', collapsed: true, items: [
    { key: 'worldCount', label: '世界数 N', type: 'int', min: 1, max: 6, step: 1, def: 1, gh: '8/11', note: 'N=2→C₂; N=3→C₃。注: 取景框视口只看一个世界的镜链, 多世界仅外部视角可见' },
  ] },
  { folder: '动画', collapsed: true, items: [
    { key: 'expand', label: '展开 t', type: 'num', min: 0, max: 1, step: 0.001, def: 1, gh: 7, ref: 'expand' },
    { key: 'autoPlay', label: '自动展开循环', type: 'bool', def: false, ref: 'autoPlay', note: '与路径追踪互斥(每帧重建几何, PT 跟着每帧全量重建会冻死)' },
    { key: 'autoRotate', label: '缓慢自转', type: 'bool', def: false },
  ] },
  { folder: '显示 (脚手架·调试)', collapsed: true, items: [
    { key: 'showSeed', label: 'Σ+F', type: 'bool', def: true },
    { key: 'showBeam', label: '中心光路', type: 'bool', def: true },
    { key: 'showFrustum', label: '视锥角光线', type: 'bool', def: true },
    { key: 'showWorlds', label: '镜面/活动域 W', type: 'bool', def: true },
    { key: 'showUsable', label: '黄·安全布景区', type: 'bool', def: false, ref: 'showUsable' },
    { key: 'showBug', label: '红·易穿帮区', type: 'bool', def: false, ref: 'showBug' },
    { key: 'showActiveVol', label: '锥段脚手架', type: 'bool', def: false },
    { key: 'showLabels', label: '角点编号', type: 'bool', def: true },
    { key: 'showMirrorId', label: '镜面编号 M#', type: 'bool', def: true },
    { key: 'showGrid', label: '九宫格视线投影', type: 'bool', def: true },
    { key: 'showScenery', label: '测试体块 (红绿蓝立方·已退役)', type: 'bool', def: false, note: '早期占位测试块; 有人物后默认关, 需要时再开来对位/调试' },
  ] },
];

// 由 schema 生成初始参数对象 (取各项默认值; 数组深拷贝)
export function defaultParams(schema = PARAM_SCHEMA) {
  const p = {};
  for (const grp of schema) for (const it of grp.items) p[it.key] = Array.isArray(it.def) ? it.def.slice() : it.def;
  return p;
}
