// 锁住参数 schema: 默认值正确、格式合法、defaultParams 返回独立副本。
import { test, assert } from './harness.js';
import { PARAM_SCHEMA, defaultParams } from '../src/app/params.js';

test('defaultParams 含关键默认值 (与 .gh 实测一致)', () => {
  const p = defaultParams();
  assert(p.layerCount === 3 && p.fDist === 120 && p.frameW === 60 && p.frameH === 33, '取景/层数默认值(作者定版)');
  assert(Array.isArray(p.mAngle) && p.mAngle.length === 3 && p.mAngle.every((a) => a === 45), 'mAngle 全 45° (平行)');
  assert(Array.isArray(p.mDist) && p.mDist[0] === 299 && p.mDist[2] === 1200, 'mDist 作者定版构图');
  assert(p.worldCount === 1 && p.expand === 1, '世界数/展开默认');
  assert(p.showMirrorId === true, '镜面编号默认开');
  assert(p.zoneSun === true && p.skyEnv === false && p.terrainTint === true, '作者定版默认: 分区太阳开/环境天空关/地形按层着色');
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

test('ref 集合锁: index.html 用可选链消费 ctrls[ref], 改名/误删会静默失效 — 此测试把已知清单钉死', () => {
  const refs = [];
  for (const grp of PARAM_SCHEMA) for (const it of grp.items) if (it.ref) refs.push(it.ref);
  const expect = ['autoPlay', 'expand', 'figureFixed', 'figureWalk', 'pathTrace', 'ptBounces', 'ptSamples', 'ptScale',
    'realMirror', 'showBug', 'showUsable', 'skyEnv', 'skyHorizon', 'skyTop', 'sunAz', 'sunEl', 'sunIntensity', 'zoneSun'];
  assert(JSON.stringify(refs.slice().sort()) === JSON.stringify(expect),
    `ref 集合变了: 实际 [${refs.sort().join(',')}] — 若是有意增删, 同步更新此清单与 index.html 的消费处`);
});

test('defaultParams 返回独立数组 (深拷贝, 不污染 schema)', () => {
  const a = defaultParams(); a.mAngle[0] = 99; a.mDist[0] = 1;
  const b = defaultParams();
  assert(b.mAngle[0] === 45 && b.mDist[0] === 299, '两次取默认应互不影响');
});
