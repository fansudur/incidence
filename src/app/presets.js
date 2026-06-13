// 预设 存档/载入 (APP 层): 把当前参数 + 视角打包成 JSON 文件下载; 从文件读回并套用。
// 作者硬约束: 不用 localStorage / 任何浏览器存储 —— 纯文件进出(可版本管理、可分享、可设公开页默认状态)。
const VERSION = 1;

// 把 loaded 的值并入 target(原地): 数组用 splice 原地替换元素 → 不脱钩 lil-gui 的 vec3 控制器
// (vec3 控制器绑定的是数组对象本身, 若整体替换数组引用, 控制器会指向旧数组)。未知键忽略(向后兼容)。
export function mergeParams(target, loaded) {
  for (const k in loaded) {
    if (!(k in target)) continue;
    if (Array.isArray(target[k]) && Array.isArray(loaded[k])) target[k].splice(0, target[k].length, ...loaded[k]);
    else target[k] = loaded[k];
  }
  return target;
}

export function setupPresets(gui, ctx) {
  const { params, viewState, getCamera, controls, rebuild, applyEnv, setView, getView } = ctx;
  const f = gui.addFolder('预设 (存档/载入)');

  const snapshot = () => {
    const cam = getCamera();
    return {
      app: 'incidence', version: VERSION,
      params: JSON.parse(JSON.stringify(params)),                 // 深拷贝(纯数字/布尔/字符串/数组)
      view: { name: getView(), lift: viewState.lift, eyeFovScale: viewState.eyeFovScale },
      camera: { pos: cam.position.toArray(), target: controls.target.toArray() },
    };
  };

  const applyPreset = (obj) => {
    if (!obj || obj.app !== 'incidence' || !obj.params) { alert('不是有效的 Incidence 预设文件'); return false; }
    mergeParams(params, obj.params);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());   // 面板同步显示新值
    rebuild();                                                      // 几何按新参数重建(含分区聚光灯)
    applyEnv();                                                     // 天空/太阳/环境刷新
    if (obj.view) {
      viewState.lift = obj.view.lift ?? viewState.lift;
      viewState.eyeFovScale = obj.view.eyeFovScale ?? viewState.eyeFovScale;
      setView(obj.view.name || getView());                         // 复位视角预设(Σ眼由 placeEyeCam 据 lift 锚定)
    }
    if (obj.camera && obj.view?.name !== 'Σ眼') {                   // 非Σ眼: 恢复确切机位(Σ眼是锚定的, 不覆盖)
      getCamera().position.fromArray(obj.camera.pos);
      controls.target.fromArray(obj.camera.target);
      getCamera().updateProjectionMatrix(); controls.update();      // change 事件 → PT 重拍相机
    }
    return true;
  };

  const save = () => {
    const data = JSON.stringify(snapshot(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const z = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
    a.href = url; a.download = `incidence-preset-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileInput = document.createElement('input');                // 载入: 隐藏的文件选择器, 由按钮触发
  fileInput.type = 'file'; fileInput.accept = 'application/json,.json'; fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { applyPreset(JSON.parse(reader.result)); } catch (e) { alert('预设解析失败: ' + e.message); } };
    reader.readAsText(file);
    fileInput.value = '';                                           // 清空 → 允许重复载入同一文件
  });

  f.add({ save }, 'save').name('⬇ 保存预设 (下载 JSON)');
  f.add({ load: () => fileInput.click() }, 'load').name('⬆ 载入预设 (选文件)');
  return { snapshot, applyPreset };
}
