// 场景初始化 (RENDER 层): 渲染器/场景/相机/控制器 + 天空环境(equirect 渐变) + 太阳 + resize。
// 调一次 createScene(params) 拿到 { renderer, scene, camera, controls, sun, sky, updateEnv }; 与几何/世界无关。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GradientEquirectTexture } from 'three-gpu-pathtracer'; // equirect 天空 → 光栅+PT 共用, PT 不再发黑

export function createScene(params) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // 天空环境: equirect 渐变(顶色=天顶/底色=地平), 同时作背景 + 环境反射/IBL。
  // 是 DataTexture → 路径追踪器能直接吃 (不再 env=null 黑底); 金属镜面也反射这片天。
  const sky = new GradientEquirectTexture(256);
  sky.topColor.set(0x4a78b8);      // 天顶蓝 (默认, 由 params 覆盖)
  sky.bottomColor.set(0xd8c4a8);   // 地平暖
  sky.exponent = 1.3;
  sky.update();
  scene.background = sky;
  scene.environment = sky;

  const aspect = innerWidth / innerHeight;
  const persp = new THREE.PerspectiveCamera(50, aspect, 0.02, 5000); // 透视图
  persp.position.set(8, 8, 12);
  const ortho = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.01, 5000); // 正交(正视/顶视/侧视/轴测)
  const eyeCam = new THREE.PerspectiveCamera(14, aspect, 0.005, 5000); // Σ 眼睛(观者透过 F 所见)
  const state = { camera: persp }; // 当前激活相机

  const controls = new OrbitControls(state.camera, renderer.domElement);
  controls.enableDamping = true;

  // 太阳 = 唯一方向光 (方位角/高度角/强度由 params 控制); 环境补光由天空 IBL 提供, 光栅与 PT 一致
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  scene.add(sun);
  scene.add(sun.target); // target 默认 (0,0,0), 平行光只看方向
  scene.add(new THREE.GridHelper(80, 80, 0x2a3a4a, 0x151c24)); // 1 格 = 1 单位 = 100 原始单位

  // 由 params 更新太阳方向/强度 + 天空两色 (供侧边栏滑块实时调; PT 侧另调 updateLights/updateEnvironment)
  function updateEnv(p) {
    const az = THREE.MathUtils.degToRad(p.sunAz), el = THREE.MathUtils.degToRad(p.sunEl);
    sun.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(80);
    sun.intensity = p.sunIntensity;
    sky.topColor.set(p.skyTop);
    sky.bottomColor.set(p.skyHorizon);
    sky.update(); // 重生成 equirect 数据 (PT 端需再 updateEnvironment)
  }
  if (params) updateEnv(params); // 初始即按 params 设好

  const onResize = () => {
    if (!innerWidth || !innerHeight) return;
    const a = innerWidth / innerHeight;
    persp.aspect = a; persp.updateProjectionMatrix();
    eyeCam.aspect = a; eyeCam.updateProjectionMatrix();
    const h = ortho.top; ortho.left = -h * a; ortho.right = h * a; ortho.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);
  new ResizeObserver(onResize).observe(document.body); // 防加载竞态: body 一拿到尺寸就校正

  const useCamera = (cam) => { state.camera = cam; controls.object = cam; controls.update(); };

  return { renderer, scene, controls, persp, ortho, eyeCam, getCamera: () => state.camera, useCamera, sun, sky, updateEnv };
}
