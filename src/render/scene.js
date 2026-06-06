// 场景初始化 (RENDER 层): 渲染器/场景/相机/控制器/灯光/网格 + 环境反射 + resize。
// 调一次 createScene() 拿到 { renderer, scene, camera, controls }; 与几何/世界无关。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // 环境反射(让金属镜面真有镜面感)

  const aspect = innerWidth / innerHeight;
  const persp = new THREE.PerspectiveCamera(50, aspect, 0.02, 5000); // 透视图
  persp.position.set(8, 8, 12);
  const ortho = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, 0.01, 5000); // 正交(正视/顶视/侧视/轴测); frustum 由 setView 按模型尺寸定
  const eyeCam = new THREE.PerspectiveCamera(14, aspect, 0.005, 5000); // Σ 眼睛(观者透过 F 所见); 位置/fov 由 setView('Σ眼') 按取景框定
  const state = { camera: persp }; // 当前激活相机

  const controls = new OrbitControls(state.camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(5, 9, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.45); rim.position.set(-6, 4, -5); scene.add(rim);
  scene.add(new THREE.GridHelper(80, 80, 0x2a3a4a, 0x151c24)); // 1 格 = 1 单位 = 100 原始单位

  const onResize = () => {
    if (!innerWidth || !innerHeight) return;
    const a = innerWidth / innerHeight;
    persp.aspect = a; persp.updateProjectionMatrix();
    eyeCam.aspect = a; eyeCam.updateProjectionMatrix();
    const h = ortho.top; ortho.left = -h * a; ortho.right = h * a; ortho.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);
  new ResizeObserver(onResize).observe(document.body); // 防加载竞态: body 一拿到尺寸就校正 (初始 innerWidth 可能为 0 → canvas 0×0)

  // 切换激活相机(透视↔正交), 把控制器接到新相机
  const useCamera = (cam) => { state.camera = cam; controls.object = cam; controls.update(); };

  return { renderer, scene, controls, persp, ortho, eyeCam, getCamera: () => state.camera, useCamera };
}
