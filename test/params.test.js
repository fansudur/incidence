// 锁住参数 schema: 默认值正确、格式合法、defaultParams 返回独立副本。
import { test, assert } from './harness.js';
import { PARAM_SCHEMA, defaultParams } from '../src/app/params.js';

test('defaultParams 含关键默认值 (与 .gh 实测一致)', () => {
  const p = defaultParams();
  assert(p.layerCount === 3 && p.fDist === 170 && p.frameW === 60 && p.frameH === 40, '取景/层数默认值');
  assert(Array.isArray(p.mAngle) && p.mAngle.length === 3 && p.mAngle.every((a) => a === 45), 'mAngle 全 45° (平行)');
  assert(Array.isArray(p.mDist) && p.mDist[0] === 550 && p.mDist[2] === 634, 'mDist 实测值');
  assert(p.worldCount === 1 && p.expand === 1, '世界数/展开默认');
  assert(p.showUsable === true && p.showBug === true && p.showMirrorId === true, 'show 开关默认');
});

test('schema 每项格式合法', () => {
  for (const grp of PARAM_SCHEMA)
    for (const it of grp.items) {
      assert(it.key && it.type, `每项需 key+type: ${JSON.stringify(it)}`);
      if (it.type === 'vec3') assert(Array.isArray(it.def) && it.def.length === 3 && it.sub && it.sub.length === 3, `vec3 需 def[3]+sub[3]: ${it.key}`);
      else if (it.type === 'bool') assert(typeof it.def === 'boolean', `bool def: ${it.key}`);
      else if (it.type === 'color') assert(typeof it.def === 'string' && /^#[0-9a-fA-F]{6}$/.test(it.def), `color def 需 #rrggbb: ${it.key}`);
      else assert(typeof it.def === 'number' && it.min <= it.max, `num/int 范围: ${it.key}`);
    }
});

test('defaultParams 返回独立数组 (深拷贝, 不污染 schema)', () => {
  const a = defaultParams(); a.mAngle[0] = 99; a.mDist[0] = 1;
  const b = defaultParams();
  assert(b.mAngle[0] === 45 && b.mDist[0] === 550, '两次取默认应互不影响');
});
