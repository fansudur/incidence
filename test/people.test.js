// 锁住人群编排: 确定性(同种子同结果)、人数在 [1,上限]、同组共享方向/速度(结伴)、三层不雷同。
import { test, assert } from './harness.js';
import { peoplePlan } from '../src/core/activity.js';

test('peoplePlan 确定性: 同 (seed,gap,max) 必得同结果 (可复现/预设稳定)', () => {
  const a = peoplePlan(7, 0, 3), b = peoplePlan(7, 0, 3);
  assert(JSON.stringify(a) === JSON.stringify(b), '同输入应完全一致');
});

test('peoplePlan 人数落在 [1, 上限]', () => {
  for (let gap = 0; gap < 5; gap++) for (let max = 1; max <= 6; max++) {
    const n = peoplePlan(7, gap, max).length;
    assert(n >= 1 && n <= max, `gap${gap} max${max} → n=${n} 越界`);
  }
});

test('peoplePlan 同组共享 speed (结伴同行), 相位贴近', () => {
  // 找一个有 2 人同组的种子
  let plan = null;
  for (let s = 1; s < 50 && !plan; s++) { const p = peoplePlan(s, 0, 4); if (p.some((x, i) => p.some((y, j) => i !== j && x.group === y.group))) plan = p; }
  assert(plan, '应能找到含结伴的编排');
  const byGroup = {};
  for (const p of plan) (byGroup[p.group] ??= []).push(p);
  for (const g of Object.values(byGroup)) if (g.length >= 2) {
    assert(g.every((x) => x.speed === g[0].speed), '同组速度应一致(结伴同步)');
    assert(Math.abs(((g[1].phase - g[0].phase) % 1)) < 0.2, '同组相位应贴近(结伴)');
  }
});

test('peoplePlan 三层不雷同 (种子按 gap 偏移)', () => {
  const sig = (gap) => JSON.stringify(peoplePlan(7, gap, 3));
  assert(!(sig(0) === sig(1) && sig(1) === sig(2)), '三层编排不应完全相同');
});
