// 路径追踪调度器: 状态机(pathTracer / ready / 代际令牌 / 微任务合并)与全部 PT 生命周期操作内聚于此,
// 装配层(index.html)只调方法, 不再直接摸 ptReady/ptQueued 裸状态。
// 经验铭牌(实战换来的, 勿回退):
//  - schedule 微任务合并: 启动同步链里多次重复请求只构建一次(此前启动连跑 4 次全量 BVH)
//  - 代际令牌: setScene 期间几何又变 → 不以旧 BVH 置 ready
//  - 动态行走帧: 库默认四件套(renderDelay=100 / minSamples=5 / fade=500 / tiles=3×3)在
//    "每帧重置"模式下会让画面永远出不来(灰墙); 动态期间全部归零+整帧单块, 定格时恢复
import { WebGLPathTracer } from 'three-gpu-pathtracer';

export function createPTScheduler({ renderer, scene, params, getCamera, getHidden }) {
  let pathTracer = null, ready = false;
  let gen = 0, queued = false; // 代际令牌(过期 setScene 不置 ready) / 微任务合并(一帧内多次请求只构建一次)

  async function prepare() { // 场景/相机变化时(重)建 BVH; 主循环 renderSample 渐进累积
    const my = ++gen;
    ready = false;
    try {
      if (!pathTracer) pathTracer = new WebGLPathTracer(renderer);
      pathTracer.renderScale = params.ptScale;  // 分辨率(模糊主因, 默认 1=全分辨率); 「路径追踪精度」滑块控制
      pathTracer.bounces = params.ptBounces;    // 光线反弹次数(嵌套镜子看深层反射需更多)
      const hidden = getHidden().filter((o) => o.visible);
      for (const o of hidden) o.visible = false; // 坐标轴手柄等编辑器具不进 BVH(traverseVisible 收集)
      try { await pathTracer.setScene(scene, getCamera()); } // scene.environment = equirect 天空, PT 直接吃
      finally { for (const o of hidden) o.visible = true; }
      if (my !== gen) return;                   // setScene 期间几何又变了 → 不以旧 BVH 置 ready
      ready = true;
    } catch (e) { console.warn('路径追踪初始化失败:', e); }
  }

  function schedule() { // 所有"需要重建 PT"的请求一律走这里
    if (!params.pathTrace) { ready = false; return; }
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; prepare(); });
  }

  function intoRect(x, y, w, h) { // 三视口主视口钩子: 自管相机比例(变了才 updateCamera, 它会清空累积)与采样;
    if (!(params.pathTrace && ready)) return false; // 收敛后用 pausePathTracing 继续呈现(三视口每帧清屏, 不呈现就黑)
    const cam = getCamera();
    if (cam.isPerspectiveCamera) {
      const a = w / h;
      if (Math.abs(cam.aspect - a) > 1e-6) { cam.aspect = a; cam.updateProjectionMatrix(); pathTracer.updateCamera(); }
    }
    pathTracer.pausePathTracing = pathTracer.samples >= params.ptSamples; // 到上限停采但继续画
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.setScissorTest(true);
    pathTracer.renderSample();
    return true;
  }

  function renderFullFrame() { // 单视口分支: 渐进累积到上限后停(省 GPU); 没接管时返回 false 走光栅
    if (!(params.pathTrace && ready)) return false;
    pathTracer.pausePathTracing = false;        // 清掉三视口模式可能留下的暂停位
    if (pathTracer.samples < params.ptSamples) pathTracer.renderSample();
    return true;
  }

  function dynamicWalkFrame() { // 动态PT(行走逐帧): 拓扑不变只动了人 → setScene 内部走 GEOMETRY_ADJUSTED→bvh.refit(快路径)
    if (!(params.pathTrace && params.ptDynamic && pathTracer && ready && !queued)) return; // → 每帧 1 采样=活的噪点画面
    pathTracer.renderDelay = 0; pathTracer.minSamples = 1; pathTracer.fadeDuration = 0;
    pathTracer.tiles.set(1, 1);
    pathTracer.renderScale = params.ptDynScale ?? 0.35; // 低分辨率保流畅
    const hidden = getHidden().filter((o) => o.visible);
    for (const o of hidden) o.visible = false;
    try { pathTracer.setScene(scene, getCamera()); } finally { for (const o of hidden) o.visible = true; }
  }

  function freezeWalk() { // 停走定格: 恢复全分辨率与库默认节奏(500ms 渐显正好是"凝固感") → rebuild 后重新累积
    if (!(params.pathTrace && pathTracer)) return;
    pathTracer.renderScale = params.ptScale;
    pathTracer.renderDelay = 100; pathTracer.minSamples = 5; pathTracer.fadeDuration = 500;
    pathTracer.tiles.set(3, 3); // 恢复分块(库默认, 探针实测值; 收敛期分块可保持页面响应)
  }

  return {
    get ready() { return ready; },
    schedule,
    invalidate: () => { ready = false; },       // 拖动/抬升等"回光栅实时预览"时刻
    applyOpts() {                                // 精度滑块: 不重建几何/BVH, 只重置累积 → 拖动即时生效
      if (!pathTracer) return;
      pathTracer.renderScale = params.ptScale;
      pathTracer.bounces = params.ptBounces;
      pathTracer.reset();                        // samples 归 0, 用新设置重新干净累积
    },
    refreshEnv() { if (pathTracer && ready) { pathTracer.updateLights(); pathTracer.updateEnvironment(); pathTracer.reset(); } },
    onCameraMoved() { if (params.pathTrace && pathTracer) pathTracer.updateCamera(); },      // 相机真动了才重置累积
    updateCameraNow() { if (params.pathTrace && pathTracer) pathTracer.updateCamera(); },    // 轻量摆位类(Σ眼视野)
    updateCameraIfReady() { if (params.pathTrace && pathTracer && ready) pathTracer.updateCamera(); }, // resize/退三视口重拍投影快照
    viewChanged(visChanged) { // 切视图: 场景内容变了须重建 BVH; 否则纯换相机走库的 setCamera(零 BVH 开销)
      if (!params.pathTrace) return;
      if (visChanged || !ready) schedule();
      else pathTracer.setCamera(getCamera());
    },
    intoRect,
    renderFullFrame,
    dynamicWalkFrame,
    freezeWalk,
  };
}
