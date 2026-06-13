// 锁住预设并入逻辑: 数组必须原地改(保持引用→不脱钩 vec3 控制器)、未知键忽略、标量覆盖。
import { test, assert } from './harness.js';
import { mergeParams } from '../src/app/presets.js';

test('mergeParams 原地改数组 (引用不变 → vec3 控制器不脱钩)', () => {
  const target = { mAngle: [45, 45, 45], fDist: 170 };
  const ref = target.mAngle;                       // 记住原数组引用(控制器绑的就是它)
  mergeParams(target, { mAngle: [30, 60, 90], fDist: 200 });
  assert(target.mAngle === ref, '数组应原地改, 引用不能换');
  assert(JSON.stringify(target.mAngle) === JSON.stringify([30, 60, 90]), '数组元素已更新');
  assert(target.fDist === 200, '标量覆盖');
});

test('mergeParams 忽略未知键 (向后兼容)', () => {
  const target = { fDist: 170 };
  mergeParams(target, { fDist: 200, ghostKey: 999 });
  assert(target.fDist === 200 && !('ghostKey' in target), '未知键不应注入');
});

test('mergeParams 缺省键保持原值 (旧预设少字段时)', () => {
  const target = { fDist: 170, frameW: 60 };
  mergeParams(target, { fDist: 200 });
  assert(target.fDist === 200 && target.frameW === 60, '未提供的键保持不变');
});
