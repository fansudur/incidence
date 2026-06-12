// 配色单一来源 (RENDER 层): 这里只放真正被多处共享的色值, 改它们即全局生效。
// (镜面=中性银色见 builders.buildMirror; 地形色板是 buildTerrain 的参数默认值; 其余单处使用的颜色就地定义。)
export const SAFE_COLOR = 0xffd700;      // 黄·安全可布景区 (体)
export const SAFE_EDGE_COLOR = 0xffe24a; // 黄·安全区描边
export const BUG_COLOR = 0xff3344;       // 红·易穿帮区 (体/层地面穿帮段)
export const BUG_EDGE_COLOR = 0xff5566;  // 红·穿帮区描边
