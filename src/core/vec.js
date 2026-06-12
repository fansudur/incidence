// 纯数学向量运算 (零 three 依赖) — 向量用普通对象 {x, y, z}
// CORE 层的基石: 几何内核只依赖这个, 不碰 Three.js, 这样能在 Node 里跑测试、也能复用到别处。

export const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const normalize = (a) => { const l = len(a) || 1; return scale(a, 1 / l); };
export const lerp = (a, b, t) => add(a, scale(sub(b, a), t));
export const dist = (a, b) => len(sub(a, b));

// 平面 2D 标架: 给法向 n 配一对正交基 {e1, e2} (planeSection / terrain.basis 共用同一构造)
export const planeBasis = (n) => {
  const ref = Math.abs(n.y) < 0.9 ? v(0, 1, 0) : v(1, 0, 0);
  const e1 = normalize(cross(n, ref));
  return { e1, e2: cross(n, e1) };
};
