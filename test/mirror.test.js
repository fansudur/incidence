// 锁住装置的"宇宙常数": 45° 镜面 → 光路转 90°; 反射与求交的正确性。
import { test, assert, near, nearVec } from './harness.js';
import { mirrorNormal, reflectDir, rayPlane } from '../src/core/mirror.js';
import { traceFrustum } from '../src/core/frustum.js';
import { v, len, dot, sub, normalize } from '../src/core/vec.js';

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

test('同一平面反射两次 = 恒等 (对合性)', () => {
  const n = mirrorNormal(45);
  const d2 = reflectDir(reflectDir(v(1, 0, 0), n), n);
  assert(nearVec(d2, 1, 0, 0), '关于同一平面反射两次应回到原方向');
});

test('装置语义的回环: 全 45° 时中心光路逐段转 90° (zig-zag), 每段方向与上一段垂直', () => {
  // 旧测试名声称"4 镜转回 360°"但循环结果从未被断言(死计算, 审查发现) — 改用真实追迹锁装置不变量
  const r = traceFrustum({ mAngle: [45, 45, 45], mDist: [550, 359, 634], layerCount: 3, fDist: 170, frameW: 60, frameH: 40 });
  const bm = r.beam; // [Σ, M₁心, M₂心, M₃心, 收尾镜心]
  assert(bm.length >= 4, '中心光路应至少有 4 个点');
  const dirs = [];
  for (let i = 0; i + 1 < bm.length; i++) dirs.push(normalize(sub(bm[i + 1], bm[i])));
  assert(nearVec(dirs[0], 1, 0, 0), '第一段应沿 +X');
  for (let i = 0; i + 1 < dirs.length; i++) {
    assert(near(dot(dirs[i], dirs[i + 1]), 0), `第${i}→${i + 1}段应垂直 (45°→转90°)`);
    assert(near(Math.abs(dirs[i].y), 0), '中心光路应保持水平');
  }
  // 同法向 zig-zag: 第 i 段与第 i+2 段同向 (每两折回到原方向)
  if (dirs.length >= 3) assert(near(dot(dirs[0], dirs[2]), 1), '隔段应同向 (zig-zag)');
});
