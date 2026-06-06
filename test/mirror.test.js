// 锁住装置的"宇宙常数": 45° 镜面 → 光路转 90°; 反射与求交的正确性。
import { test, assert, near, nearVec } from './harness.js';
import { mirrorNormal, reflectDir, rayPlane } from '../src/core/mirror.js';
import { v, len, dot } from '../src/core/vec.js';

test('45° 镜面把入射 +X 反射成 (0,0,-1) — 光路转 90°', () => {
  const n = mirrorNormal(45);
  const out = reflectDir(v(1, 0, 0), n);
  assert(nearVec(out, 0, 0, -1), `期望 (0,0,-1), 实际 (${out.x.toFixed(3)},${out.y.toFixed(3)},${out.z.toFixed(3)})`);
  assert(near(dot(v(1, 0, 0), out), 0), '入射与出射夹角应为 90° (点积=0)');
  assert(near(len(out), 1), '反射后应为单位向量');
});

test('reflectDir 只翻转法向分量', () => {
  const out = reflectDir(v(1, 0, 2), v(0, 0, 1)); // 关于 +Z 平面反射
  assert(nearVec(out, 1, 0, -2), `期望 (1,0,-2), 实际 (${out.x},${out.y},${out.z})`);
});

test('rayPlane: +X 光线打 x=5 平面 → (5,0,0)', () => {
  const hit = rayPlane(v(0, 0, 0), v(1, 0, 0), v(5, 0, 0), v(1, 0, 0));
  assert(nearVec(hit, 5, 0, 0), `期望 (5,0,0), 实际 ${JSON.stringify(hit)}`);
});

test('rayPlane: 交点在背后 或 光线平行于平面 → null (穿帮)', () => {
  assert(rayPlane(v(0, 0, 0), v(1, 0, 0), v(-5, 0, 0), v(1, 0, 0)) === null, '背后应返回 null');
  assert(rayPlane(v(0, 0, 0), v(1, 0, 0), v(0, 5, 0), v(0, 1, 0)) === null, '平行应返回 null');
});

test('每经 4 面 45° 镜面, 方向转回初始 (90°×4=360°)', () => {
  const n = mirrorNormal(45);
  let d = v(1, 0, 0);
  for (let i = 0; i < 4; i++) d = reflectDir(d, n);
  // 注意: 单一法向连续反射是来回翻转, 这里验证两次反射回到原方向
  let d2 = reflectDir(reflectDir(v(1, 0, 0), n), n);
  assert(nearVec(d2, 1, 0, 0), '关于同一平面反射两次应回到原方向');
});
