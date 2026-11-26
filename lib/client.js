window.__ModuleLoader__.load({
	id: "dsh-prompt-library",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/client/shared/theme.ts
		let dark = false;
		const listeners = /* @__PURE__ */ new Set();
		/**
		* 绑定主题服务（index.ts 的 apply 中调用，早于任何组件挂载）。
		* 订阅经 ctx.on 注册，随插件 fiber 卸载自动解除；重载后重新绑定。
		* @param ctx - 注入了 theme 服务的客户端上下文。
		*/
		function bindTheme(ctx) {
			const sync = (snapshot) => {
				const next = snapshot.active.colorScheme === "dark";
				if (next === dark) return;
				dark = next;
				for (const fn of [...listeners]) fn();
			};
			sync(ctx.theme.getTheme());
			ctx.on("theme/change", sync);
		}
		/**
		* 当前是否深色主题。
		* @returns true 表示深色。
		*/
		function detectDarkTheme() {
			return dark;
		}
		/**
		* 订阅主题变化。
		* @param onChange - 主题变化时回调（回调内自行调用 detectDarkTheme）。
		* @returns 取消订阅。
		*/
		function observeTheme(onChange) {
			listeners.add(onChange);
			return () => {
				listeners.delete(onChange);
			};
		}
		// src/client/ui/bus.ts
		/**
		* 微型外部 store：命令式 API（toast、tooltip 等）与 React
		* 宿主组件（useSyncExternalStore）之间的桥。原扩展的各 GlobalXxxManager
		* 是 window 单例 + 直接操作 DOM；DSH 下改为模块单例 + React 渲染。
		*/
		/** 可订阅的值容器。 */
		var Bus = class {
			value;
			listeners = /* @__PURE__ */ new Set();
			constructor(initial) {
				this.value = initial;
			}
			get() {
				return this.value;
			}
			set(next) {
				this.value = next;
				for (const fn of this.listeners) fn();
			}
			update(fn) {
				this.set(fn(this.value));
			}
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
		};
		// src/client/library/storage.ts
		const KEY = "dsh.prompt-library.v1";
		const LEGACY_PROMPTS = "dsh.timeline.prompts";
		const bus$2 = new Bus({ prompts: [] });
		let unsaved = false;
		let reportUnsaved = () => {};
		let diskButtonEnabled = true;
		function writeLibrary(value) {
			localStorage.setItem(KEY, JSON.stringify({
				prompts: value.prompts,
				promptButtonEnabled: diskButtonEnabled
			}));
		}
		function isRecord(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value);
		}
		function isPrompt(value) {
			return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.content === "string" && (value.pinned === void 0 || typeof value.pinned === "boolean");
		}
		function isLibrary(value) {
			return isRecord(value) && Array.isArray(value.prompts) && value.prompts.every(isPrompt);
		}
		function readJson(key) {
			const raw = localStorage.getItem(key);
			return raw === null ? void 0 : JSON.parse(raw);
		}
		function load(initialize = false) {
			if (unsaved) return bus$2.get();
			const value = readJson(KEY);
			if (value !== void 0) {
				if (!isLibrary(value)) return bus$2.get();
				diskButtonEnabled = !("promptButtonEnabled" in value) || value.promptButtonEnabled !== false;
				return { prompts: value.prompts };
			}
			let prompts = [];
			try {
				const oldPrompts = readJson(LEGACY_PROMPTS);
				if (Array.isArray(oldPrompts)) prompts = oldPrompts.filter(isPrompt);
			} catch {}
			diskButtonEnabled = true;
			const migrated = { prompts };
			if (initialize) try {
				writeLibrary(migrated);
			} catch {
				reportUnsaved();
			}
			return migrated;
		}
		function reload(initialize = false) {
			try {
				bus$2.set(load(initialize));
			} catch {}
		}
		function bindStorage(ctx, onUnsaved = () => {}) {
			ctx.effect(() => {
				reportUnsaved = onUnsaved;
				reload(true);
				const refresh = (event) => {
					if (event.storageArea === localStorage && (event.key === null || event.key === KEY)) reload();
				};
				window.addEventListener("storage", refresh);
				return () => {
					window.removeEventListener("storage", refresh);
					reportUnsaved = () => {};
				};
			}, "dsh-prompt-library: storage");
		}
		function changeList(transform) {
			let current = bus$2.get();
			try {
				current = load();
			} catch {}
			const next = { prompts: transform(current.prompts) };
			try {
				writeLibrary(next);
				unsaved = false;
			} catch {
				if (!unsaved) reportUnsaved();
				unsaved = true;
			}
			bus$2.set(next);
		}
		const promptsStore = {
			get: () => bus$2.get(),
			subscribe: bus$2.subscribe,
			add(name, content) {
				const id = `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
				changeList((list) => [...list, {
					id,
					name,
					content
				}]);
			},
			update(id, fields) {
				changeList((list) => list.map((prompt) => prompt.id === id ? {
					...prompt,
					...fields
				} : prompt));
			},
			remove(id) {
				changeList((list) => list.filter((prompt) => prompt.id !== id));
			},
			togglePin(id) {
				changeList((list) => list.map((prompt) => prompt.id === id ? {
					...prompt,
					pinned: !prompt.pinned
				} : prompt));
			},
			move(id, direction) {
				changeList((list) => {
					const index = list.findIndex((prompt) => prompt.id === id);
					if (index < 0) return list;
					const pinned = Boolean(list[index].pinned);
					const step = direction === "up" ? -1 : 1;
					let target = index + step;
					while (list[target] !== void 0 && Boolean(list[target].pinned) !== pinned) target += step;
					if (list[target] === void 0) return list;
					const moved = [...list];
					moved[index] = list[target];
					moved[target] = list[index];
					return moved;
				});
			}
		};
		function sortPrompts(prompts) {
			return [...prompts].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
		}
		function exportBackup() {
			const backup = {
				_meta: {
					source: "dsh-prompt-library",
					version: 2
				},
				data: { prompts: bus$2.get().prompts }
			};
			const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
			const link = document.createElement("a");
			link.href = url;
			link.download = `dsh-prompt-library-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1e3);
		}
		function restoreBackup(value, mode) {
			if (!isRecord(value) || !isRecord(value.data)) throw new Error("Invalid backup");
			const source = isRecord(value._meta) ? value._meta.source : void 0;
			let prompts;
			if (source === "dsh-prompt-library" && isLibrary(value.data)) prompts = value.data.prompts;
			else if (source === "AIChatTimeline-DSH" || source === void 0) {
				const legacy = value.data[LEGACY_PROMPTS];
				if (!Array.isArray(legacy) || !legacy.every(isPrompt)) throw new Error("Invalid prompt list");
				prompts = legacy;
			} else throw new Error("Invalid backup");
			changeList((previous) => {
				const entries = /* @__PURE__ */ new Map();
				if (mode === "merge") for (const prompt of previous) entries.set(prompt.id, prompt);
				for (const prompt of prompts) entries.set(prompt.id, prompt);
				return [...entries.values()];
			});
		}
		// \0dsh-css:src/client/ui/ui.module.css?34ed0f9d12.mjs
		const css$2 = ".fo0e9q_host{pointer-events:none;z-index:2147483647;width:0;height:0;position:fixed;top:0;left:0;overflow:visible}.fo0e9q_toast{z-index:2147483647;pointer-events:none;white-space:nowrap;opacity:0;border-radius:12px;align-items:center;gap:8px;max-width:400px;padding:10px 16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;transition:opacity .15s,transform .15s;display:flex;position:fixed;transform:translateY(-10px);box-shadow:0 4px 14px #00000026,0 1px 2px #0000000f}.fo0e9q_toast.fo0e9q_toastVisible{opacity:1;transform:translateY(0)}.fo0e9q_toastIcon{font-size:16px}.fo0e9q_tooltipBase{box-sizing:border-box;background-color:var(--ui-tooltip-bg,#f8fafc);color:var(--ui-tooltip-text,#334155);border:1px solid var(--ui-tooltip-border,#e2e8f0);white-space:normal;word-break:break-word;z-index:2147483647;opacity:0;visibility:hidden;pointer-events:none;border-radius:8px;max-width:400px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;transition:opacity .15s,visibility .15s;position:fixed;box-shadow:0 4px 12px #00000026}.fo0e9q_tooltipBase.fo0e9q_tooltipVisible{opacity:1;visibility:visible}.fo0e9q_tooltipBase:before,.fo0e9q_tooltipBase:after{content:\"\";pointer-events:none;background:0 0;width:0;height:0;position:absolute}.fo0e9q_tooltipBase[data-placement=bottom]:before{top:-8px;left:var(--arrow-offset,50%);border-left:8px solid #0000;border-right:8px solid #0000;border-bottom:8px solid var(--ui-tooltip-border,#e2e8f0);margin-left:-8px}.fo0e9q_tooltipBase[data-placement=bottom]:after{top:-6px;left:var(--arrow-offset,50%);border-left:7px solid #0000;border-right:7px solid #0000;border-bottom:7px solid var(--ui-tooltip-bg,#f8fafc);margin-left:-7px}.fo0e9q_tooltipBase[data-placement=right]:before{left:-8px;top:var(--arrow-offset,50%);border-top:8px solid #0000;border-bottom:8px solid #0000;border-right:8px solid var(--ui-tooltip-border,#e2e8f0);margin-top:-8px}.fo0e9q_tooltipBase[data-placement=right]:after{left:-6px;top:var(--arrow-offset,50%);border-top:7px solid #0000;border-bottom:7px solid #0000;border-right:7px solid var(--ui-tooltip-bg,#f8fafc);margin-top:-7px}.fo0e9q_tooltipNoArrow:before,.fo0e9q_tooltipNoArrow:after{display:none!important}.fo0e9q_tooltipSmall{border-radius:6px;padding:4px 8px;font-size:12px}.fo0e9q_popconfirmOverlay{z-index:2147483647;opacity:0;visibility:hidden;pointer-events:auto;background:#00000073;justify-content:center;align-items:center;transition:opacity .2s,visibility .2s;display:flex;position:fixed;inset:0}.fo0e9q_popconfirmOverlay.fo0e9q_popconfirmVisible{opacity:1;visibility:visible}.fo0e9q_popconfirm{background:#fff;border-radius:12px;width:400px;max-width:90vw;transition:transform .2s;transform:scale(.9)translateY(-20px);box-shadow:0 12px 32px #00000026}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirm{background:#2a2a2a}.fo0e9q_popconfirmOverlay.fo0e9q_popconfirmVisible .fo0e9q_popconfirm{transform:scale(1)translateY(0)}.fo0e9q_popconfirmContent{padding:24px}.fo0e9q_popconfirmTitle{color:#1f2937;margin-bottom:12px;font-size:18px;font-weight:600;line-height:1.4}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirmTitle{color:#f3f4f6}.fo0e9q_popconfirmActions{justify-content:flex-end;gap:12px;display:flex}.fo0e9q_popconfirmBtn{cursor:pointer;white-space:nowrap;border:none;border-radius:8px;padding:8px 20px;font-size:14px;font-weight:500;transition:all .2s}.fo0e9q_popconfirmBtn:hover{transform:translateY(-1px)}.fo0e9q_popconfirmBtn:active{transform:translateY(0)}.fo0e9q_popconfirmBtnCancel{color:#6b7280;background:#f3f4f6}.fo0e9q_popconfirmBtnCancel:hover{color:#374151;background:#e5e7eb}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirmBtnCancel{color:#d1d5db;background:#404040}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirmBtnCancel:hover{background:#4b5563}.fo0e9q_popconfirmBtnDanger{color:#fff;background:#ef4444}.fo0e9q_popconfirmBtnDanger:hover{background:#dc2626}@media (width<=640px){.fo0e9q_popconfirm{width:320px}.fo0e9q_popconfirmContent{padding:20px}.fo0e9q_popconfirmTitle{font-size:16px}.fo0e9q_popconfirmBtn{padding:7px 16px;font-size:13px}}";
		const tagId$2 = "dsh-prompt-library/ui.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-prompt-library";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ui_module_css_34ed0f9d12_default = {
			"host": "fo0e9q_host",
			"popconfirm": "fo0e9q_popconfirm",
			"popconfirmActions": "fo0e9q_popconfirmActions",
			"popconfirmBtn": "fo0e9q_popconfirmBtn",
			"popconfirmBtnCancel": "fo0e9q_popconfirmBtnCancel",
			"popconfirmBtnDanger": "fo0e9q_popconfirmBtnDanger",
			"popconfirmContent": "fo0e9q_popconfirmContent",
			"popconfirmOverlay": "fo0e9q_popconfirmOverlay",
			"popconfirmTitle": "fo0e9q_popconfirmTitle",
			"popconfirmVisible": "fo0e9q_popconfirmVisible",
			"toast": "fo0e9q_toast",
			"toastIcon": "fo0e9q_toastIcon",
			"toastVisible": "fo0e9q_toastVisible",
			"tooltipBase": "fo0e9q_tooltipBase",
			"tooltipNoArrow": "fo0e9q_tooltipNoArrow",
			"tooltipSmall": "fo0e9q_tooltipSmall",
			"tooltipVisible": "fo0e9q_tooltipVisible"
		};
		// src/client/ui/toast.tsx
		const white = {
			backgroundColor: "#ffffff",
			textColor: "#1f2937",
			borderColor: "#e5e7eb"
		};
		const darkSurface = {
			backgroundColor: "var(--dsw-alias-tooltip-bg)",
			textColor: "#ffffff",
			borderColor: "var(--dsw-alias-tooltip-bg)"
		};
		const types = {
			success: {
				color: {
					light: white,
					dark: white
				},
				icon: "✓",
				duration: 1e3
			},
			error: {
				color: {
					light: darkSurface,
					dark: white
				},
				icon: "⚠",
				duration: 1500
			},
			warning: {
				color: {
					light: darkSurface,
					dark: white
				},
				icon: "⚡",
				duration: 2e3
			}
		};
		let nextId = 1;
		const bus$1 = new Bus([]);
		const timers = /* @__PURE__ */ new Map();
		function show(type, message, color = types[type].color) {
			if (message === "") return;
			const { icon, duration } = types[type];
			const id = nextId++;
			bus$1.update((list) => {
				const next = [...list, {
					id,
					message,
					color,
					icon,
					leaving: false
				}];
				const active = next.filter((t) => !t.leaving);
				if (active.length <= 3) return next;
				const oldest = active[0].id;
				clearTimeout(timers.get(oldest));
				timers.delete(oldest);
				return next.filter((t) => t.id !== oldest);
			});
			timers.set(id, setTimeout(() => {
				bus$1.update((list) => list.map((t) => t.id === id ? {
					...t,
					leaving: true
				} : t));
				timers.set(id, setTimeout(() => {
					timers.delete(id);
					bus$1.update((list) => list.filter((t) => t.id !== id));
				}, 200));
			}, duration));
		}
		const toast = {
			success: (message, color) => show("success", message, color),
			error: (message, color) => show("error", message, color),
			warning: (message) => show("warning", message),
			forceHideAll() {
				for (const timer of timers.values()) clearTimeout(timer);
				timers.clear();
				bus$1.set([]);
			}
		};
		function ToastHost({ dark }) {
			const list = (0, react.useSyncExternalStore)(bus$1.subscribe, () => bus$1.get());
			const refs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const shown = (0, react.useRef)(/* @__PURE__ */ new Set());
			const hostRef = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				let top = 60;
				for (const t of list) {
					const el = refs.current.get(t.id);
					if (!el) continue;
					if (t.leaving) {
						el.classList.remove(ui_module_css_34ed0f9d12_default.toastVisible);
						continue;
					}
					const rect = el.getBoundingClientRect();
					el.style.left = `${(window.innerWidth - rect.width) / 2}px`;
					el.style.top = `${top}px`;
					top += rect.height + 10;
					if (!shown.current.has(t.id)) {
						shown.current.add(t.id);
						requestAnimationFrame(() => {
							el.classList.add(ui_module_css_34ed0f9d12_default.toastVisible);
						});
					}
				}
				for (const id of shown.current) if (!refs.current.has(id)) shown.current.delete(id);
				const host = hostRef.current;
				if (host?.parentNode === document.body) document.body.appendChild(host);
			}, [list]);
			if (!list.length) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: hostRef,
				className: ui_module_css_34ed0f9d12_default.host,
				children: list.map((t) => {
					const color = dark ? t.color.dark : t.color.light;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: (el) => {
							if (el) refs.current.set(t.id, el);
							else refs.current.delete(t.id);
						},
						className: ui_module_css_34ed0f9d12_default.toast,
						style: {
							backgroundColor: color.backgroundColor,
							color: color.textColor,
							border: `1px solid ${color.borderColor}`
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ui_module_css_34ed0f9d12_default.toastIcon,
							children: t.icon
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.message })]
					}, t.id);
				})
			}), document.body);
		}
		// src/client/locales.ts
		const NS = "dshPromptLibrary";
		const zh = {
			"panel.sessionOnly": "浏览器无法保存到本机，更改仅在本标签页有效。",
			"common.cancel": "取消",
			"common.delete": "删除",
			"common.edit": "编辑",
			"panel.storageFailed": "保存失败，请检查浏览器存储空间和权限。",
			"prompt.title": "提示词",
			"prompt.tooltipLibrary": "提示词库",
			"prompt.add": "添加提示词",
			"prompt.search": "搜索提示词...",
			"prompt.noResults": "暂无数据",
			"prompt.emptyHint": "保存常用提示词，用的时候点一下就能插入输入框。",
			"prompt.manage": "管理提示词",
			"panel.tabPrompt": "提示词",
			"panel.tabBackup": "提示词备份",
			"panel.syncHint": "通过 JSON 文件备份或恢复提示词，也可以将提示词迁移到其他浏览器。",
			"panel.syncExportLabel": "导出",
			"panel.syncImportLabel": "导入",
			"panel.syncExportBtn": "导出提示词",
			"panel.syncImportBtn": "选择文件导入",
			"panel.syncModeMerge": "合并",
			"panel.syncModeMergeDesc": "保留现有提示词，更新 ID 相同的条目",
			"panel.syncModeOverwrite": "覆盖",
			"panel.syncModeOverwriteDesc": "用备份中的提示词替换当前列表",
			"panel.syncExportSuccess": "导出成功",
			"panel.syncExportFailed": "导出失败",
			"panel.syncExporting": "正在导出...",
			"panel.syncImporting": "正在导入...",
			"panel.syncImportSuccess": "导入成功",
			"panel.syncImportFailed": "导入失败",
			"panel.promptListTitle": "提示词列表",
			"panel.promptAdd": "添加",
			"panel.promptEmpty": "暂无提示词",
			"panel.promptMoveUp": "上移",
			"panel.promptMoveDown": "下移",
			"panel.promptPinned": "已置顶",
			"panel.promptUnpinned": "已取消置顶",
			"panel.promptEditTitle": "编辑提示词",
			"panel.promptAddTitle": "添加提示词",
			"panel.promptNameLabel": "提示词名称",
			"panel.promptNamePlaceholder": "输入提示词名称",
			"panel.promptContentLabel": "内容",
			"panel.promptContentPlaceholder": "输入提示词内容",
			"panel.promptSave": "保存",
			"panel.promptRequired": "请输入",
			"panel.promptAdded": "提示词已添加",
			"panel.promptUpdated": "提示词已更新",
			"panel.promptDeleteConfirm": "确定删除这个提示词吗？",
			"panel.promptDeleted": "提示词已删除",
			"panel.promptPin": "置顶"
		};
		const en = {
			"panel.sessionOnly": "Browser storage is unavailable. Changes apply to this tab only.",
			"common.cancel": "Cancel",
			"common.delete": "Delete",
			"common.edit": "Edit",
			"panel.storageFailed": "Could not save. Check browser storage space and permissions.",
			"prompt.title": "Prompts",
			"prompt.tooltipLibrary": "Prompt Library",
			"prompt.add": "Add Prompt",
			"prompt.search": "Search prompts...",
			"prompt.noResults": "No Data",
			"prompt.emptyHint": "Save text you use often, then insert it into the input box with one click.",
			"prompt.manage": "Manage prompts",
			"panel.tabPrompt": "Prompts",
			"panel.tabBackup": "Prompt Backup",
			"panel.syncHint": "Back up or restore your prompts with a JSON file, or use it to move them to another browser.",
			"panel.syncExportLabel": "Export",
			"panel.syncImportLabel": "Import",
			"panel.syncExportBtn": "Export Prompts",
			"panel.syncImportBtn": "Select File to Import",
			"panel.syncModeMerge": "Merge",
			"panel.syncModeMergeDesc": "Keep existing prompts and update those with matching IDs",
			"panel.syncModeOverwrite": "Overwrite",
			"panel.syncModeOverwriteDesc": "Replace the current list with the prompts in the backup",
			"panel.syncExportSuccess": "Export successful",
			"panel.syncExportFailed": "Export failed",
			"panel.syncExporting": "Exporting...",
			"panel.syncImporting": "Importing...",
			"panel.syncImportSuccess": "Import Successful",
			"panel.syncImportFailed": "Import failed",
			"panel.promptListTitle": "Prompt List",
			"panel.promptAdd": "Add",
			"panel.promptEmpty": "No Prompts Yet",
			"panel.promptMoveUp": "Move Up",
			"panel.promptMoveDown": "Move Down",
			"panel.promptPinned": "Pinned",
			"panel.promptUnpinned": "Unpinned",
			"panel.promptEditTitle": "Edit Prompt",
			"panel.promptAddTitle": "Add Prompt",
			"panel.promptNameLabel": "Prompt Name",
			"panel.promptNamePlaceholder": "Enter prompt name",
			"panel.promptContentLabel": "Content",
			"panel.promptContentPlaceholder": "Enter prompt content",
			"panel.promptSave": "Save",
			"panel.promptRequired": "Please Enter",
			"panel.promptAdded": "Prompt Added",
			"panel.promptUpdated": "Prompt Updated",
			"panel.promptDeleteConfirm": "Are you sure you want to delete this prompt?",
			"panel.promptDeleted": "Prompt Deleted",
			"panel.promptPin": "Pin"
		};
		// src/client/shared/currentSession.ts
		/** 新版 DSH 通过主视图的持有计数标识当前会话，旧版直接提供 current。 */
		function selectCurrentSessionId(sessions) {
			if ("current" in sessions) return sessions.current;
			return Object.values(sessions.byId).find((session) => (session?.retainedBy?.mainView ?? 0) > 0)?.id;
		}
		// src/client/ui/tooltip.tsx
		const BUTTON_COLORS = {
			light: {
				backgroundColor: "#f8fafc",
				textColor: "#334155",
				borderColor: "#e2e8f0"
			},
			dark: {
				backgroundColor: "#27272a",
				textColor: "#e5e7eb",
				borderColor: "#3f3f46"
			}
		};
		const tipBus = new Bus(null);
		let showTimer = null;
		let hideTimer = null;
		function clearTimers() {
			if (showTimer !== null) {
				clearTimeout(showTimer);
				showTimer = null;
			}
			if (hideTimer !== null) {
				clearTimeout(hideTimer);
				hideTimer = null;
			}
		}
		const tooltip = {
			show(id, target, content, options = {}) {
				if (!target.isConnected || content === "") return;
				clearTimers();
				const current = tipBus.get();
				if (current?.id === id && current.target === target && current.content === content) return;
				const delay = options.showDelay ?? 0;
				showTimer = setTimeout(() => {
					showTimer = null;
					if (!target.isConnected) return;
					tipBus.set({
						id,
						target,
						content,
						options
					});
				}, delay);
			},
			hide(immediate = false) {
				clearTimers();
				if (immediate) {
					tipBus.set(null);
					return;
				}
				hideTimer = setTimeout(() => {
					hideTimer = null;
					tipBus.set(null);
				}, 100);
			}
		};
		function TooltipHost({ dark }) {
			const busTip = (0, react.useSyncExternalStore)(tipBus.subscribe, () => tipBus.get());
			const tipRef = (0, react.useRef)(null);
			const [tip, setTip] = (0, react.useState)(busTip);
			const leaveTimerRef = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				if (busTip !== null) {
					if (leaveTimerRef.current !== null) {
						clearTimeout(leaveTimerRef.current);
						leaveTimerRef.current = null;
					}
					setTip(busTip);
					return;
				}
				if (tip === null) return;
				tipRef.current?.classList.remove(ui_module_css_34ed0f9d12_default.tooltipVisible);
				leaveTimerRef.current = setTimeout(() => {
					leaveTimerRef.current = null;
					setTip(null);
				}, 200);
				return () => {
					if (leaveTimerRef.current !== null) {
						clearTimeout(leaveTimerRef.current);
						leaveTimerRef.current = null;
					}
				};
			}, [busTip]);
			(0, react.useLayoutEffect)(() => {
				const el = tipRef.current;
				if (el === null || tip === null) return;
				el.classList.remove(ui_module_css_34ed0f9d12_default.tooltipVisible);
				const targetRect = tip.target.getBoundingClientRect();
				const tipRect = el.getBoundingClientRect();
				const gap = tip.options.gap ?? 12;
				const pad = 8;
				let placement = tip.options.placement ?? "bottom";
				if (placement === "top" && targetRect.top - tipRect.height - gap < pad && targetRect.bottom + gap + tipRect.height <= window.innerHeight - pad) placement = "bottom";
				let left;
				let top;
				switch (placement) {
					case "right":
						left = targetRect.right + gap;
						top = targetRect.top + (targetRect.height - tipRect.height) / 2;
						break;
					case "top":
						left = targetRect.left + (targetRect.width - tipRect.width) / 2;
						top = targetRect.top - tipRect.height - gap;
						break;
					default:
						left = targetRect.left + (targetRect.width - tipRect.width) / 2;
						top = targetRect.bottom + gap;
				}
				left = Math.round(left);
				top = Math.round(top);
				if (left < pad) left = pad;
				else if (left + tipRect.width > window.innerWidth - pad) left = window.innerWidth - tipRect.width - pad;
				if (top < pad) top = pad;
				else if (top + tipRect.height > window.innerHeight - pad) top = window.innerHeight - tipRect.height - pad;
				const targetCenterX = targetRect.left + targetRect.width / 2;
				const targetCenterY = targetRect.top + targetRect.height / 2;
				let arrowOffset = "50%";
				if (placement === "top" || placement === "bottom") {
					const offsetPx = targetCenterX - left;
					arrowOffset = `${Math.max(12, Math.min(tipRect.width - 12, offsetPx))}px`;
				} else {
					const offsetPx = targetCenterY - top;
					arrowOffset = `${Math.max(12, Math.min(tipRect.height - 12, offsetPx))}px`;
				}
				el.setAttribute("data-placement", placement);
				el.style.setProperty("--arrow-offset", arrowOffset);
				el.style.left = `${left}px`;
				el.style.top = `${top}px`;
				const frame = requestAnimationFrame(() => {
					if (tipBus.get() === tip) el.classList.add(ui_module_css_34ed0f9d12_default.tooltipVisible);
				});
				return () => {
					cancelAnimationFrame(frame);
				};
			}, [tip]);
			(0, react.useEffect)(() => {
				if (tip === null) return;
				const onScroll = () => {
					tooltip.hide(true);
				};
				const onClick = (e) => {
					const t = e.target;
					if (t instanceof Node && (tip.target === t || tip.target.contains(t))) return;
					if (tipRef.current !== null && t instanceof Node && tipRef.current.contains(t)) return;
					tooltip.hide(true);
				};
				const onKeydown = (e) => {
					if (e.key === "Escape") tooltip.hide(true);
				};
				const onBlur = () => {
					tooltip.hide(true);
				};
				document.addEventListener("scroll", onScroll, true);
				document.addEventListener("click", onClick, true);
				document.addEventListener("keydown", onKeydown);
				window.addEventListener("blur", onBlur);
				const io = new IntersectionObserver((entries) => {
					for (const entry of entries) if (!entry.isIntersecting) tooltip.hide(true);
				}, { threshold: 0 });
				io.observe(tip.target);
				return () => {
					document.removeEventListener("scroll", onScroll, true);
					document.removeEventListener("click", onClick, true);
					document.removeEventListener("keydown", onKeydown);
					window.removeEventListener("blur", onBlur);
					io.disconnect();
				};
			}, [tip]);
			if (tip === null) return null;
			const colors = tip.options.color ?? (dark ? BUTTON_COLORS.dark : BUTTON_COLORS.light);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: tipRef,
				className: [
					ui_module_css_34ed0f9d12_default.tooltipBase,
					tip.options.noArrow ? ui_module_css_34ed0f9d12_default.tooltipNoArrow : "",
					tip.options.size === "small" ? ui_module_css_34ed0f9d12_default.tooltipSmall : ""
				].filter(Boolean).join(" "),
				role: "tooltip",
				style: {
					maxWidth: tip.options.maxWidth ?? 400,
					"--ui-tooltip-bg": colors.backgroundColor,
					"--ui-tooltip-text": colors.textColor,
					"--ui-tooltip-border": colors.borderColor
				},
				children: tip.content
			});
		}
		// src/client/ui/popconfirm.tsx
		const bus = new Bus(null);
		function close(result) {
			const current = bus.get();
			if (current === null || current.closing) return;
			const closing = {
				...current,
				closing: true
			};
			bus.set(closing);
			current.resolve(result);
			setTimeout(() => {
				if (bus.get() === closing) bus.set(null);
			}, 200);
		}
		const popconfirm = {
			show(options) {
				return new Promise((resolve) => {
					const current = bus.get();
					if (current !== null && !current.closing) close(false);
					bus.set({
						...options,
						resolve,
						closing: false
					});
				});
			},
			cancel() {
				close(false);
			}
		};
		function PopconfirmHost() {
			const state = (0, react.useSyncExternalStore)(bus.subscribe, () => bus.get());
			const active = state !== null && !state.closing;
			const [entered, setEntered] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!active) {
					setEntered(false);
					return;
				}
				const raf = requestAnimationFrame(() => {
					setEntered(true);
				});
				return () => {
					cancelAnimationFrame(raf);
				};
			}, [active]);
			(0, react.useEffect)(() => {
				if (state === null || state.closing) return;
				const onKeydown = (e) => {
					if (e.key === "Escape") close(false);
				};
				document.addEventListener("keydown", onKeydown);
				return () => {
					document.removeEventListener("keydown", onKeydown);
				};
			}, [state]);
			if (state === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: !state.closing && entered ? `${ui_module_css_34ed0f9d12_default.popconfirmOverlay} ${ui_module_css_34ed0f9d12_default.popconfirmVisible}` : ui_module_css_34ed0f9d12_default.popconfirmOverlay,
				onClick: (e) => {
					if (e.target === e.currentTarget) close(false);
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ui_module_css_34ed0f9d12_default.popconfirm,
					role: "alertdialog",
					"aria-modal": "true",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ui_module_css_34ed0f9d12_default.popconfirmContent,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ui_module_css_34ed0f9d12_default.popconfirmTitle,
							children: state.title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ui_module_css_34ed0f9d12_default.popconfirmActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${ui_module_css_34ed0f9d12_default.popconfirmBtn} ${ui_module_css_34ed0f9d12_default.popconfirmBtnCancel}`,
								onClick: (e) => {
									e.stopPropagation();
									close(false);
								},
								children: state.cancelText
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${ui_module_css_34ed0f9d12_default.popconfirmBtn} ${ui_module_css_34ed0f9d12_default.popconfirmBtnDanger}`,
								onClick: (e) => {
									e.stopPropagation();
									close(true);
								},
								children: state.confirmText
							})]
						})]
					})
				})
			});
		}
		// src/client/library/panel.ts
		const libraryPanel = new Bus(null);
		// \0dsh-css:src/client/library/panel.module.css?ca21a8b00b.mjs
		const css$1 = "._Mcp9q_modal{z-index:99999;pointer-events:auto;box-sizing:border-box;background:0 0;border:none;justify-content:center;align-items:center;width:100vw;height:100vh;margin:0;padding:0;display:flex;position:fixed;inset:0}._Mcp9q_overlay{cursor:pointer;background:#00000080;border:none;margin:0;padding:0;animation:.2s ease-out _Mcp9q_panel-fade-in;position:absolute;inset:0}._Mcp9q_wrapper{z-index:1;text-align:left;letter-spacing:normal;word-spacing:normal;text-transform:none;text-indent:0;white-space:normal;color:#333;direction:ltr;background:#fff;border-radius:12px;width:820px;max-width:90vw;height:600px;max-height:80vh;margin:0;padding:0;font-style:normal;line-height:normal;text-decoration:none;animation:.3s cubic-bezier(.16,1,.3,1) _Mcp9q_panel-fade-in-scale;display:flex;position:relative;overflow:hidden;box-shadow:0 20px 60px #0000004d}._Mcp9q_sidebar{background:#f6f6f8;border-right:1px solid #e5e5e7;flex-direction:column;width:180px;display:flex}._Mcp9q_sidebarHeader{border-bottom:1px solid #0000000f;flex-shrink:0;align-items:center;gap:8px;height:56px;padding:0 12px;display:flex}._Mcp9q_close{cursor:pointer;color:#666;background:0 0;border:none;border-radius:8px;flex-shrink:0;justify-content:center;align-items:center;width:32px;height:32px;margin-left:5px;padding:0;transition:all .2s;display:flex}._Mcp9q_close:hover{color:#333;background:#0000001a}._Mcp9q_close:active{transform:scale(.95)}._Mcp9q_close svg{stroke-width:2.5px;width:18px;height:18px}._Mcp9q_sidebarTitle{color:#24324a;white-space:nowrap;letter-spacing:-.3px;margin-left:-2px;font-size:16px;font-weight:700}._Mcp9q_tabs{flex:1;padding:12px 0;overflow:hidden auto}._Mcp9q_tabs::-webkit-scrollbar{width:4px}._Mcp9q_tabs::-webkit-scrollbar-thumb{background:#0003;border-radius:2px}._Mcp9q_tabs::-webkit-scrollbar-track{background:0 0}._Mcp9q_tab{cursor:pointer;color:#666;text-align:left;background:0 0;border:none;border-radius:8px;align-items:center;gap:10px;width:calc(100% - 24px);margin:0 12px;padding:8px 12px;font-size:15px;transition:all .2s;display:flex}._Mcp9q_tab:hover{color:#333;background:#0000000a}._Mcp9q_tab._Mcp9q_tabActive{color:#7450ff;background:#7450ff1a;font-weight:500}._Mcp9q_main{background:#fff;flex-direction:column;flex:1;display:flex;overflow:hidden}._Mcp9q_header{background:#fafafa;border-bottom:1px solid #0000000f;flex-shrink:0;grid-template-columns:minmax(0,1fr) minmax(0,auto) minmax(max-content,1fr);align-items:center;height:56px;padding:0 18px;display:grid}._Mcp9q_title{color:#333;text-overflow:ellipsis;white-space:nowrap;grid-column:2;margin:0;font-size:20px;font-weight:600;overflow:hidden}._Mcp9q_content{flex:1;padding:20px;overflow:hidden auto}._Mcp9q_content::-webkit-scrollbar{width:8px}._Mcp9q_content::-webkit-scrollbar-thumb{background:#0003;border-radius:4px}._Mcp9q_content::-webkit-scrollbar-track{background:0 0}@keyframes _Mcp9q_panel-fade-in{0%{opacity:0}to{opacity:1}}@keyframes _Mcp9q_panel-fade-in-scale{0%{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}._Mcp9q_promptListSection{padding:0}._Mcp9q_promptListHeader{justify-content:space-between;align-items:center;margin-bottom:6px;display:flex}._Mcp9q_promptListTitle{color:#1f2937;font-size:14px;font-weight:600}._Mcp9q_promptAddBtn{color:#fff;cursor:pointer;background:#000;border:none;border-radius:6px;align-items:center;gap:4px;padding:6px 12px;font-size:13px;font-weight:500;transition:all .15s;display:flex}._Mcp9q_promptAddBtn:hover{background:#333}._Mcp9q_promptAddBtn:active{transform:scale(.98)}._Mcp9q_promptAddBtn svg{width:14px;height:14px}._Mcp9q_promptListContainer{background:#f9fafb;border-radius:8px;padding:8px}._Mcp9q_promptEmpty{color:#9ca3af;flex-direction:column;justify-content:center;align-items:center;padding:32px 16px;display:flex}._Mcp9q_promptEmpty svg{opacity:.5;width:40px;height:40px;margin-bottom:8px}._Mcp9q_promptEmpty span{font-size:13px}._Mcp9q_promptItem{background:#fff;border:1px solid #0000;border-radius:6px;flex-direction:column;margin-bottom:6px;padding:10px 12px;transition:all .15s;display:flex}._Mcp9q_promptItem:last-child{margin-bottom:0}._Mcp9q_promptItem:hover{border-color:#eef0f2;box-shadow:0 1px 2px #00000008}._Mcp9q_promptItemContent{flex:1;min-width:0}._Mcp9q_promptItemHeader{justify-content:space-between;align-items:center;margin-bottom:2px;display:flex}._Mcp9q_promptItemName{color:#1f2937;flex:1;align-items:center;min-width:0;font-size:14px;font-weight:500;display:flex}._Mcp9q_promptItemNameText{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}._Mcp9q_promptItemText{color:#6b7280;word-break:break-word;align-items:flex-start;font-size:12px;line-height:1.5;display:flex}._Mcp9q_promptItemTextContent{-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1;display:-webkit-box;overflow:hidden}._Mcp9q_promptItemActions{opacity:0;flex-shrink:0;align-items:center;gap:2px;transition:opacity .15s;display:flex}._Mcp9q_promptItem:hover ._Mcp9q_promptItemActions{opacity:1}._Mcp9q_promptItemBtn{color:#6b7280;cursor:pointer;background:0 0;border:none;border-radius:4px;justify-content:center;align-items:center;width:24px;height:24px;padding:0;transition:all .15s;display:flex}._Mcp9q_promptItemBtn:hover{color:#374151;background:#f3f4f6}._Mcp9q_promptItemBtn svg{width:14px;height:14px}._Mcp9q_promptDeleteBtn:hover{color:#dc2626;background:#fee2e2}._Mcp9q_promptPinBadge{color:#facc15;flex-shrink:0;align-items:center;margin-right:4px;display:flex}._Mcp9q_promptPinBadge svg{stroke-width:3px;width:16px;height:16px}._Mcp9q_promptPinBtnActive{color:#facc15}._Mcp9q_promptPinBtnActive svg{stroke-width:2.5px}._Mcp9q_promptListContainer::-webkit-scrollbar{width:6px}._Mcp9q_promptListContainer::-webkit-scrollbar-track{background:0 0}._Mcp9q_promptListContainer::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}._Mcp9q_promptListContainer::-webkit-scrollbar-thumb:hover{background:#9ca3af}._Mcp9q_promptModalOverlay{z-index:2147483647;opacity:0;background:#00000080;justify-content:center;align-items:center;transition:opacity .2s;display:flex;position:fixed;inset:0}._Mcp9q_promptModalOverlay._Mcp9q_promptModalVisible{opacity:1}._Mcp9q_promptModal{text-align:left;letter-spacing:normal;text-transform:none;text-indent:0;direction:ltr;background:#fff;border-radius:12px;width:90%;max-width:480px;max-height:90vh;line-height:normal;transition:transform .2s;overflow:hidden;transform:scale(.95)translateY(10px);box-shadow:0 20px 60px #0003}._Mcp9q_promptModalOverlay._Mcp9q_promptModalVisible ._Mcp9q_promptModal{transform:scale(1)translateY(0)}._Mcp9q_promptModalHeader{border-bottom:1px solid #e5e7eb;justify-content:space-between;align-items:center;padding:16px 20px;display:flex}._Mcp9q_promptModalHeader h3{color:#1f2937;margin:0;font-size:16px;font-weight:600}._Mcp9q_promptModalClose{color:#6b7280;cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;width:32px;height:32px;padding:0;transition:all .15s;display:flex}._Mcp9q_promptModalClose:hover{color:#374151;background:#f3f4f6}._Mcp9q_promptModalClose svg{width:18px;height:18px}._Mcp9q_promptModalBody{padding:20px}._Mcp9q_promptModalField{margin-bottom:16px}._Mcp9q_promptModalField:last-child{margin-bottom:0}._Mcp9q_promptModalField label{color:#374151;margin-bottom:6px;font-size:13px;font-weight:500;display:block}._Mcp9q_requiredMark{color:#ef4444;margin-left:2px}._Mcp9q_promptModalInput,._Mcp9q_promptModalTextarea{color:#1f2937;box-sizing:border-box;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;outline:none;width:100%;padding:10px 12px;font-size:14px;transition:all .15s}._Mcp9q_promptModalInput:focus,._Mcp9q_promptModalTextarea:focus{background:#fff;border-color:#000;box-shadow:0 0 0 3px #0000001a}._Mcp9q_promptModalInput::placeholder,._Mcp9q_promptModalTextarea::placeholder{color:#9ca3af}._Mcp9q_promptModalTextarea{resize:none;min-height:60px;max-height:200px;font-family:inherit;line-height:1.5;overflow-y:auto}._Mcp9q_promptCharCounter{color:#9ca3af;justify-content:flex-end;align-items:center;margin-top:6px;font-size:12px;display:flex}._Mcp9q_promptModalFooter{background:#f9fafb;border-top:1px solid #e5e7eb;justify-content:flex-end;gap:8px;padding:16px 20px;display:flex}._Mcp9q_promptModalBtn{cursor:pointer;border-radius:6px;padding:8px 16px;font-size:14px;font-weight:500;transition:all .15s}._Mcp9q_promptModalCancel{color:#374151;background:#fff;border:1px solid #d1d5db}._Mcp9q_promptModalCancel:hover{background:#f3f4f6;border-color:#9ca3af}._Mcp9q_promptModalConfirm{color:#fff;background:#000;border:none}._Mcp9q_promptModalConfirm:hover{background:#333}._Mcp9q_promptModalConfirm:active{transform:scale(.98)}._Mcp9q_syncRoot{box-sizing:border-box;height:100%;padding:0;overflow-y:auto}._Mcp9q_syncSection{background:#f9fafb;border-radius:8px;margin-bottom:16px;padding:16px}._Mcp9q_syncSection:last-of-type{margin-bottom:0}._Mcp9q_syncHint{color:#6b7280;margin-bottom:16px;font-size:13px;line-height:1.6}._Mcp9q_syncBtn{color:#fff;cursor:pointer;background:#000;border:none;border-radius:6px;align-items:center;gap:8px;padding:10px 20px;font-size:14px;font-weight:500;transition:all .2s;display:inline-flex}._Mcp9q_syncBtn:hover{background:#1f2937}._Mcp9q_syncBtn:active{transform:scale(.98)}._Mcp9q_syncBtn:disabled{opacity:.6;cursor:not-allowed}._Mcp9q_syncBtn svg{width:18px;height:18px}._Mcp9q_syncGroup{flex-direction:column;gap:14px;display:flex}._Mcp9q_syncItem{align-items:flex-start;gap:14px;display:flex}._Mcp9q_syncItemLabel{color:#6b7280;flex-shrink:0;width:36px;padding-top:10px;font-size:13px;font-weight:500}._Mcp9q_syncItemBody{flex:1;min-width:0}._Mcp9q_syncItemBody ._Mcp9q_syncBtn{justify-content:center;width:100%}._Mcp9q_syncItemBody ._Mcp9q_importOptions{margin-bottom:10px}._Mcp9q_importOptions{flex-direction:column;gap:10px;margin-bottom:16px;display:flex}._Mcp9q_importOption{cursor:pointer;background:#fff;border:1px solid #e5e7eb;border-radius:6px;align-items:flex-start;gap:12px;padding:12px;transition:all .2s;display:flex}._Mcp9q_importOption:hover{background:#f3f4f6;border-color:#d1d5db}._Mcp9q_importOption:has(input:checked){background:#f3f4f6;border-color:#000}._Mcp9q_importOption input[type=radio]{opacity:0;width:0;height:0;position:absolute}._Mcp9q_optionRadio{corner-shape:round;border:2px solid #d1d5db;border-radius:50%;flex-shrink:0;width:18px;height:18px;margin-top:2px;transition:all .2s;position:relative}._Mcp9q_importOption:has(input:checked) ._Mcp9q_optionRadio{border-color:#000}._Mcp9q_optionRadio:after{content:\"\";corner-shape:round;background:#000;border-radius:50%;width:10px;height:10px;transition:transform .2s;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)scale(0)}._Mcp9q_importOption:has(input:checked) ._Mcp9q_optionRadio:after{transform:translate(-50%,-50%)scale(1)}._Mcp9q_optionContent{flex-direction:column;gap:4px;display:flex}._Mcp9q_optionLabel{color:#1f2937;font-size:14px;font-weight:500}._Mcp9q_optionDesc{color:#6b7280;font-size:12px;line-height:1.4}._Mcp9q_syncStatus{text-align:center;border-radius:6px;margin-top:16px;padding:12px 16px;font-size:13px}._Mcp9q_syncStatusLoading{color:#374151;background:#f3f4f6}._Mcp9q_syncStatusError{color:#991b1b;background:#fee2e2}._Mcp9q_generalRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;padding:12px 0;display:flex}._Mcp9q_generalRow button{font:inherit;color:inherit;cursor:pointer;background:0 0;border:1px solid;border-radius:6px;padding:4px 12px}";
		const tagId$1 = "dsh-prompt-library/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-prompt-library";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var panel_module_css_ca21a8b00b_default = {
			"close": "_Mcp9q_close",
			"content": "_Mcp9q_content",
			"generalRow": "_Mcp9q_generalRow",
			"header": "_Mcp9q_header",
			"importOption": "_Mcp9q_importOption",
			"importOptions": "_Mcp9q_importOptions",
			"main": "_Mcp9q_main",
			"modal": "_Mcp9q_modal",
			"optionContent": "_Mcp9q_optionContent",
			"optionDesc": "_Mcp9q_optionDesc",
			"optionLabel": "_Mcp9q_optionLabel",
			"optionRadio": "_Mcp9q_optionRadio",
			"overlay": "_Mcp9q_overlay",
			"panel-fade-in": "_Mcp9q_panel-fade-in",
			"panel-fade-in-scale": "_Mcp9q_panel-fade-in-scale",
			"promptAddBtn": "_Mcp9q_promptAddBtn",
			"promptCharCounter": "_Mcp9q_promptCharCounter",
			"promptDeleteBtn": "_Mcp9q_promptDeleteBtn",
			"promptEmpty": "_Mcp9q_promptEmpty",
			"promptItem": "_Mcp9q_promptItem",
			"promptItemActions": "_Mcp9q_promptItemActions",
			"promptItemBtn": "_Mcp9q_promptItemBtn",
			"promptItemContent": "_Mcp9q_promptItemContent",
			"promptItemHeader": "_Mcp9q_promptItemHeader",
			"promptItemName": "_Mcp9q_promptItemName",
			"promptItemNameText": "_Mcp9q_promptItemNameText",
			"promptItemText": "_Mcp9q_promptItemText",
			"promptItemTextContent": "_Mcp9q_promptItemTextContent",
			"promptListContainer": "_Mcp9q_promptListContainer",
			"promptListHeader": "_Mcp9q_promptListHeader",
			"promptListSection": "_Mcp9q_promptListSection",
			"promptListTitle": "_Mcp9q_promptListTitle",
			"promptModal": "_Mcp9q_promptModal",
			"promptModalBody": "_Mcp9q_promptModalBody",
			"promptModalBtn": "_Mcp9q_promptModalBtn",
			"promptModalCancel": "_Mcp9q_promptModalCancel",
			"promptModalClose": "_Mcp9q_promptModalClose",
			"promptModalConfirm": "_Mcp9q_promptModalConfirm",
			"promptModalField": "_Mcp9q_promptModalField",
			"promptModalFooter": "_Mcp9q_promptModalFooter",
			"promptModalHeader": "_Mcp9q_promptModalHeader",
			"promptModalInput": "_Mcp9q_promptModalInput",
			"promptModalOverlay": "_Mcp9q_promptModalOverlay",
			"promptModalTextarea": "_Mcp9q_promptModalTextarea",
			"promptModalVisible": "_Mcp9q_promptModalVisible",
			"promptPinBadge": "_Mcp9q_promptPinBadge",
			"promptPinBtnActive": "_Mcp9q_promptPinBtnActive",
			"requiredMark": "_Mcp9q_requiredMark",
			"sidebar": "_Mcp9q_sidebar",
			"sidebarHeader": "_Mcp9q_sidebarHeader",
			"sidebarTitle": "_Mcp9q_sidebarTitle",
			"syncBtn": "_Mcp9q_syncBtn",
			"syncGroup": "_Mcp9q_syncGroup",
			"syncHint": "_Mcp9q_syncHint",
			"syncItem": "_Mcp9q_syncItem",
			"syncItemBody": "_Mcp9q_syncItemBody",
			"syncItemLabel": "_Mcp9q_syncItemLabel",
			"syncRoot": "_Mcp9q_syncRoot",
			"syncSection": "_Mcp9q_syncSection",
			"syncStatus": "_Mcp9q_syncStatus",
			"syncStatusError": "_Mcp9q_syncStatusError",
			"syncStatusLoading": "_Mcp9q_syncStatusLoading",
			"tab": "_Mcp9q_tab",
			"tabActive": "_Mcp9q_tabActive",
			"tabs": "_Mcp9q_tabs",
			"title": "_Mcp9q_title",
			"wrapper": "_Mcp9q_wrapper"
		};
		// src/client/library/PromptManager.tsx
		function PromptTab({ t }) {
			const prompts = (0, react.useSyncExternalStore)(promptsStore.subscribe, promptsStore.get).prompts;
			const sorted = (0, react.useMemo)(() => sortPrompts(prompts), [prompts]);
			const [modal, setModal] = (0, react.useState)(null);
			const actionTooltip = (id, text) => ({
				"aria-label": text,
				onMouseEnter: (e) => {
					tooltip.show(id, e.currentTarget, text);
				},
				onMouseLeave: () => {
					tooltip.hide();
				}
			});
			function change(action) {
				try {
					action();
					return true;
				} catch {
					toast.error(t("panel.storageFailed"));
					return false;
				}
			}
			const deletePrompt = async (id) => {
				if (await popconfirm.show({
					title: t("panel.promptDeleteConfirm"),
					confirmText: t("common.delete"),
					cancelText: t("common.cancel")
				}) && change(() => promptsStore.remove(id))) toast.success(t("panel.promptDeleted"));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_ca21a8b00b_default.promptListSection,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_ca21a8b00b_default.promptListHeader,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_ca21a8b00b_default.promptListTitle,
						children: t("panel.promptListTitle")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: panel_module_css_ca21a8b00b_default.promptAddBtn,
						onClick: () => {
							setModal({ mode: "add" });
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							"aria-hidden": true,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: "12",
								y1: "5",
								x2: "12",
								y2: "19"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: "5",
								y1: "12",
								x2: "19",
								y2: "12"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("panel.promptAdd") })]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_ca21a8b00b_default.promptListContainer,
					children: sorted.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_ca21a8b00b_default.promptEmpty,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.5",
							"aria-hidden": true,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "14 2 14 8 20 8" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: "16",
									y1: "13",
									x2: "8",
									y2: "13"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: "16",
									y1: "17",
									x2: "8",
									y2: "17"
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("panel.promptEmpty") })]
					}) : sorted.map((prompt) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_ca21a8b00b_default.promptItem,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_ca21a8b00b_default.promptItemContent,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_ca21a8b00b_default.promptItemHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_ca21a8b00b_default.promptItemName,
									children: [prompt.pinned === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_ca21a8b00b_default.promptPinBadge,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
											viewBox: "0 0 24 24",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "2.5",
											"aria-hidden": true,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
													x1: "5",
													y1: "3",
													x2: "19",
													y2: "3"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
													x1: "12",
													y1: "7",
													x2: "12",
													y2: "21"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "8 11 12 7 16 11" })
											]
										})
									}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_ca21a8b00b_default.promptItemNameText,
										children: prompt.name
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_ca21a8b00b_default.promptItemActions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: prompt.pinned === true ? `${panel_module_css_ca21a8b00b_default.promptItemBtn} ${panel_module_css_ca21a8b00b_default.promptPinBtnActive}` : panel_module_css_ca21a8b00b_default.promptItemBtn,
											...actionTooltip("prompt-pin", t("panel.promptPin")),
											onClick: () => {
												if (!change(() => promptsStore.togglePin(prompt.id))) return;
												const nowPinned = prompt.pinned !== true;
												toast.success(nowPinned ? t("panel.promptPinned") : t("panel.promptUnpinned"));
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
												viewBox: "0 0 24 24",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2.5",
												"aria-hidden": true,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
														x1: "5",
														y1: "3",
														x2: "19",
														y2: "3"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
														x1: "12",
														y1: "7",
														x2: "12",
														y2: "21"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "8 11 12 7 16 11" })
												]
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_ca21a8b00b_default.promptItemBtn,
											...actionTooltip("prompt-edit", t("common.edit")),
											onClick: () => {
												setModal({
													mode: "edit",
													prompt
												});
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
												viewBox: "0 0 24 24",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2",
												"aria-hidden": true,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })]
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: `${panel_module_css_ca21a8b00b_default.promptItemBtn} ${panel_module_css_ca21a8b00b_default.promptDeleteBtn}`,
											...actionTooltip("prompt-delete", t("common.delete")),
											onClick: () => {
												deletePrompt(prompt.id);
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
												viewBox: "0 0 24 24",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2",
												"aria-hidden": true,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })]
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_ca21a8b00b_default.promptItemBtn,
											...actionTooltip("prompt-move-up", t("panel.promptMoveUp")),
											onClick: () => {
												change(() => promptsStore.move(prompt.id, "up"));
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
												viewBox: "0 0 24 24",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2",
												"aria-hidden": true,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "18 15 12 9 6 15" })
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_ca21a8b00b_default.promptItemBtn,
											...actionTooltip("prompt-move-down", t("panel.promptMoveDown")),
											onClick: () => {
												change(() => promptsStore.move(prompt.id, "down"));
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
												viewBox: "0 0 24 24",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2",
												"aria-hidden": true,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "6 9 12 15 18 9" })
											})
										})
									]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_ca21a8b00b_default.promptItemText,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_ca21a8b00b_default.promptItemTextContent,
									children: prompt.content
								})
							})]
						})
					}, prompt.id))
				})]
			}), modal !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptModal, {
				t,
				prompt: modal.mode === "edit" ? modal.prompt : null,
				onClose: () => {
					setModal(null);
				}
			}) : null] });
		}
		/** 提示词编辑弹窗（原 showPromptModal；DSH 单平台，无「适用于」平台选择器）。 */
		function PromptModal({ t, prompt, onClose }) {
			const isEdit = prompt !== null;
			const [visible, setVisible] = (0, react.useState)(false);
			const [closing, setClosing] = (0, react.useState)(false);
			const [name, setName] = (0, react.useState)(prompt?.name ?? "");
			const [content, setContent] = (0, react.useState)(prompt?.content ?? "");
			const nameRef = (0, react.useRef)(null);
			const contentRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const raf = requestAnimationFrame(() => {
					setVisible(true);
				});
				return () => {
					cancelAnimationFrame(raf);
				};
			}, []);
			const autoResize = () => {
				const el = contentRef.current;
				if (el === null) return;
				el.style.height = "auto";
				el.style.height = `${String(Math.min(el.scrollHeight, 200))}px`;
			};
			(0, react.useEffect)(() => {
				autoResize();
			}, []);
			const close = () => {
				setClosing(true);
				setVisible(false);
				setTimeout(onClose, 200);
			};
			const save = () => {
				const trimmedName = name.trim();
				const trimmedContent = content.trim();
				if (trimmedName === "") {
					toast.error(t("panel.promptRequired"));
					nameRef.current?.focus();
					return;
				}
				if (trimmedContent === "") {
					toast.error(t("panel.promptRequired"));
					contentRef.current?.focus();
					return;
				}
				try {
					if (isEdit) promptsStore.update(prompt.id, {
						name: trimmedName,
						content: trimmedContent
					});
					else promptsStore.add(trimmedName, trimmedContent);
				} catch {
					toast.error(t("panel.storageFailed"));
					return;
				}
				toast.success(isEdit ? t("panel.promptUpdated") : t("panel.promptAdded"));
				close();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: visible && !closing ? `${panel_module_css_ca21a8b00b_default.promptModalOverlay} ${panel_module_css_ca21a8b00b_default.promptModalVisible}` : panel_module_css_ca21a8b00b_default.promptModalOverlay,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_ca21a8b00b_default.promptModal,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": isEdit ? t("panel.promptEditTitle") : t("panel.promptAddTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_ca21a8b00b_default.promptModalHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: isEdit ? t("panel.promptEditTitle") : t("panel.promptAddTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_ca21a8b00b_default.promptModalClose,
								onClick: close,
								"aria-label": t("common.cancel"),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
									viewBox: "0 0 24 24",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "2",
									"aria-hidden": true,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
										x1: "18",
										y1: "6",
										x2: "6",
										y2: "18"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
										x1: "6",
										y1: "6",
										x2: "18",
										y2: "18"
									})]
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_ca21a8b00b_default.promptModalBody,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_ca21a8b00b_default.promptModalField,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("panel.promptNameLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_ca21a8b00b_default.requiredMark,
									children: "*"
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: nameRef,
									type: "text",
									className: panel_module_css_ca21a8b00b_default.promptModalInput,
									placeholder: t("panel.promptNamePlaceholder"),
									maxLength: 16,
									value: name,
									onChange: (e) => {
										setName(e.target.value);
									}
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_ca21a8b00b_default.promptModalField,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("panel.promptContentLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_ca21a8b00b_default.requiredMark,
										children: "*"
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										ref: contentRef,
										className: panel_module_css_ca21a8b00b_default.promptModalTextarea,
										placeholder: t("panel.promptContentPlaceholder"),
										rows: 4,
										maxLength: 2e4,
										value: content,
										onChange: (e) => {
											setContent(e.target.value);
											autoResize();
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_ca21a8b00b_default.promptCharCounter,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: `${String(content.length)}/20000` })
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_ca21a8b00b_default.promptModalFooter,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${panel_module_css_ca21a8b00b_default.promptModalBtn} ${panel_module_css_ca21a8b00b_default.promptModalCancel}`,
								onClick: close,
								children: t("common.cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${panel_module_css_ca21a8b00b_default.promptModalBtn} ${panel_module_css_ca21a8b00b_default.promptModalConfirm}`,
								onClick: save,
								children: t("panel.promptSave")
							})]
						})
					]
				})
			});
		}
		// src/client/library/Backup.tsx
		const SYNC_TOAST_COLOR = {
			light: {
				backgroundColor: "var(--dsw-alias-tooltip-bg)",
				textColor: "#ffffff",
				borderColor: "var(--dsw-alias-tooltip-bg)"
			},
			dark: {
				backgroundColor: "var(--dsw-alias-tooltip-bg)",
				textColor: "#f5f5f5",
				borderColor: "var(--dsw-alias-tooltip-bg)"
			}
		};
		/** 提示词备份的本地文件导入与导出。 */
		function PromptBackupTab({ t }) {
			const [importMode, setImportMode] = (0, react.useState)("merge");
			const [status, setStatus] = (0, react.useState)(null);
			const fileInputRef = (0, react.useRef)(null);
			/** 导出数据（原 handleExport）。 */
			const handleExport = () => {
				try {
					setStatus({
						type: "loading",
						message: t("panel.syncExporting")
					});
					exportBackup();
					setStatus(null);
					toast.success(t("panel.syncExportSuccess"), SYNC_TOAST_COLOR);
				} catch {
					setStatus(null);
					toast.error(t("panel.syncExportFailed"), SYNC_TOAST_COLOR);
				}
			};
			/** 导入数据（原 handleImport）。 */
			const handleImport = async (e) => {
				const file = e.target.files?.[0];
				if (file === void 0) return;
				e.target.value = "";
				try {
					setStatus({
						type: "loading",
						message: t("panel.syncImporting")
					});
					const text = await file.text();
					restoreBackup(JSON.parse(text), importMode);
					setStatus(null);
					toast.success(t("panel.syncImportSuccess"));
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					setStatus({
						type: "error",
						message: `${t("panel.syncImportFailed")}: ${message}`
					});
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_ca21a8b00b_default.syncRoot,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_ca21a8b00b_default.syncSection,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_ca21a8b00b_default.syncHint,
							children: t("panel.syncHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_ca21a8b00b_default.syncGroup,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_ca21a8b00b_default.syncItem,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_ca21a8b00b_default.syncItemLabel,
									children: t("panel.syncExportLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_ca21a8b00b_default.syncItemBody,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: panel_module_css_ca21a8b00b_default.syncBtn,
										onClick: handleExport,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
											viewBox: "0 0 24 24",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "2",
											"aria-hidden": true,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "14,2 14,8 20,8" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
													x1: "12",
													y1: "12",
													x2: "12",
													y2: "18"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "9,15 12,18 15,15" })
											]
										}), t("panel.syncExportBtn")]
									})
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_ca21a8b00b_default.syncItem,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_ca21a8b00b_default.syncItemLabel,
									children: t("panel.syncImportLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_ca21a8b00b_default.syncItemBody,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_ca21a8b00b_default.importOptions,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: panel_module_css_ca21a8b00b_default.importOption,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "radio",
													name: "dsh-prompt-library-import-mode",
													value: "merge",
													checked: importMode === "merge",
													onChange: () => {
														setImportMode("merge");
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_ca21a8b00b_default.optionRadio }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_ca21a8b00b_default.optionContent,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_ca21a8b00b_default.optionLabel,
														children: t("panel.syncModeMerge")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_ca21a8b00b_default.optionDesc,
														children: t("panel.syncModeMergeDesc")
													})]
												})
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: panel_module_css_ca21a8b00b_default.importOption,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "radio",
													name: "dsh-prompt-library-import-mode",
													value: "overwrite",
													checked: importMode === "overwrite",
													onChange: () => {
														setImportMode("overwrite");
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_ca21a8b00b_default.optionRadio }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_ca21a8b00b_default.optionContent,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_ca21a8b00b_default.optionLabel,
														children: t("panel.syncModeOverwrite")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_ca21a8b00b_default.optionDesc,
														children: t("panel.syncModeOverwriteDesc")
													})]
												})
											]
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: panel_module_css_ca21a8b00b_default.syncBtn,
										onClick: () => {
											fileInputRef.current?.click();
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
											viewBox: "0 0 24 24",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "2",
											"aria-hidden": true,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "14,2 14,8 20,8" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
													x1: "12",
													y1: "18",
													x2: "12",
													y2: "12"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "9,15 12,12 15,15" })
											]
										}), t("panel.syncImportBtn")]
									})]
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							ref: fileInputRef,
							type: "file",
							accept: ".json",
							style: { display: "none" },
							onChange: (e) => {
								handleImport(e);
							}
						})
					]
				}), status !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${panel_module_css_ca21a8b00b_default.syncStatus} ${status.type === "loading" ? panel_module_css_ca21a8b00b_default.syncStatusLoading : panel_module_css_ca21a8b00b_default.syncStatusError}`,
					children: status.message
				}) : null]
			});
		}
		// src/client/library/PanelHost.tsx
		const tabs = [["prompts", "panel.tabPrompt"], ["backup", "panel.tabBackup"]];
		function SettingsEntry({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_ca21a8b00b_default.generalRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("prompt.tooltipLibrary") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => libraryPanel.set("prompts"),
					children: t("prompt.manage")
				})]
			});
		}
		function dismiss() {
			tooltip.hide(true);
			popconfirm.cancel();
			libraryPanel.set(null);
		}
		function PanelHost({ t, useSessions }) {
			const session = useSessions(selectCurrentSessionId);
			const activeTab = (0, react.useSyncExternalStore)(libraryPanel.subscribe, () => libraryPanel.get());
			const dark = (0, react.useSyncExternalStore)(observeTheme, detectDarkTheme);
			const open = activeTab !== null;
			(0, react.useEffect)(() => () => {
				dismiss();
				toast.forceHideAll();
			}, [session]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const prev = document.body.style.overflow;
				document.body.style.overflow = "hidden";
				return () => {
					document.body.style.overflow = prev;
				};
			}, [open]);
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ui_module_css_34ed0f9d12_default.host,
				"data-theme": dark ? "dark" : "light",
				children: [
					open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_ca21a8b00b_default.modal,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_ca21a8b00b_default.overlay,
							onClick: dismiss
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_ca21a8b00b_default.wrapper,
							role: "dialog",
							"aria-modal": "true",
							"aria-label": t("prompt.tooltipLibrary"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_ca21a8b00b_default.sidebar,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_ca21a8b00b_default.sidebarHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: panel_module_css_ca21a8b00b_default.close,
										"aria-label": t("common.cancel"),
										onClick: dismiss,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
											viewBox: "0 0 24 24",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "2",
											"aria-hidden": true,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 6 12 12M18 6 6 18" })
										})
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_ca21a8b00b_default.sidebarTitle,
										children: t("prompt.tooltipLibrary")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_ca21a8b00b_default.tabs,
									children: tabs.map(([id, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: id === activeTab ? `${panel_module_css_ca21a8b00b_default.tab} ${panel_module_css_ca21a8b00b_default.tabActive}` : panel_module_css_ca21a8b00b_default.tab,
										onClick: () => libraryPanel.set(id),
										children: t(label)
									}, id))
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_ca21a8b00b_default.main,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_ca21a8b00b_default.header,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: panel_module_css_ca21a8b00b_default.title,
										children: t(tabs.find(([id]) => id === activeTab)[1])
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_ca21a8b00b_default.content,
									children: [activeTab === "prompts" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptTab, { t }), activeTab === "backup" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptBackupTab, { t })]
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToastHost, { dark }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PopconfirmHost, {}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TooltipHost, { dark })
				]
			}), document.body);
		}
		// \0dsh-css:src/client/library/promptButton.module.css?421fbebaf7.mjs
		const css = ".KfIHGW_promptBtn{corner-shape:round;width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;user-select:none;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;margin-left:-8px;margin-right:-14px;padding:0;display:grid}.KfIHGW_promptBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.KfIHGW_promptIcon{flex-shrink:0;width:14px;height:14px}.KfIHGW_overlay{z-index:17;position:fixed;inset:0}.KfIHGW_container{z-index:18;opacity:0;text-align:left;letter-spacing:normal;word-spacing:normal;text-transform:none;text-indent:0;white-space:normal;direction:ltr;background:#fff;border-radius:12px;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:normal;transition:opacity .15s,transform .15s;display:flex;position:fixed;overflow:hidden;transform:translateY(4px)scale(.98);box-shadow:0 0 0 1px #00000014,0 4px 16px #0000001f,0 8px 32px #00000014}.KfIHGW_container.KfIHGW_visible{opacity:1;transform:translateY(0)scale(1)}.KfIHGW_container[data-theme=dark]{background:#262626;box-shadow:0 0 0 1px #ffffff14,0 8px 24px #00000059,0 16px 48px #0000003d}.KfIHGW_header{color:#5b21b6;border-bottom:1px solid #e5e7eb;flex-shrink:0;align-items:center;gap:6px;min-height:44px;padding:0 12px;display:flex}.KfIHGW_container[data-theme=dark] .KfIHGW_header{color:#c4b5fd;border-bottom-color:#404040}.KfIHGW_title{font-size:13px;font-weight:600}.KfIHGW_manageButton{width:28px;height:28px;color:inherit;cursor:pointer;background:0 0;border:none;border-radius:5px;place-items:center;padding:0;display:grid}.KfIHGW_manageButton svg{width:13px;height:13px}.KfIHGW_manageButton:hover{background:#7c3aed1f}.KfIHGW_container[data-theme=dark] .KfIHGW_manageButton:hover{background:#8b5cf62e}.KfIHGW_manageButton:focus-visible{outline-offset:1px;outline:2px solid}.KfIHGW_search{flex-shrink:0;padding:10px 10px 4px}.KfIHGW_searchInput{color:#333;box-sizing:border-box;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;outline:none;width:100%;height:32px;padding:0 10px;font-size:13px;transition:border-color .2s}.KfIHGW_searchInput::placeholder{color:#9ca3af}.KfIHGW_searchInput:focus{background:#fff;border-color:#7c3aed}.KfIHGW_container[data-theme=dark] .KfIHGW_searchInput{color:#f5f5f5;background:#1f1f1f;border-color:#404040}.KfIHGW_container[data-theme=dark] .KfIHGW_searchInput::placeholder{color:#737373}.KfIHGW_container[data-theme=dark] .KfIHGW_searchInput:focus{background:#171717;border-color:#8b5cf6;box-shadow:0 0 0 3px #8b5cf62e}.KfIHGW_searchEmpty{text-align:center;color:#9ca3af;padding:24px 16px;font-size:13px}.KfIHGW_container[data-theme=dark] .KfIHGW_searchEmpty{color:#a3a3a3}.KfIHGW_body{flex-direction:column;flex:1;padding:10px;display:flex;overflow:hidden auto}.KfIHGW_body::-webkit-scrollbar{width:6px}.KfIHGW_body::-webkit-scrollbar-track{background:0 0}.KfIHGW_body::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:3px}.KfIHGW_body::-webkit-scrollbar-thumb:hover{background:#d0d0d0}.KfIHGW_container[data-theme=dark] .KfIHGW_body::-webkit-scrollbar-thumb{background:#525252}.KfIHGW_container[data-theme=dark] .KfIHGW_body::-webkit-scrollbar-thumb:hover{background:#737373}.KfIHGW_item{cursor:pointer;background:#fff;border:1px solid #f0f0f0;border-radius:8px;flex-direction:column;margin-bottom:4px;padding:10px 12px;transition:all .15s;display:flex}.KfIHGW_item:last-child{margin-bottom:0}.KfIHGW_item:hover{border-color:#d1d5db}.KfIHGW_item:active{background-color:#f0ebff}.KfIHGW_container[data-theme=dark] .KfIHGW_item{background:#1f1f1f;border-color:#3f3f46}.KfIHGW_container[data-theme=dark] .KfIHGW_item:hover{background:#27272a;border-color:#52525b}.KfIHGW_container[data-theme=dark] .KfIHGW_item:active{background:#8b5cf629}.KfIHGW_itemMain{align-items:center;gap:6px;margin-bottom:4px;display:flex}.KfIHGW_itemName{color:#1f2937;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;overflow:hidden}.KfIHGW_container[data-theme=dark] .KfIHGW_itemName{color:#f5f5f5}.KfIHGW_itemContent{color:#6b7280;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.4;overflow:hidden}.KfIHGW_container[data-theme=dark] .KfIHGW_itemContent{color:#a3a3a3}.KfIHGW_itemIcon{color:#ccc;flex-shrink:0;justify-content:center;align-items:center;width:16px;height:16px;display:flex}.KfIHGW_itemIcon svg{width:14px;height:14px}.KfIHGW_itemIcon.KfIHGW_pinnedIcon{color:#f5a623}.KfIHGW_empty{flex-direction:column;flex:1;justify-content:center;align-items:center;min-height:150px;padding:40px 20px;display:flex}.KfIHGW_emptyHint{color:#6b7280;text-align:center;max-width:220px;font-size:12px;line-height:1.5}.KfIHGW_container[data-theme=dark] .KfIHGW_emptyHint{color:#a3a3a3}.KfIHGW_emptyAction{color:#fff;cursor:pointer;background:#111827;border:none;border-radius:8px;justify-content:center;align-items:center;gap:6px;height:32px;margin-top:14px;padding:0 14px;font-size:13px;font-weight:500;transition:background .15s,transform .15s;display:flex}.KfIHGW_emptyAction:hover{background:#374151}.KfIHGW_emptyAction:active{transform:scale(.97)}.KfIHGW_emptyAction svg{width:14px;height:14px}.KfIHGW_container[data-theme=dark] .KfIHGW_emptyAction{color:#171717;background:#f5f5f5}.KfIHGW_container[data-theme=dark] .KfIHGW_emptyAction:hover{background:#e5e5e5}";
		const tagId = "dsh-prompt-library/promptButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-prompt-library";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var promptButton_module_css_421fbebaf7_default = {
			"body": "KfIHGW_body",
			"container": "KfIHGW_container",
			"empty": "KfIHGW_empty",
			"emptyAction": "KfIHGW_emptyAction",
			"emptyHint": "KfIHGW_emptyHint",
			"header": "KfIHGW_header",
			"item": "KfIHGW_item",
			"itemContent": "KfIHGW_itemContent",
			"itemIcon": "KfIHGW_itemIcon",
			"itemMain": "KfIHGW_itemMain",
			"itemName": "KfIHGW_itemName",
			"manageButton": "KfIHGW_manageButton",
			"overlay": "KfIHGW_overlay",
			"pinnedIcon": "KfIHGW_pinnedIcon",
			"promptBtn": "KfIHGW_promptBtn",
			"promptIcon": "KfIHGW_promptIcon",
			"search": "KfIHGW_search",
			"searchEmpty": "KfIHGW_searchEmpty",
			"searchInput": "KfIHGW_searchInput",
			"title": "KfIHGW_title",
			"visible": "KfIHGW_visible"
		};
		// src/client/library/PromptButton.tsx
		/** 下拉固定尺寸与定位参数（原 _positionPromptDropdown）。 */
		const DROPDOWN_WIDTH = 320;
		const DROPDOWN_HEIGHT = 400;
		const TOP_PADDING = 20;
		const GAP = 8;
		/** 追加文本的最终草稿（原 _defaultInsertText 的 textarea 分支）。 */
		function appendPromptText(existingText, text) {
			if (existingText.trim() === "") return `${text}\n\n`;
			return `${existingText.replace(/\n+$/, "")}\n\n${text}\n\n`;
		}
		/** 宿主「命令」按钮（工具行里唯一的 listbox 弹出按钮，InputBar 的 .add）。 */
		const COMMAND_BTN_SELECTOR = "button[aria-haspopup=\"listbox\"]";
		/**
		* 提示词库 tooltip 配色：单套固定形态，直接引宿主原生 tooltip 的 token
		* （ui-primitives Tooltip 的深色底板 + 恒白文字；边框取底色即隐形）。
		*/
		const LIBRARY_TIP_COLOR = {
			backgroundColor: "var(--dsw-alias-tooltip-bg)",
			textColor: "var(--dsw-static-neutral-bluish-00)",
			borderColor: "var(--dsw-alias-tooltip-bg)"
		};
		/**
		* 在【命令】按钮紧邻右侧造一个 portal 挂载座。
		* 容器 display: contents，提示词按钮直接成为工具行的 flex 项、
		* 吃行自己的 16px 间距；行卸载（会话切换）时本组件同月同灭，
		* 清理函数移除容器即可。
		* @param markerRef - 渲染在槽位里的隐藏锚点，向上定位工具行。
		* @returns 挂载座；定位不到命令按钮时为 null（调用方就地渲染兜底）。
		*/
		function useCommandSideSeat(markerRef) {
			const [seat, setSeat] = (0, react.useState)(null);
			(0, react.useLayoutEffect)(() => {
				const marker = markerRef.current;
				if (marker === null) return;
				let tools = marker.parentElement;
				while (tools !== null && tools.querySelector(COMMAND_BTN_SELECTOR) === null) tools = tools.parentElement;
				const commandBtn = tools?.querySelector(COMMAND_BTN_SELECTOR) ?? null;
				if (tools === null || commandBtn === null) return;
				let anchorTop = commandBtn;
				while (anchorTop.parentElement !== null && anchorTop.parentElement !== tools) anchorTop = anchorTop.parentElement;
				const container = document.createElement("div");
				container.style.display = "contents";
				tools.insertBefore(container, anchorTop.nextSibling);
				setSeat(container);
				return () => {
					container.remove();
					setSeat(null);
				};
			}, [markerRef]);
			return seat;
		}
		function PromptButton({ useInput, inputActions, t }) {
			const library = (0, react.useSyncExternalStore)(promptsStore.subscribe, promptsStore.get);
			const draft = useInput((s) => s.draft);
			const [dark, setDark] = (0, react.useState)(() => detectDarkTheme());
			(0, react.useEffect)(() => observeTheme(() => {
				setDark(detectDarkTheme());
			}), []);
			const [open, setOpen] = (0, react.useState)(false);
			const btnRef = (0, react.useRef)(null);
			const markerRef = (0, react.useRef)(null);
			const draftRef = (0, react.useRef)(draft);
			draftRef.current = draft;
			const seat = useCommandSideSeat(markerRef);
			const insertPrompt = (prompt) => {
				if (prompt.content === "") return;
				let composer = markerRef.current?.parentElement ?? null;
				while (composer !== null && !composer.querySelector("[data-input-scroll]")) composer = composer.parentElement;
				const scroll = composer?.querySelector("[data-input-scroll]") ?? null;
				inputActions.setDraft(appendPromptText(draftRef.current, prompt.content));
				setTimeout(() => {
					const input = scroll?.querySelector("textarea, [contenteditable=\"true\"]");
					if (!input?.isConnected) return;
					input.focus();
					if (input instanceof HTMLTextAreaElement) input.setSelectionRange(input.value.length, input.value.length);
					else {
						const selection = window.getSelection();
						if (selection !== null) {
							const range = document.createRange();
							range.selectNodeContents(input);
							range.collapse(false);
							selection.removeAllRanges();
							selection.addRange(range);
						}
					}
					if (scroll !== null) scroll.scrollTop = scroll.scrollHeight;
				}, 50);
			};
			const libraryLabel = t("prompt.tooltipLibrary");
			const button = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				ref: btnRef,
				type: "button",
				className: promptButton_module_css_421fbebaf7_default.promptBtn,
				"aria-label": libraryLabel,
				"aria-expanded": open,
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					tooltip.hide(true);
					setOpen((v) => !v);
				},
				onMouseEnter: (e) => {
					tooltip.show("prompt-btn-library", e.currentTarget, libraryLabel, {
						placement: "top",
						showDelay: 300,
						noArrow: true,
						size: "small",
						color: LIBRARY_TIP_COLOR
					});
				},
				onMouseLeave: () => {
					tooltip.hide();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					className: promptButton_module_css_421fbebaf7_default.promptIcon,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": true,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" })
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					ref: markerRef,
					hidden: true
				}),
				seat !== null ? (0, react_dom.createPortal)(button, seat) : button,
				open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptDropdown, {
					anchor: btnRef.current,
					dark,
					prompts: library.prompts,
					t,
					onClose: () => {
						setOpen(false);
					},
					onItemClick: (p) => {
						setOpen(false);
						insertPrompt(p);
					}
				}) : null
			] });
		}
		/** 提示词下拉面板（原 createPromptDropdownUI，portal 到 body）。 */
		function PromptDropdown({ anchor, dark, prompts, t, onClose, onItemClick }) {
			const containerRef = (0, react.useRef)(null);
			const [visible, setVisible] = (0, react.useState)(false);
			const [query, setQuery] = (0, react.useState)("");
			(0, react.useLayoutEffect)(() => {
				const el = containerRef.current;
				if (el === null || anchor === null) return;
				const buttonRect = anchor.getBoundingClientRect();
				let left = buttonRect.left;
				if (left + DROPDOWN_WIDTH > window.innerWidth - 8) left = window.innerWidth - DROPDOWN_WIDTH - 8;
				left = Math.max(8, left);
				const top = Math.max(TOP_PADDING, buttonRect.top - GAP - DROPDOWN_HEIGHT);
				el.style.width = `${DROPDOWN_WIDTH}px`;
				el.style.height = `${DROPDOWN_HEIGHT}px`;
				el.style.left = `${left}px`;
				el.style.top = `${top}px`;
			}, [anchor]);
			(0, react.useEffect)(() => {
				const raf = requestAnimationFrame(() => {
					setVisible(true);
				});
				return () => {
					cancelAnimationFrame(raf);
				};
			}, []);
			(0, react.useEffect)(() => {
				const onClick = (e) => {
					const target = e.target;
					if (containerRef.current?.contains(target) !== true && target !== anchor && anchor?.contains(target) !== true) {
						tooltip.hide(true);
						onClose();
					}
				};
				const timer = setTimeout(() => {
					document.addEventListener("click", onClick, true);
				}, 0);
				return () => {
					clearTimeout(timer);
					document.removeEventListener("click", onClick, true);
				};
			}, []);
			const sorted = sortPrompts(prompts);
			const q = query.trim().toLowerCase();
			const filtered = q === "" ? sorted : sorted.filter((p) => p.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
			const openManage = () => {
				tooltip.hide(true);
				onClose();
				libraryPanel.set("prompts");
			};
			const showManageTooltip = (target) => {
				tooltip.show("prompt-manage", target, t("prompt.manage"), {
					placement: "top",
					noArrow: true,
					size: "small",
					color: LIBRARY_TIP_COLOR
				});
			};
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: promptButton_module_css_421fbebaf7_default.overlay,
				onClick: onClose
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: containerRef,
				className: visible ? `${promptButton_module_css_421fbebaf7_default.container} ${promptButton_module_css_421fbebaf7_default.visible}` : promptButton_module_css_421fbebaf7_default.container,
				"data-theme": dark ? "dark" : "light",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: promptButton_module_css_421fbebaf7_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: promptButton_module_css_421fbebaf7_default.title,
							children: t("prompt.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: promptButton_module_css_421fbebaf7_default.manageButton,
							"aria-label": t("prompt.manage"),
							onClick: openManage,
							onMouseEnter: (event) => showManageTooltip(event.currentTarget),
							onFocus: (event) => showManageTooltip(event.currentTarget),
							onMouseLeave: () => tooltip.hide(),
							onBlur: () => tooltip.hide(),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
								viewBox: "0 0 14 14",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "2",
								strokeLinecap: "round",
								"aria-hidden": true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 1V13M1 7H13" })
							})
						})]
					}),
					sorted.length >= 5 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: promptButton_module_css_421fbebaf7_default.search,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							className: promptButton_module_css_421fbebaf7_default.searchInput,
							placeholder: t("prompt.search"),
							autoComplete: "off",
							value: query,
							onChange: (e) => {
								setQuery(e.target.value);
							}
						})
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: promptButton_module_css_421fbebaf7_default.body,
						children: sorted.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: promptButton_module_css_421fbebaf7_default.empty,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: promptButton_module_css_421fbebaf7_default.emptyHint,
								children: t("prompt.emptyHint")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: promptButton_module_css_421fbebaf7_default.emptyAction,
								onClick: (e) => {
									e.stopPropagation();
									openManage();
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									width: "14",
									height: "14",
									viewBox: "0 0 14 14",
									fill: "none",
									xmlns: "http://www.w3.org/2000/svg",
									"aria-hidden": true,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										d: "M7 1V13M1 7H13",
										stroke: "currentColor",
										strokeWidth: "2",
										strokeLinecap: "round"
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("prompt.add") })]
							})]
						}) : filtered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: promptButton_module_css_421fbebaf7_default.searchEmpty,
							children: t("prompt.noResults")
						}) : filtered.map((prompt) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptItem, {
							prompt,
							onClick: () => {
								onItemClick(prompt);
							}
						}, prompt.id))
					})
				]
			})] }), document.body);
		}
		/** 单条提示词（原 _promptDropdownCreateItem：置顶图标 + 溢出时 hover tooltip）。 */
		function PromptItem({ prompt, onClick }) {
			const contentRef = (0, react.useRef)(null);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: promptButton_module_css_421fbebaf7_default.item,
				onClick,
				onMouseEnter: (e) => {
					const contentEl = contentRef.current;
					if (prompt.content === "" || contentEl === null) return;
					if (contentEl.scrollWidth <= contentEl.clientWidth) return;
					tooltip.show(`prompt-dd-${prompt.id}`, e.currentTarget, prompt.content, {
						placement: "right",
						maxWidth: 300,
						showDelay: 300,
						gap: 14
					});
				},
				onMouseLeave: () => {
					tooltip.hide();
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: promptButton_module_css_421fbebaf7_default.itemMain,
					children: [prompt.pinned === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${promptButton_module_css_421fbebaf7_default.itemIcon} ${promptButton_module_css_421fbebaf7_default.pinnedIcon}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "#facc15",
							strokeWidth: "2.5",
							"aria-hidden": true,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: "5",
									y1: "3",
									x2: "19",
									y2: "3"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: "12",
									y1: "7",
									x2: "12",
									y2: "21"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "8 11 12 7 16 11" })
							]
						})
					}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: promptButton_module_css_421fbebaf7_default.itemName,
						children: prompt.name
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: contentRef,
					className: promptButton_module_css_421fbebaf7_default.itemContent,
					children: prompt.content
				})]
			});
		}
		// src/client/index.ts
		const inject = [
			"slots",
			"locale",
			"theme"
		];
		function apply(ctx) {
			bindTheme(ctx);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-prompt-library: locale");
			const onUnsaved = () => {
				toast.warning(ctx.locale.bind(NS)("panel.sessionOnly"));
			};
			bindStorage(ctx, onUnsaved);
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "dsh-prompt-library",
				locale: NS
			}, PromptButton));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-prompt-library",
				locale: NS
			}, PanelHost));
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "dsh-prompt-library",
				locale: NS,
				order: 80
			}, SettingsEntry));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
