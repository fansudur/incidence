// 三视口子系统 (RENDER 层): 左大透视 + 右上顶视 + 右下正视, 像三维软件; 分隔条可拖动改大小。
// 从 index.html 平移归位(审查建议, 逻辑不变)。含全项目最微妙的交互代码:
// window 捕获阶段的 pointerdown/wheel 路由 —— 抢在 OrbitControls(挂 canvas、注册更早)之前
// 决定哪套控制器响应 / 拦截分隔条拖拽。两台正交相机与控制器由本模块自持。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// getMainCamera: 主视口显示"当前视图"的相机(可以是 Σ眼/透视/正交) — 这样在 Σ 观影位也能开三视口,
// 旁边两个视口同时看模型整体(作者工作流: 盯取景框成像的同时拖镜距/框距看模型变化)。
export function createMultiview({ renderer, scene, controls, viewState, getWorldGroup, getMainCamera, onExited }) {
  const vpTop = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 5000);   // 顶视
  const vpFront = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 5000); // 正视
  const ctrlTop = new OrbitControls(vpTop, renderer.domElement); ctrlTop.enableDamping = true; ctrlTop.enabled = false;
  const ctrlFront = new OrbitControls(vpFront, renderer.domElement); ctrlFront.enableDamping = true; ctrlFront.enabled = false;

  function viewports() { // 各视口的像素矩形(WebGL 原点在左下) + 相机 + 控制器; 避开右侧 GUI 面板
    const guiW = (document.querySelector('.lil-gui')?.offsetWidth || 0) + 8;
    const W = Math.max(200, innerWidth - guiW), H = innerHeight;
    const mainW = Math.round(W * viewState.splitX), topH = Math.round(H * viewState.splitY);
    return [
      { cam: getMainCamera(), ctrl: controls, x: 0, y: 0, w: mainW, h: H, main: true }, // 主视口 = 当前视图相机
      { cam: vpTop, ctrl: ctrlTop, x: mainW, y: H - topH, w: W - mainW, h: topH, dir: [0, 1, 0.001], up: [0, 0, -1] },
      { cam: vpFront, ctrl: ctrlFront, x: mainW, y: 0, w: W - mainW, h: H - topH, dir: [0, 0, 1], up: [0, 1, 0] },
    ];
  }
  function frameViewports() { // 把两个正交视口取景到模型(透视口由其 OrbitControls 管)
    const worldGroup = getWorldGroup();
    if (!worldGroup) return;
    const box = new THREE.Box3().setFromObject(worldGroup);
    if (box.isEmpty()) return;
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const c = sph.center, R = sph.radius || 1;
    for (const vp of viewports()) {
      if (vp.main) continue;
      const cam = vp.cam, a = vp.w / vp.h, m = R * 1.15;
      cam.left = -m * a; cam.right = m * a; cam.top = m; cam.bottom = -m; cam.near = 0.01; cam.far = R * 40;
      cam.up.set(...vp.up);
      cam.position.copy(c).add(new THREE.Vector3(...vp.dir).normalize().multiplyScalar(R * 8));
      cam.lookAt(c); cam.updateProjectionMatrix();
      vp.ctrl.target.copy(c); vp.ctrl.update();
    }
  }
  // 鼠标在哪个视口 / 是否压在分隔条上(屏幕坐标, 原点左上)
  function vpAtPointer(px, py) {
    for (const vp of viewports()) {
      const yTop = innerHeight - (vp.y + vp.h);
      if (px >= vp.x && px <= vp.x + vp.w && py >= yTop && py <= innerHeight - vp.y) return vp;
    }
    return null;
  }
  function dividerAtPointer(px, py) {
    const guiW = (document.querySelector('.lil-gui')?.offsetWidth || 0) + 8;
    const W = Math.max(200, innerWidth - guiW), mainW = Math.round(W * viewState.splitX), topH = Math.round(innerHeight * viewState.splitY);
    if (px < W && Math.abs(px - mainW) <= 5) return 'v';              // 左右分隔条
    if (px > mainW && px < W && Math.abs(py - topH) <= 5) return 'h'; // 上下分隔条(右栏内)
    return null;
  }
  let dragDiv = null;
  function routeControls(px, py) { // 按指针位置启停三套控制器 (pointerdown / wheel 共用)
    const vp = vpAtPointer(px, py);
    controls.enabled = !!(vp && vp.main);
    ctrlTop.enabled = !!(vp && vp.cam === vpTop);
    ctrlFront.enabled = !!(vp && vp.cam === vpFront);
  }
  window.addEventListener('pointerdown', (e) => {
    if (!viewState.multi) return;
    const d = dividerAtPointer(e.clientX, e.clientY);
    if (d) { // 拖分隔条(抢在 OrbitControls 之前)
      e.stopImmediatePropagation();
      dragDiv = d;
      const move = (ev) => {
        if (!(ev.buttons & 1)) return up();      // 窗口外松开丢 pointerup → 靠按键状态自愈, 防分隔条粘鼠标
        const guiW = (document.querySelector('.lil-gui')?.offsetWidth || 0) + 8, W = Math.max(200, innerWidth - guiW);
        if (dragDiv === 'v') viewState.splitX = Math.min(0.85, Math.max(0.2, ev.clientX / W));
        else viewState.splitY = Math.min(0.85, Math.max(0.15, ev.clientY / innerHeight));
        frameViewports();
      };
      const up = () => { dragDiv = null; removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
      return;
    }
    routeControls(e.clientX, e.clientY);
  }, true);
  renderer.domElement.addEventListener('pointermove', (e) => { // 分隔条上换光标
    if (!viewState.multi || dragDiv) return;
    const d = dividerAtPointer(e.clientX, e.clientY);
    renderer.domElement.style.cursor = d === 'v' ? 'col-resize' : d === 'h' ? 'row-resize' : '';
  });
  window.addEventListener('wheel', (e) => { // 滚轮缩放路由到鼠标所在视口(同样抢在 OrbitControls 前)
    if (!viewState.multi) return;
    routeControls(e.clientX, e.clientY);
  }, true);

  function fitCam(cam, w, h) { // 任意相机适配矩形宽高比(正交保留用户缩放 top/bottom)
    const a = w / h;
    if (cam.isPerspectiveCamera) { if (Math.abs(cam.aspect - a) > 1e-6) { cam.aspect = a; cam.updateProjectionMatrix(); } }
    else { cam.left = -cam.top * a; cam.right = cam.top * a; cam.updateProjectionMatrix(); }
  }
  // tryPTInMain(x,y,w,h) 可选: 返回 true 表示主视口这帧由路径追踪绘制(钩子自管相机比例与采样),
  // 否则主视口走光栅。两个副视口永远光栅实时 — 这就是"Σ位盯成像 + 旁边看模型"的工作流。
  function render(tryPTInMain) {
    ctrlTop.update(); ctrlFront.update();
    const g = 2; // 视口间隙(像素)
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
    renderer.setClearColor(0x1a2530, 1); renderer.clear(); // 整屏底色 = 视口边框色
    renderer.setScissorTest(true);
    for (const vp of viewports()) {
      const w = vp.w - 2 * g, h = vp.h - 2 * g;
      renderer.setViewport(vp.x + g, vp.y + g, w, h);
      renderer.setScissor(vp.x + g, vp.y + g, w, h);
      if (vp.main && tryPTInMain && tryPTInMain(vp.x + g, vp.y + g, w, h)) continue; // PT 已画主视口
      if (vp.main) fitCam(vp.cam, w, h);
      renderer.render(scene, vp.cam);
    }
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 1);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
  }
  function exit() { // 退三视口 → 恢复单视口渲染状态(当前主相机回全屏宽高比)
    viewState.multi = false;
    controls.enabled = true; ctrlTop.enabled = false; ctrlFront.enabled = false;
    renderer.domElement.style.cursor = '';
    fitCam(getMainCamera(), innerWidth, innerHeight);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
    onExited?.();
  }
  function onResize() { // 两台正交相机只校宽高比(保留用户平移/缩放, 不整体重取景)
    for (const vp of viewports()) {
      if (vp.main) continue;
      const a = vp.w / vp.h;
      vp.cam.left = -vp.cam.top * a; vp.cam.right = vp.cam.top * a; vp.cam.updateProjectionMatrix();
    }
  }
  return { frameViewports, render, exit, onResize, vpAt: vpAtPointer, dividerAt: dividerAtPointer };
}
