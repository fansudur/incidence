// 编辑·拖拽子系统: TransformControls 坐标轴手柄(箭头=约束轴, 平面块=面内) + 自由体拖拽 两套并存(C4D 式)。
// window 捕获阶段抢在 OrbitControls 前接管; 沿"过抓取点的相机平行面"移动(正交视口=屏幕平面, 顶视拖=平面布局)。
// 三视口下按【指针所在视口】的相机+局部坐标拾取 → 三个视口都能拖(作者要求); 坐标轴手柄仅单视口(全屏坐标系限制)。
// 拖动中 PT 回光栅实时预览, 松手 schedulePT 重建 BVH; 位置入 placed 存档(重建后由 worldView 套用)。
// 指针监听用 AbortController 卸载: 一次 abort 同时卸 move+up, move 中途抛错也不留监听。
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export function createEditorDrag({ scene, domElement, camera, controls, params, viewState, mv, placed, getCamera, getWorldGroup, schedulePT, invalidatePT }) {
  const gizmo = new TransformControls(camera, domElement);
  gizmo.setSize(0.8);
  scene.add(gizmo);
  let selectedDragId = null; // 当前吸附的对象标识(重建后凭它重新吸附)

  gizmo.addEventListener('dragging-changed', (e) => {
    controls.enabled = !e.value;
    if (e.value) { if (params.pathTrace) invalidatePT(); }       // 拖动中回光栅实时
    else if (gizmo.object) {
      placed[gizmo.object.userData.dragId] = { x: gizmo.object.position.x, y: gizmo.object.position.y, z: gizmo.object.position.z };
      schedulePT();
    }
  });

  const dragRay = new THREE.Raycaster(), dragNdc = new THREE.Vector2();
  const dragPlane = new THREE.Plane(), dragPoint = new THREE.Vector3(), dragOffset = new THREE.Vector3();
  window.addEventListener('pointerdown', (e) => {
    const worldGroup = getWorldGroup();
    if (!params.editDrag || !worldGroup) return;
    if (gizmo.axis || gizmo.dragging) return;          // 指针在坐标轴手柄上 → 让 TransformControls 接管
    let cam = getCamera();
    let toNdc = (px, py) => dragNdc.set((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1);
    if (viewState.multi) {                              // 三视口: 用指针所在视口的相机与矩形映射
      if (mv.dividerAt(e.clientX, e.clientY)) return;   // 分隔条拖拽优先
      const vp = mv.vpAt(e.clientX, e.clientY);
      if (!vp) return;
      cam = vp.cam;
      const yTop = innerHeight - (vp.y + vp.h);
      toNdc = (px, py) => dragNdc.set(((px - vp.x) / vp.w) * 2 - 1, -(((py - yTop) / vp.h) * 2 - 1));
    }
    toNdc(e.clientX, e.clientY);
    dragRay.setFromCamera(dragNdc, cam);
    const roots = [];
    worldGroup.traverse(o => { if (o.userData.dragId) roots.push(o); });
    const hits = dragRay.intersectObjects(roots, true);
    if (!hits.length) {
      if (!viewState.multi) { gizmo.detach(); selectedDragId = null; } // 单视口点空白 → 取消选中
      return;
    }
    let obj = hits[0].object;
    while (obj && !obj.userData.dragId) obj = obj.parent;
    if (!obj) return;
    if (!viewState.multi) { selectedDragId = obj.userData.dragId; gizmo.attach(obj); } // 手柄仅单视口
    e.stopImmediatePropagation();
    dragPlane.setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()), hits[0].point);
    dragOffset.copy(hits[0].point).sub(obj.getWorldPosition(new THREE.Vector3()));
    controls.enabled = false;
    if (params.pathTrace) invalidatePT();
    const ac = new AbortController();
    const up = () => {
      ac.abort();                                       // 同时卸 move+up
      placed[obj.userData.dragId] = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      controls.enabled = true;
      schedulePT();
    };
    const move = (ev) => {
      if (!(ev.buttons & 1)) return up();              // 窗口外松开自愈
      toNdc(ev.clientX, ev.clientY);
      dragRay.setFromCamera(dragNdc, cam);
      if (!dragRay.ray.intersectPlane(dragPlane, dragPoint)) return;
      obj.position.copy(obj.parent.worldToLocal(dragPoint.sub(dragOffset).clone()));
    };
    addEventListener('pointermove', move, { signal: ac.signal });
    addEventListener('pointerup', up, { signal: ac.signal });
  }, true);

  return {
    gizmo,
    detach() { gizmo.detach(); },                       // rebuild 前: 旧对象即将销毁
    reattach(group) { if (selectedDragId) group.traverse(o => { if (o.userData.dragId === selectedDragId) gizmo.attach(o); }); },
    frame() {                                            // 每帧: 手柄跟当前视图相机 + 开关状态
      gizmo.camera = getCamera();
      const on = params.editDrag && !viewState.multi;
      gizmo.enabled = on;
      if (!on && gizmo.object) { gizmo.detach(); selectedDragId = null; } // 关编辑/进三视口 → 收手柄
    },
  };
}
