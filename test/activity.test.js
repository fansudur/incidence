// 锁住活动区: 安全区(黄)与易穿帮区(红)都被算出来, 且穿帮区按"邻锥侧壁"切的水平判定有效。
import { test, assert } from './harness.js';
import { traceFrustum } from '../src/core/frustum.js';
import { safeRegions, bugRegions, sceneryAnchors } from '../src/core/activity.js';
import { v, dist } from '../src/core/vec.js';

const base = { mAngle: [45, 45, 45], mDist: [550, 359, 634], layerCount: 3, fDist: 170, frameW: 60, frameH: 40 };
const S = v(0, 0, 0);
function mcOf(p = base) { const r = traceFrustum(p); return r.endMirror ? [...r.mirrors, r.endMirror] : r.mirrors; }

test('安全区(黄): 每段一块, 每块≥4点', () => {
  const safe = safeRegions(mcOf(), S);
  assert(safe.length >= 2, `应有多段安全区, 实际 ${safe.length}`);
  assert(safe.every((s) => s.points.length >= 4), '每块安全区应有≥4个点');
});

test('易穿帮区(红): 存在, 含 Σ→M₁ 直射锥', () => {
  const bug = bugRegions(mcOf(), S);
  assert(bug.length >= 1, '应有易穿帮区');
  assert(bug.some((b) => b.kind === 'direct'), '应含 Σ→M₁ 直射锥(kind=direct)');
  assert(bug.every((b) => b.points.length >= 4), '每块穿帮区应有≥4个点');
});

test('易穿帮区上下高度 = 本段锥自身 (不被矮的邻锥压低)', () => {
  // 本段锥(M₂→M₃)的 Y 范围, 应等于其穿帮块的 Y 范围(因只做水平切、不切上下)
  const mc = mcOf();
  const yRange = (pts) => { const ys = pts.map((p) => p.y); return Math.max(...ys) - Math.min(...ys); };
  const cone = [...mc[1], ...mc[2]];                  // M₂→M₃ 段锥
  const bug = bugRegions(mc, S).filter((b) => b.gap === 1);
  assert(bug.length > 0, '第1段应有穿帮块');
  const coneY = yRange(cone), bugY = Math.max(...bug.map((b) => yRange(b.points)));
  assert(bugY > coneY * 0.6, `穿帮区高度(${bugY.toFixed(3)})应接近本段锥(${coneY.toFixed(3)}), 不应被压矮`);
});

test('末段安全区: 用收尾镜整截面封死成盒子 (含其 4 角, 不再塌成楔形)', () => {
  const r = traceFrustum(base);
  const mc = [...r.mirrors, r.endMirror];
  const last = safeRegions(mc, S).at(-1);
  const B = r.endMirror;                              // 收尾镜 = 末段后墙
  const hasAllCorners = B.every((bc) => last.points.some((p) => dist(p, bc) < 1e-6));
  assert(hasAllCorners, '末段盒子应包含收尾镜全部 4 角(后墙封死)');
  assert(last.points.length >= 8, `末段应≥8点(完整盒子), 实际 ${last.points.length}`);
});

test('布景锚点: 每层活动区一个, 数量 = 安全区段数, 质心有限', () => {
  const mc = mcOf();
  const anchors = sceneryAnchors(mc, S);
  assert(anchors.length === safeRegions(mc, S).length, `锚点数应=安全区段数, 实际 ${anchors.length}`);
  assert(anchors.every((a) => a.center && Number.isFinite(a.center.x) && Number.isFinite(a.center.y) && Number.isFinite(a.center.z)), '每锚点应有有限质心');
});
