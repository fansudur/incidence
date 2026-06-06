// 从参数 schema 自动生成 lil-gui 面板。新增控件 = 改 schema 一处, 这里不用动。
// 返回 { gui, ctrls }: ctrls 按 item.ref 收集需在别处引用的控制器(如动画用的 expand)。
import GUI from 'lil-gui';

export function buildGui(params, schema, onChange, title = '装置参数 (原始单位)') {
  const gui = new GUI({ title });
  const ctrls = {};
  for (const grp of schema) {
    const f = gui.addFolder(grp.folder);
    for (const it of grp.items) {
      if (it.type === 'vec3') {                       // 数组 → 3 个滑块
        for (let i = 0; i < 3; i++) f.add(params[it.key], String(i), it.min, it.max, it.step).name(it.sub[i]).onChange(onChange);
      } else if (it.type === 'bool') {                // 复选框
        const c = f.add(params, it.key).name(it.label).onChange(onChange);
        if (it.ref) ctrls[it.ref] = c;
      } else {                                        // num / int → 滑块
        const c = f.add(params, it.key, it.min, it.max, it.step).name(it.label).onChange(onChange);
        if (it.ref) ctrls[it.ref] = c;
      }
    }
  }
  return { gui, ctrls };
}
