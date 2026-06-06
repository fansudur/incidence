// 镜面反射原语 (零 three 依赖) — 装置的"宇宙常数"在这里: 45° 镜面把光路转 90°。
import { v, sub, add, dot, scale, normalize } from './vec.js';

const DEG = Math.PI / 180;

// 镜面法向: 入射 +X 绕竖直轴(Y)转 2θ 得到出射方向, 法向 ∝ (in - out)。
// θ=45° → 出射 = (0,0,-1), 即光路转 90°。
export function mirrorNormal(angleDeg) {
  const turn = 2 * angleDeg * DEG;
  const c = Math.cos(turn), s = Math.sin(turn);
  const inDir = v(1, 0, 0);
  const outDir = v(c, 0, -s);            // rotateY(+X, turn)
  return normalize(sub(inDir, outDir));
}

// 方向向量 d 关于法向 n 的反射: d - 2(d·n)n
export function reflectDir(d, n) {
  return sub(d, scale(n, 2 * dot(d, n)));
}

// 光线(起点 o, 方向 d) 与平面(过点 p0, 法向 n) 求交。
// 平行(denom≈0) 或交点在背后(t≤0) → 返回 null (= 光路丢失/穿帮)。
export function rayPlane(o, d, p0, n) {
  const denom = dot(d, n);
  if (Math.abs(denom) < 1e-6) return null;
  const t = dot(sub(p0, o), n) / denom;
  if (t <= 1e-4) return null;
  return add(o, scale(d, t));
}
