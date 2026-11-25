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
		* 微型外部 store：命令式 API（toast.show / dropdown.show 等）与 React
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
		// src/client/shared/settings.ts
		const KEY$1 = "dsh.prompt-library.input";
		const DEFAULTS = {
			smartEnterMode: "doubleEnter",
			smartEnterEnabled: false,
			smartEnterToastCount: 0,
			preventAutoScrollEnabled: true
		};
		const bus$4 = new Bus(DEFAULTS);
		let unsaved$1 = false;
		let reportUnsaved$1 = () => {};
		function parseInputSettings(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid input settings");
			const source = value;
			const patch = {};
			for (const key of ["smartEnterEnabled", "preventAutoScrollEnabled"]) {
				if (!(key in source)) continue;
				if (typeof source[key] !== "boolean") throw new Error("Invalid input preference");
				patch[key] = source[key];
			}
			if ("smartEnterMode" in source) {
				const mode = source.smartEnterMode;
				if (mode !== "doubleEnter" && mode !== "ctrlEnter" && mode !== "shiftEnter") throw new Error("Invalid Enter mode");
				patch.smartEnterMode = mode;
			}
			if ("smartEnterToastCount" in source) {
				const count = source.smartEnterToastCount;
				if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw new Error("Invalid tip count");
				patch.smartEnterToastCount = count;
			}
			return patch;
		}
		function persist$1(settings) {
			try {
				localStorage.setItem(KEY$1, JSON.stringify(settings));
				unsaved$1 = false;
			} catch {
				if (!unsaved$1) reportUnsaved$1();
				unsaved$1 = true;
			}
		}
		function normalize(value) {
			const source = typeof value === "object" && value !== null ? value : {};
			return {
				smartEnterMode: source.smartEnterMode === "ctrlEnter" || source.smartEnterMode === "shiftEnter" ? source.smartEnterMode : "doubleEnter",
				smartEnterEnabled: source.smartEnterEnabled === true,
				smartEnterToastCount: typeof source.smartEnterToastCount === "number" ? source.smartEnterToastCount : 0,
				preventAutoScrollEnabled: source.preventAutoScrollEnabled !== false
			};
		}
		function load$1() {
			if (unsaved$1) return bus$4.get();
			const raw = localStorage.getItem(KEY$1);
			if (raw !== null) return normalize(JSON.parse(raw));
			let migrated = DEFAULTS;
			try {
				migrated = normalize(JSON.parse(localStorage.getItem("dsh.timeline.settings") ?? "{}"));
			} catch {}
			persist$1(migrated);
			return migrated;
		}
		function bindInputSettings(ctx, onUnsaved = () => {}) {
			ctx.effect(() => {
				reportUnsaved$1 = onUnsaved;
				const sync = () => {
					try {
						bus$4.set(load$1());
					} catch {}
				};
				sync();
				const refresh = (event) => {
					if (event.storageArea === localStorage && (event.key === KEY$1 || event.key === null)) sync();
				};
				window.addEventListener("storage", refresh);
				return () => {
					window.removeEventListener("storage", refresh);
					reportUnsaved$1 = () => {};
				};
			}, "dsh-prompt-library: input settings");
		}
		const settingsStore = {
			get: () => bus$4.get(),
			subscribe: bus$4.subscribe,
			set(patch) {
				let current = bus$4.get();
				try {
					current = load$1();
				} catch {}
				const next = normalize({
					...current,
					...patch
				});
				persist$1(next);
				bus$4.set(next);
			}
		};
		// src/client/library/storage.ts
		const KEY = "dsh.prompt-library.v1";
		const LEGACY_PROMPTS = "dsh.timeline.prompts";
		const LEGACY_SETTINGS = "dsh.timeline.settings";
		const bus$3 = new Bus({
			prompts: [],
			promptButtonEnabled: true
		});
		let unsaved = false;
		let reportUnsaved = () => {};
		function persist(value) {
			try {
				localStorage.setItem(KEY, JSON.stringify(value));
				unsaved = false;
			} catch {
				if (!unsaved) reportUnsaved();
				unsaved = true;
			}
		}
		function isRecord(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value);
		}
		function isPrompt(value) {
			return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.content === "string" && (value.pinned === void 0 || typeof value.pinned === "boolean");
		}
		function isLibrary(value) {
			return isRecord(value) && Array.isArray(value.prompts) && value.prompts.every(isPrompt) && typeof value.promptButtonEnabled === "boolean";
		}
		function readJson(key) {
			const raw = localStorage.getItem(key);
			return raw === null ? void 0 : JSON.parse(raw);
		}
		function load() {
			if (unsaved) return bus$3.get();
			const value = readJson(KEY);
			if (value !== void 0) return isLibrary(value) ? value : bus$3.get();
			let prompts = [];
			let enabled = true;
			try {
				const oldPrompts = readJson(LEGACY_PROMPTS);
				if (Array.isArray(oldPrompts)) prompts = oldPrompts.filter(isPrompt);
			} catch {}
			try {
				const settings = readJson(LEGACY_SETTINGS);
				if (isRecord(settings) && typeof settings.promptButtonEnabled === "boolean") enabled = settings.promptButtonEnabled;
			} catch {}
			const migrated = {
				prompts,
				promptButtonEnabled: enabled
			};
			persist(migrated);
			return migrated;
		}
		function reload() {
			try {
				bus$3.set(load());
			} catch {}
		}
		function bindStorage(ctx, onUnsaved = () => {}) {
			ctx.effect(() => {
				reportUnsaved = onUnsaved;
				reload();
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
		function update(transform) {
			let current = bus$3.get();
			try {
				current = load();
			} catch {}
			const next = transform(current);
			persist(next);
			bus$3.set(next);
		}
		function changeList(transform) {
			update((previous) => ({
				...previous,
				prompts: transform(previous.prompts)
			}));
		}
		const promptsStore = {
			get: () => bus$3.get(),
			subscribe: bus$3.subscribe,
			setButtonEnabled(promptButtonEnabled) {
				update((previous) => ({
					...previous,
					promptButtonEnabled
				}));
			},
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
					version: 1
				},
				data: {
					...bus$3.get(),
					inputSettings: settingsStore.get()
				}
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
			let enabled;
			let inputSettings;
			if (source === "dsh-prompt-library" && isLibrary(value.data)) {
				prompts = value.data.prompts;
				enabled = value.data.promptButtonEnabled;
				if ("inputSettings" in value.data) inputSettings = parseInputSettings(value.data.inputSettings);
			} else if (source === "AIChatTimeline-DSH" || source === void 0) {
				const legacy = value.data[LEGACY_PROMPTS];
				if (!Array.isArray(legacy) || !legacy.every(isPrompt)) throw new Error("Invalid prompt list");
				prompts = legacy;
				const settings = value.data[LEGACY_SETTINGS];
				if (settings !== void 0) inputSettings = parseInputSettings(settings);
				if (isRecord(settings) && typeof settings.promptButtonEnabled === "boolean") enabled = settings.promptButtonEnabled;
			} else throw new Error("Invalid backup");
			update((previous) => {
				const entries = /* @__PURE__ */ new Map();
				if (mode === "merge") for (const prompt of previous.prompts) entries.set(prompt.id, prompt);
				for (const prompt of prompts) entries.set(prompt.id, prompt);
				return {
					prompts: [...entries.values()],
					promptButtonEnabled: enabled ?? previous.promptButtonEnabled
				};
			});
			if (inputSettings !== void 0) settingsStore.set(inputSettings);
		}
		// \0dsh-css:src/client/ui/ui.module.css?a81be0b626.mjs
		const css$2 = ".fo0e9q_host{pointer-events:none;z-index:2147483647;width:0;height:0;position:fixed;top:0;left:0;overflow:visible}.fo0e9q_toast{z-index:2147483647;pointer-events:none;white-space:nowrap;align-items:center;gap:8px;max-width:400px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;display:flex;position:fixed}.fo0e9q_toastMultiline{box-sizing:border-box;white-space:pre-line;overflow-wrap:anywhere;max-width:min(400px,100vw - 16px)}.fo0e9q_toastMultilineCentered{width:max-content;margin-inline:auto;inset-inline:0}.fo0e9q_toastDefaultVisual{opacity:0;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:500;transition:opacity .15s,transform .15s;transform:translateY(-10px);box-shadow:0 4px 14px #00000026,0 1px 2px #0000000f}.fo0e9q_toastVisible{opacity:1!important}.fo0e9q_toastDefaultVisual.fo0e9q_toastVisible{transform:translateY(0)!important}.fo0e9q_toastIcon{font-size:16px}.fo0e9q_tooltipBase{box-sizing:border-box;background-color:var(--ui-tooltip-bg,#f8fafc);color:var(--ui-tooltip-text,#334155);border:1px solid var(--ui-tooltip-border,#e2e8f0);white-space:normal;word-break:break-word;z-index:2147483647;opacity:0;visibility:hidden;pointer-events:none;border-radius:8px;max-width:400px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;transition:opacity .15s,visibility .15s;position:fixed;box-shadow:0 4px 12px #00000026}.fo0e9q_tooltipBase.fo0e9q_tooltipVisible{opacity:1;visibility:visible}.fo0e9q_tooltipBase:before,.fo0e9q_tooltipBase:after{content:\"\";pointer-events:none;background:0 0;width:0;height:0;position:absolute}.fo0e9q_tooltipBase[data-placement=top]:before{bottom:-8px;left:var(--arrow-offset,50%);border-left:8px solid #0000;border-right:8px solid #0000;border-top:8px solid var(--ui-tooltip-border,#e2e8f0);margin-left:-8px}.fo0e9q_tooltipBase[data-placement=top]:after{bottom:-6px;left:var(--arrow-offset,50%);border-left:7px solid #0000;border-right:7px solid #0000;border-top:7px solid var(--ui-tooltip-bg,#f8fafc);margin-left:-7px}.fo0e9q_tooltipBase[data-placement=bottom]:before{top:-8px;left:var(--arrow-offset,50%);border-left:8px solid #0000;border-right:8px solid #0000;border-bottom:8px solid var(--ui-tooltip-border,#e2e8f0);margin-left:-8px}.fo0e9q_tooltipBase[data-placement=bottom]:after{top:-6px;left:var(--arrow-offset,50%);border-left:7px solid #0000;border-right:7px solid #0000;border-bottom:7px solid var(--ui-tooltip-bg,#f8fafc);margin-left:-7px}.fo0e9q_tooltipBase[data-placement=left]:before{right:-8px;top:var(--arrow-offset,50%);border-top:8px solid #0000;border-bottom:8px solid #0000;border-left:8px solid var(--ui-tooltip-border,#e2e8f0);margin-top:-8px}.fo0e9q_tooltipBase[data-placement=left]:after{right:-6px;top:var(--arrow-offset,50%);border-top:7px solid #0000;border-bottom:7px solid #0000;border-left:7px solid var(--ui-tooltip-bg,#f8fafc);margin-top:-7px}.fo0e9q_tooltipBase[data-placement=right]:before{left:-8px;top:var(--arrow-offset,50%);border-top:8px solid #0000;border-bottom:8px solid #0000;border-right:8px solid var(--ui-tooltip-border,#e2e8f0);margin-top:-8px}.fo0e9q_tooltipBase[data-placement=right]:after{left:-6px;top:var(--arrow-offset,50%);border-top:7px solid #0000;border-bottom:7px solid #0000;border-right:7px solid var(--ui-tooltip-bg,#f8fafc);margin-top:-7px}.fo0e9q_tooltipNoArrow:before,.fo0e9q_tooltipNoArrow:after{display:none!important}.fo0e9q_tooltipSmall{border-radius:6px;padding:4px 8px;font-size:12px}.fo0e9q_tooltipLarge{padding:12px 16px;font-size:17px}.fo0e9q_tooltipMini{z-index:2147483647;pointer-events:none;white-space:nowrap;background:var(--dsw-alias-tooltip-bg);color:#fff;opacity:0;border-radius:6px;padding:4px 8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:500;transition:opacity .12s;position:fixed;box-shadow:0 2px 8px #0003}.fo0e9q_tooltipMini[data-mini-theme=light]{color:#1f2937;background:#fff;box-shadow:0 2px 8px #0000001f}.fo0e9q_tooltipMini.fo0e9q_tooltipVisible{opacity:1}.fo0e9q_dropdownOverlay{z-index:2147483646;cursor:default;pointer-events:auto;background:0 0;position:fixed;inset:0}.fo0e9q_dropdown{z-index:2147483647;opacity:0;pointer-events:auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;max-height:400px;padding:6px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;transition:opacity .2s,transform .2s;position:fixed;overflow-y:auto;transform:translateY(-8px);box-shadow:0 4px 20px #00000014,0 2px 8px #0000000a}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdown{background:#262626;border-color:#404040;box-shadow:0 4px 20px #0000004d,0 2px 8px #0003}.fo0e9q_dropdown.fo0e9q_dropdownVisible{opacity:1;transform:translateY(0)}.fo0e9q_dropdown[data-placement^=top]{transform-origin:bottom}.fo0e9q_dropdown[data-placement^=bottom]{transform-origin:top}.fo0e9q_dropdownItem{cursor:pointer;color:#1f2937;user-select:none;border-radius:6px;align-items:center;gap:10px;margin:0 6px;padding:8px 12px;transition:background-color .1s;display:flex}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItem{color:#f5f5f5}.fo0e9q_dropdownItem:hover{background-color:#f3f4f6}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItem:hover{background-color:#333}.fo0e9q_dropdownItem:active{background-color:#e5e7eb}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItem:active{background-color:#3a3a3a}.fo0e9q_dropdownItemDisabled{opacity:.4;cursor:not-allowed;pointer-events:none}.fo0e9q_dropdownItemDanger{color:#ef4444}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemDanger{color:#f87171}.fo0e9q_dropdownItemDanger:hover{background-color:#fee2e2}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemDanger:hover{background-color:#450a0a}.fo0e9q_dropdownItemCreate .fo0e9q_dropdownItemLabel{color:#6b7280;font-style:italic;transition:color .15s}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemCreate .fo0e9q_dropdownItemLabel{color:#9ca3af}.fo0e9q_dropdownItemCreate:hover .fo0e9q_dropdownItemLabel{color:#1f2937}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemCreate:hover .fo0e9q_dropdownItemLabel{color:#f5f5f5}.fo0e9q_dropdownItemCreate .fo0e9q_dropdownItemIcon svg{color:#6128ff}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemCreate .fo0e9q_dropdownItemIcon svg{color:#8b5cf6}.fo0e9q_dropdownItemCreate:hover .fo0e9q_dropdownItemIcon svg{color:#6128ff}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemCreate:hover .fo0e9q_dropdownItemIcon svg{color:#8b5cf6}.fo0e9q_dropdownItemIcon{flex-shrink:0;justify-content:center;align-items:center;width:18px;height:18px;font-size:16px;line-height:1;display:flex}.fo0e9q_dropdownItemIcon svg{color:#6b7280;width:16px;height:16px}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemIcon svg{color:#9ca3af}.fo0e9q_dropdownItem:hover .fo0e9q_dropdownItemIcon svg{color:#374151}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItem:hover .fo0e9q_dropdownItemIcon svg{color:#d1d5db}.fo0e9q_dropdownItemDanger .fo0e9q_dropdownItemIcon svg{color:#ef4444}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemDanger .fo0e9q_dropdownItemIcon svg{color:#f87171}.fo0e9q_dropdownItemDanger:hover .fo0e9q_dropdownItemIcon svg{color:#ef4444}.fo0e9q_dropdownItemLabel{white-space:nowrap;text-overflow:ellipsis;flex:1;line-height:1.4;overflow:hidden}.fo0e9q_dropdownDivider{background-color:#e5e7eb;height:1px;margin:6px 0}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownDivider{background-color:#404040}.fo0e9q_dropdown::-webkit-scrollbar{width:8px}.fo0e9q_dropdown::-webkit-scrollbar-track{background:0 0}.fo0e9q_dropdown::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}.fo0e9q_dropdown::-webkit-scrollbar-thumb:hover{background:#9ca3af}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdown::-webkit-scrollbar-thumb{background:#404040}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdown::-webkit-scrollbar-thumb:hover{background:#525252}@media (width<=640px){.fo0e9q_dropdown{max-width:calc(100vw - 32px)}}.fo0e9q_dropdownItemArrow{color:#9ca3af;flex-shrink:0;margin-left:auto;padding-left:12px;font-size:18px;line-height:1;transition:color .15s}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemArrow,.fo0e9q_dropdownItemHasSub:hover .fo0e9q_dropdownItemArrow{color:#6b7280}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemHasSub:hover .fo0e9q_dropdownItemArrow{color:#9ca3af}.fo0e9q_dropdownSubmenu{z-index:2147483647!important}.fo0e9q_dropdownNoTruncate .fo0e9q_dropdownItemLabel{text-overflow:unset;white-space:nowrap;overflow:visible}.fo0e9q_dropdownItemSubActive{background-color:#f3f4f6}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemSubActive{background-color:#374151}.fo0e9q_dropdownItemSubActive:hover{background-color:#e5e7eb}.fo0e9q_host[data-theme=dark] .fo0e9q_dropdownItemSubActive:hover{background-color:#3a3a3a}.fo0e9q_popconfirmOverlay{z-index:2147483647;opacity:0;visibility:hidden;pointer-events:auto;background:#00000073;justify-content:center;align-items:center;transition:opacity .2s,visibility .2s;display:flex;position:fixed;inset:0}.fo0e9q_popconfirmOverlay.fo0e9q_popconfirmVisible{opacity:1;visibility:visible}.fo0e9q_popconfirm{background:#fff;border-radius:12px;width:400px;max-width:90vw;transition:transform .2s;transform:scale(.9)translateY(-20px);box-shadow:0 12px 32px #00000026}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirm{background:#2a2a2a}.fo0e9q_popconfirmOverlay.fo0e9q_popconfirmVisible .fo0e9q_popconfirm{transform:scale(1)translateY(0)}.fo0e9q_popconfirmContent{padding:24px}.fo0e9q_popconfirmTitle{color:#1f2937;margin-bottom:12px;font-size:18px;font-weight:600;line-height:1.4}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirmTitle{color:#f3f4f6}.fo0e9q_popconfirmText{color:#6b7280;margin-bottom:20px;font-size:14px;line-height:1.6}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirmText{color:#9ca3af}.fo0e9q_popconfirmActions{justify-content:flex-end;gap:12px;display:flex}.fo0e9q_popconfirmBtn{cursor:pointer;white-space:nowrap;border:none;border-radius:8px;padding:8px 20px;font-size:14px;font-weight:500;transition:all .2s}.fo0e9q_popconfirmBtn:hover{transform:translateY(-1px)}.fo0e9q_popconfirmBtn:active{transform:translateY(0)}.fo0e9q_popconfirmBtnCancel{color:#6b7280;background:#f3f4f6}.fo0e9q_popconfirmBtnCancel:hover{color:#374151;background:#e5e7eb}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirmBtnCancel{color:#d1d5db;background:#404040}.fo0e9q_host[data-theme=dark] .fo0e9q_popconfirmBtnCancel:hover{background:#4b5563}.fo0e9q_popconfirmBtnDanger{color:#fff;background:#ef4444}.fo0e9q_popconfirmBtnDanger:hover{background:#dc2626}.fo0e9q_popconfirmBtnPrimary{color:#fff;background:#3b82f6}.fo0e9q_popconfirmBtnPrimary:hover{background:#2563eb}.fo0e9q_popconfirmBtnSuccess{color:#fff;background:#22c55e}.fo0e9q_popconfirmBtnSuccess:hover{background:#16a34a}.fo0e9q_popconfirmBtnDefault{color:#fff;background:#1a1a1a}.fo0e9q_popconfirmBtnDefault:hover{background:#333}@media (width<=640px){.fo0e9q_popconfirm{width:320px}.fo0e9q_popconfirmContent{padding:20px}.fo0e9q_popconfirmTitle{font-size:16px}.fo0e9q_popconfirmText{font-size:13px}.fo0e9q_popconfirmBtn{padding:7px 16px;font-size:13px}}";
		const tagId$2 = "dsh-prompt-library/ui.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-prompt-library";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ui_module_css_a81be0b626_default = {
			"tooltipNoArrow": "fo0e9q_tooltipNoArrow",
			"dropdownItemLabel": "fo0e9q_dropdownItemLabel",
			"dropdownOverlay": "fo0e9q_dropdownOverlay",
			"popconfirmActions": "fo0e9q_popconfirmActions",
			"popconfirmBtnPrimary": "fo0e9q_popconfirmBtnPrimary",
			"dropdownItemHasSub": "fo0e9q_dropdownItemHasSub",
			"popconfirmVisible": "fo0e9q_popconfirmVisible",
			"toastMultiline": "fo0e9q_toastMultiline",
			"dropdownItemSubActive": "fo0e9q_dropdownItemSubActive",
			"dropdownDivider": "fo0e9q_dropdownDivider",
			"dropdownItemArrow": "fo0e9q_dropdownItemArrow",
			"popconfirm": "fo0e9q_popconfirm",
			"popconfirmText": "fo0e9q_popconfirmText",
			"toastVisible": "fo0e9q_toastVisible",
			"popconfirmBtn": "fo0e9q_popconfirmBtn",
			"popconfirmBtnDefault": "fo0e9q_popconfirmBtnDefault",
			"toastDefaultVisual": "fo0e9q_toastDefaultVisual",
			"toastMultilineCentered": "fo0e9q_toastMultilineCentered",
			"dropdown": "fo0e9q_dropdown",
			"dropdownNoTruncate": "fo0e9q_dropdownNoTruncate",
			"dropdownItem": "fo0e9q_dropdownItem",
			"tooltipSmall": "fo0e9q_tooltipSmall",
			"popconfirmBtnDanger": "fo0e9q_popconfirmBtnDanger",
			"dropdownItemIcon": "fo0e9q_dropdownItemIcon",
			"toast": "fo0e9q_toast",
			"dropdownItemCreate": "fo0e9q_dropdownItemCreate",
			"host": "fo0e9q_host",
			"toastIcon": "fo0e9q_toastIcon",
			"tooltipMini": "fo0e9q_tooltipMini",
			"tooltipVisible": "fo0e9q_tooltipVisible",
			"dropdownItemDisabled": "fo0e9q_dropdownItemDisabled",
			"dropdownSubmenu": "fo0e9q_dropdownSubmenu",
			"tooltipBase": "fo0e9q_tooltipBase",
			"popconfirmContent": "fo0e9q_popconfirmContent",
			"tooltipLarge": "fo0e9q_tooltipLarge",
			"popconfirmOverlay": "fo0e9q_popconfirmOverlay",
			"popconfirmTitle": "fo0e9q_popconfirmTitle",
			"popconfirmBtnSuccess": "fo0e9q_popconfirmBtnSuccess",
			"popconfirmBtnCancel": "fo0e9q_popconfirmBtnCancel",
			"dropdownItemDanger": "fo0e9q_dropdownItemDanger",
			"dropdownVisible": "fo0e9q_dropdownVisible"
		};
		// src/client/ui/toast.tsx
		/**
		* 全局 Toast：移植原扩展 GlobalToastManager。
		* - 四种类型（success/error/info/warning），配色/图标/时长逐参数保留；
		* - 队列管理：最多同时 3 个，居中 toast 自上而下堆叠（起始 60px、间距 10px）；
		* - 相对定位：传 target 时贴目标元素 top/bottom/left/right + gap，视口边界 8px 修正；
		* - className/iconType/useClassStyles 支持 AI 完成提醒的胶囊样式。
		* 命令式 API（toast.success 等）+ React 宿主（ToastHost，portal 到 body）。
		*/
		/** 原版 config（逐参数移植）。 */
		const CONFIG$1 = {
			maxVisible: 3,
			stackGap: 10,
			centerGap: 60,
			types: {
				success: {
					color: {
						light: {
							backgroundColor: "#ffffff",
							textColor: "#1f2937",
							borderColor: "#e5e7eb"
						},
						dark: {
							backgroundColor: "#ffffff",
							textColor: "#1f2937",
							borderColor: "#e5e7eb"
						}
					},
					icon: "✓",
					duration: 1e3,
					position: "top",
					gap: 10
				},
				error: {
					color: {
						light: {
							backgroundColor: "var(--dsw-alias-tooltip-bg)",
							textColor: "#ffffff",
							borderColor: "var(--dsw-alias-tooltip-bg)"
						},
						dark: {
							backgroundColor: "#ffffff",
							textColor: "#1f2937",
							borderColor: "#e5e7eb"
						}
					},
					icon: "⚠",
					duration: 1500,
					position: "top",
					gap: 10
				},
				info: {
					color: {
						light: {
							backgroundColor: "#ffffff",
							textColor: "#1f2937",
							borderColor: "#e5e7eb"
						},
						dark: {
							backgroundColor: "#ffffff",
							textColor: "#1f2937",
							borderColor: "#e5e7eb"
						}
					},
					icon: "✓",
					duration: 2e3,
					position: "top",
					gap: 10
				},
				warning: {
					color: {
						light: {
							backgroundColor: "var(--dsw-alias-tooltip-bg)",
							textColor: "#ffffff",
							borderColor: "var(--dsw-alias-tooltip-bg)"
						},
						dark: {
							backgroundColor: "#ffffff",
							textColor: "#1f2937",
							borderColor: "#e5e7eb"
						}
					},
					icon: "⚡",
					duration: 2e3,
					position: "top",
					gap: 10
				}
			}
		};
		let nextId = 1;
		const bus$2 = new Bus([]);
		const timers = /* @__PURE__ */ new Map();
		function remove(id, immediate) {
			const timer = timers.get(id);
			if (timer !== void 0) {
				clearTimeout(timer);
				timers.delete(id);
			}
			const current = bus$2.get().find((t) => t.id === id);
			if (current === void 0) return;
			if (immediate) {
				bus$2.update((list) => list.filter((t) => t.id !== id));
				return;
			}
			bus$2.update((list) => list.map((t) => t.id === id ? {
				...t,
				leaving: true
			} : t));
			const cleanupDelay = current.config.useClassStyles === true ? 320 : 200;
			setTimeout(() => {
				bus$2.update((list) => list.filter((t) => t.id !== id));
			}, cleanupDelay);
		}
		function show(type, message, options = {}) {
			if (message === "") return;
			const config = {
				...CONFIG$1.types[type],
				...options
			};
			const id = nextId++;
			bus$2.update((list) => {
				let next = [...list, {
					id,
					message,
					config,
					leaving: false
				}];
				const active = next.filter((t) => !t.leaving);
				if (active.length > CONFIG$1.maxVisible) {
					const oldest = active[0];
					next = next.filter((t) => t.id !== oldest.id);
					const timer = timers.get(oldest.id);
					if (timer !== void 0) {
						clearTimeout(timer);
						timers.delete(oldest.id);
					}
				}
				return next;
			});
			timers.set(id, setTimeout(() => {
				remove(id, false);
			}, config.duration));
		}
		/** 命令式 Toast API（等价原 window.globalToastManager）。 */
		const toast = {
			show,
			success: (message, target = null, options = {}) => {
				show("success", message, {
					target,
					...options
				});
			},
			error: (message, target = null, options = {}) => {
				show("error", message, {
					target,
					...options
				});
			},
			info: (message, target = null, options = {}) => {
				show("info", message, {
					target,
					...options
				});
			},
			warning: (message, target = null, options = {}) => {
				show("warning", message, {
					target,
					...options
				});
			},
			forceHideAll: () => {
				for (const timer of timers.values()) clearTimeout(timer);
				timers.clear();
				bus$2.set([]);
			}
		};
		/** check 图标（原 _createIconElement）。 */
		function CheckIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2.75 7.25L5.75 10.25L11.25 3.75",
					stroke: "currentColor",
					strokeWidth: "1.75",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		/**
		* Toast 宿主：渲染队列并按原版算法定位。
		* portal 到 body，且仅在有 toast 时挂载，保证插在收藏弹窗之后、不被挡住。
		* @param props - dark 为宿主主题（决定 light/dark 配色取值）。
		* @returns toast 列表。
		*/
		function ToastHost({ dark }) {
			const list = (0, react.useSyncExternalStore)(bus$2.subscribe, () => bus$2.get());
			const refs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const shown = (0, react.useRef)(/* @__PURE__ */ new Set());
			const hostRef = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				const centerToasts = list.filter((t) => t.config.target == null && !t.leaving);
				const relativeToasts = list.filter((t) => t.config.target != null && !t.leaving);
				let centerTop = CONFIG$1.centerGap;
				centerToasts.forEach((t) => {
					const el = refs.current.get(t.id);
					if (el === void 0) return;
					const rect = el.getBoundingClientRect();
					if (!t.config.multiline) el.style.left = `${(window.innerWidth - rect.width) / 2}px`;
					el.style.top = `${centerTop}px`;
					centerTop += rect.height + CONFIG$1.stackGap;
				});
				for (const t of relativeToasts) {
					const el = refs.current.get(t.id);
					const target = t.config.target;
					if (el === void 0 || target == null) continue;
					if (!target.isConnected) {
						remove(t.id, true);
						continue;
					}
					const targetRect = target.getBoundingClientRect();
					const toastRect = el.getBoundingClientRect();
					const gap = t.config.gap ?? 10;
					let x;
					let y;
					switch (t.config.position) {
						case "bottom":
							x = targetRect.left + (targetRect.width - toastRect.width) / 2;
							y = targetRect.bottom + gap;
							break;
						case "left":
							x = targetRect.left - toastRect.width - gap;
							y = targetRect.top + (targetRect.height - toastRect.height) / 2;
							break;
						case "right":
							x = targetRect.right + gap;
							y = targetRect.top + (targetRect.height - toastRect.height) / 2;
							break;
						default:
							x = targetRect.left + (targetRect.width - toastRect.width) / 2;
							y = targetRect.top - toastRect.height - gap;
					}
					const padding = 8;
					x = Math.max(padding, Math.min(x, window.innerWidth - toastRect.width - padding));
					y = Math.max(padding, Math.min(y, window.innerHeight - toastRect.height - padding));
					el.style.left = `${x}px`;
					el.style.top = `${y}px`;
				}
				for (const t of list) {
					const el = refs.current.get(t.id);
					if (el === void 0) continue;
					if (t.leaving) {
						el.classList.remove(ui_module_css_a81be0b626_default.toastVisible);
						continue;
					}
					if (shown.current.has(t.id)) continue;
					shown.current.add(t.id);
					requestAnimationFrame(() => {
						el.classList.add(ui_module_css_a81be0b626_default.toastVisible);
					});
				}
				for (const id of [...shown.current]) if (!list.some((t) => t.id === id)) shown.current.delete(id);
				const host = hostRef.current;
				if (host !== null && host.parentNode === document.body) document.body.appendChild(host);
			}, [list]);
			if (list.length === 0) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: hostRef,
				className: ui_module_css_a81be0b626_default.host,
				"data-theme": dark ? "dark" : "light",
				children: list.map((t) => {
					const useClass = t.config.useClassStyles === true;
					const colors = t.config.color === false ? null : dark ? (t.config.color ?? CONFIG$1.types.info.color).dark : (t.config.color ?? CONFIG$1.types.info.color).light;
					const classNames = [
						ui_module_css_a81be0b626_default.toast,
						useClass ? "" : ui_module_css_a81be0b626_default.toastDefaultVisual,
						t.config.multiline ? ui_module_css_a81be0b626_default.toastMultiline : "",
						t.config.multiline && t.config.target == null ? ui_module_css_a81be0b626_default.toastMultilineCentered : "",
						t.config.className === "ait-ai-complete-toast" ? ui_module_css_a81be0b626_default.toastAiComplete : "",
						t.config.className ?? ""
					].filter(Boolean).join(" ");
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: (el) => {
							if (el !== null) refs.current.set(t.id, el);
							else refs.current.delete(t.id);
						},
						className: classNames,
						style: colors !== null && !useClass ? {
							backgroundColor: colors.backgroundColor,
							color: colors.textColor,
							border: `1px solid ${colors.borderColor}`,
							...t.leaving ? {
								opacity: 0,
								transform: "translateY(-10px)"
							} : {}
						} : void 0,
						children: [t.config.iconType === "check" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ui_module_css_a81be0b626_default.toastIcon,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CheckIcon, {})
						}) : t.config.icon !== void 0 && t.config.icon !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ui_module_css_a81be0b626_default.toastIcon,
							children: t.config.icon
						}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t.message })]
					}, t.id);
				})
			}), document.body);
		}
		// src/client/locales.ts
		const NS = "dshPromptLibrary";
		const zh = {
			"panel.sessionOnly": "浏览器无法保存到本机，更改仅在本标签页有效。",
			"common.confirm": "确定",
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
			"prompt.commonSettingsTab": "常用设置",
			"prompt.allSettings": "全部设置",
			"prompt.share": "分享插件",
			"prompt.feedbackTitle": "反馈问题、提需求",
			"prompt.feedbackHint": "遇到 bug 或有功能想法，欢迎到 GitHub Issues 留言。",
			"prompt.feedbackButton": "去反馈",
			"prompt.githubStarTitle": "给一颗 🌟 支持",
			"prompt.githubStarHint": "如果提示词库对你有帮助，欢迎在 GitHub 点 Star 支持。",
			"prompt.githubStarButton": "去 GitHub",
			"prompt.preventAutoScrollLabel": "阻止发送后跳到底部",
			"prompt.preventAutoScrollHint": "向上查看历史时发送消息，页面保持在当前阅读位置，不跳到底部",
			"prompt.smartInputTitle": "换行与发送消息",
			"prompt.smartInputHint": "对话框，设置 Enter 键控制「换行」和「发送消息」",
			"prompt.settings": "设置",
			"smartEnter.toastDouble": "Enter键：单击换行，双击发送消息",
			"smartEnter.toastCtrl": "Enter键：直接换行，{ctrl}+Enter 发送",
			"smartEnter.toastShift": "Enter键：直接换行，Shift+Enter 发送",
			"panel.tabPrompt": "提示词",
			"panel.tabSmartInput": "输入框",
			"panel.tabDataSync": "数据同步",
			"panel.syncHint": "通过 JSON 文件手动备份或恢复数据，用于迁移到其他浏览器。",
			"panel.syncExportLabel": "导出",
			"panel.syncImportLabel": "导入",
			"panel.syncExportBtn": "导出数据",
			"panel.syncImportBtn": "选择文件导入",
			"panel.syncModeMerge": "合并",
			"panel.syncModeMergeDesc": "保留现有数据，与导入数据合并",
			"panel.syncModeOverwrite": "覆盖",
			"panel.syncModeOverwriteDesc": "清空现有数据，使用导入数据替换",
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
			"panel.promptBtnLabel": "显示提示词按钮",
			"panel.promptBtnHint": "把常用提示词保存起来，需要时快速调用。启用后，在对话框左侧显示提示词按钮。",
			"panel.smartEnterTitle": "换行与发送消息",
			"panel.smartEnterHint": "启用后，在 AI 对话输入框中，可通过 Enter 键换行，{mode} 发送消息。",
			"panel.smartEnterModeDouble": "快速双击 Enter",
			"panel.promptPin": "置顶"
		};
		const en = {
			"panel.sessionOnly": "Browser storage is unavailable. Changes apply to this tab only.",
			"common.confirm": "Confirm",
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
			"prompt.commonSettingsTab": "Settings",
			"prompt.allSettings": "All settings",
			"prompt.share": "Share extension",
			"prompt.feedbackTitle": "Report issues or request features",
			"prompt.feedbackHint": "Found a bug or have a feature idea? Leave feedback on GitHub Issues.",
			"prompt.feedbackButton": "Give feedback",
			"prompt.githubStarTitle": "Give a 🌟 to support",
			"prompt.githubStarHint": "If Prompt Library is useful to you, please support it with a GitHub Star.",
			"prompt.githubStarButton": "Go to GitHub",
			"prompt.preventAutoScrollLabel": "Keep reading position on send",
			"prompt.preventAutoScrollHint": "When you send a message while viewing earlier history, the page stays at your current reading position instead of jumping to the bottom",
			"prompt.smartInputTitle": "Line Break & Send",
			"prompt.smartInputHint": "In the chat box, set how the Enter key controls new lines and sending messages",
			"prompt.settings": "Settings",
			"smartEnter.toastDouble": "Enter key: Single press for new line, double press to send",
			"smartEnter.toastCtrl": "Enter: new line, {ctrl}+Enter: send",
			"smartEnter.toastShift": "Enter: new line, Shift+Enter: send",
			"panel.tabPrompt": "Prompts",
			"panel.tabSmartInput": "Input Box",
			"panel.tabDataSync": "Data Sync",
			"panel.syncHint": "Manually back up or restore data via JSON file for migration to other browsers.",
			"panel.syncExportLabel": "Export",
			"panel.syncImportLabel": "Import",
			"panel.syncExportBtn": "Export Data",
			"panel.syncImportBtn": "Select File to Import",
			"panel.syncModeMerge": "Merge",
			"panel.syncModeMergeDesc": "Keep existing data and merge with imported data",
			"panel.syncModeOverwrite": "Overwrite",
			"panel.syncModeOverwriteDesc": "Clear existing data and replace with imported data",
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
			"panel.promptBtnLabel": "Show Prompt Button",
			"panel.promptBtnHint": "Save your go-to prompts for quick access. When enabled, a prompt button will be displayed on the left side of the chat box.",
			"panel.smartEnterTitle": "Line Break & Send",
			"panel.smartEnterHint": "When enabled, press Enter for a new line in the AI chat input box. {mode} to send messages.",
			"panel.smartEnterModeDouble": "Quick double Enter",
			"panel.promptPin": "Pin"
		};
		// src/client/shared/currentSession.ts
		/** 新版 DSH 通过主视图的持有计数标识当前会话，旧版直接提供 current。 */
		function selectCurrentSessionId(sessions) {
			if ("current" in sessions) return sessions.current;
			return Object.values(sessions.byId).find((session) => (session?.retainedBy?.mainView ?? 0) > 0)?.id;
		}
		// src/client/ui/tooltip.tsx
		/**
		* 全局 Tooltip：移植原扩展 GlobalTooltipManager 的 button 型 tooltip
		* 与二级悬浮 mini tooltip（showOverlay）。
		* - button 型：showDelay 0 / hideDelay 100、placement 默认 bottom、gap 12、
		*   auto 时按 左>右>上>下 择位、视口 8px 边界修正、箭头随修正偏移；
		* - 安全网：滚动/点击外部/ESC/窗口失焦 强制隐藏；目标移出视口隐藏；
		* - mini：小号无箭头黑底提示（主 tooltip 内图标 hover 用），支持 light 反转。
		* 注：原 node 型 tooltip 已由时间轴 DotTooltip 组件化承载。
		*/
		/** tooltip 配色（light/dark 两套，原 config.types.button.color）。 */
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
		const miniBus = new Bus(null);
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
		/** 命令式 Tooltip API（等价原 window.globalTooltipManager 的 button/overlay 面）。 */
		const tooltip = {
			/** 显示 button 型 tooltip（原 show(id,'button',target,content)，富内容对应原 html 形态）。 */
			show(id, target, content, options = {}) {
				if (!target.isConnected || content === "" || content === null || content === void 0) return;
				const current = tipBus.get();
				if (current !== null && current.id === id) return;
				clearTimers();
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
				if (showTimer !== null) {
					clearTimeout(showTimer);
					showTimer = null;
				}
				if (immediate) {
					if (hideTimer !== null) {
						clearTimeout(hideTimer);
						hideTimer = null;
					}
					tipBus.set(null);
					return;
				}
				const delay = tipBus.get()?.options.hideDelay ?? 100;
				if (hideTimer !== null) clearTimeout(hideTimer);
				hideTimer = setTimeout(() => {
					hideTimer = null;
					tipBus.set(null);
				}, delay);
			},
			forceHideAll() {
				clearTimers();
				tipBus.set(null);
				miniBus.set(null);
			},
			isShowing(id) {
				return tipBus.get()?.id === id;
			},
			/** 二级悬浮 mini tooltip（原 showOverlay）。 */
			showOverlay(target, text, options = {}) {
				if (!target.isConnected) return;
				let theme = options.theme ?? null;
				if (theme === null) {
					const parent = target.closest("[data-tooltip-theme]");
					if (parent !== null) theme = parent.getAttribute("data-tooltip-theme") === "dark" ? "dark" : "light";
				}
				miniBus.set({
					target,
					text,
					placement: options.placement ?? "top",
					theme
				});
			},
			hideOverlay() {
				miniBus.set(null);
			}
		};
		/** 择位（原 _chooseBestPlacement：左>右>上>下）。 */
		function chooseBestPlacement(targetRect, tipRect) {
			const space = {
				left: targetRect.left,
				right: window.innerWidth - targetRect.right,
				top: targetRect.top,
				bottom: window.innerHeight - targetRect.bottom
			};
			const padding = 20;
			if (space.left >= tipRect.width + padding) return "left";
			if (space.right >= tipRect.width + padding) return "right";
			if (space.top >= tipRect.height + padding) return "top";
			return "bottom";
		}
		/**
		* Tooltip 宿主。
		* @param props - dark 为宿主主题。
		* @returns button 型 tooltip + mini tooltip。
		*/
		function TooltipHost({ dark }) {
			const busTip = (0, react.useSyncExternalStore)(tipBus.subscribe, () => tipBus.get());
			const mini = (0, react.useSyncExternalStore)(miniBus.subscribe, () => miniBus.get());
			const tipRef = (0, react.useRef)(null);
			const miniRef = (0, react.useRef)(null);
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
				tipRef.current?.classList.remove(ui_module_css_a81be0b626_default.tooltipVisible);
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
				el.classList.remove(ui_module_css_a81be0b626_default.tooltipVisible);
				const targetRect = tip.target.getBoundingClientRect();
				const tipRect = el.getBoundingClientRect();
				const gap = tip.options.gap ?? 12;
				let placement = tip.options.placement ?? "bottom";
				if (placement === "auto") placement = chooseBestPlacement(targetRect, tipRect);
				let left;
				let top;
				switch (placement) {
					case "left":
						left = targetRect.left - tipRect.width - gap;
						top = targetRect.top + (targetRect.height - tipRect.height) / 2;
						break;
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
				const pad = 8;
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
				requestAnimationFrame(() => {
					el.classList.add(ui_module_css_a81be0b626_default.tooltipVisible);
				});
			}, [tip]);
			(0, react.useEffect)(() => {
				if (tip === null) return;
				const onScroll = () => {
					tooltip.forceHideAll();
				};
				const onClick = (e) => {
					const t = e.target;
					if (t instanceof Node && (tip.target === t || tip.target.contains(t))) return;
					if (tipRef.current !== null && t instanceof Node && tipRef.current.contains(t)) return;
					tooltip.hide(true);
				};
				const onKeydown = (e) => {
					if (e.key === "Escape") tooltip.forceHideAll();
				};
				const onBlur = () => {
					tooltip.forceHideAll();
				};
				document.addEventListener("scroll", onScroll, true);
				document.addEventListener("click", onClick, true);
				document.addEventListener("keydown", onKeydown);
				window.addEventListener("blur", onBlur);
				const io = new IntersectionObserver((entries) => {
					for (const entry of entries) if (!entry.isIntersecting) tooltip.forceHideAll();
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
			(0, react.useLayoutEffect)(() => {
				const el = miniRef.current;
				if (el === null || mini === null) return;
				const targetRect = mini.target.getBoundingClientRect();
				const elRect = el.getBoundingClientRect();
				const gap = 6;
				let top;
				let left;
				if (mini.placement === "top") {
					top = targetRect.top - elRect.height - gap;
					left = targetRect.left + (targetRect.width - elRect.width) / 2;
				} else {
					top = targetRect.bottom + gap;
					left = targetRect.left + (targetRect.width - elRect.width) / 2;
				}
				if (left < 4) left = 4;
				if (left + elRect.width > window.innerWidth - 4) left = window.innerWidth - elRect.width - 4;
				if (top < 4) top = targetRect.bottom + gap;
				el.style.top = `${top}px`;
				el.style.left = `${left}px`;
				requestAnimationFrame(() => {
					el.classList.add(ui_module_css_a81be0b626_default.tooltipVisible);
				});
			}, [mini]);
			const custom = tip?.options.color;
			const palette = custom === void 0 ? BUTTON_COLORS : "light" in custom ? custom : {
				light: custom,
				dark: custom
			};
			const surfaceDark = tip?.options.theme === "inverse" ? !dark : dark;
			const colors = surfaceDark ? palette.dark : palette.light;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [tip !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: tipRef,
				className: [
					ui_module_css_a81be0b626_default.tooltipBase,
					tip.options.noArrow === true ? ui_module_css_a81be0b626_default.tooltipNoArrow : "",
					tip.options.size === "small" ? ui_module_css_a81be0b626_default.tooltipSmall : "",
					tip.options.size === "large" ? ui_module_css_a81be0b626_default.tooltipLarge : ""
				].filter(Boolean).join(" "),
				role: "tooltip",
				"data-tooltip-theme": surfaceDark ? "dark" : "light",
				style: {
					maxWidth: `${tip.options.maxWidth ?? 400}px`,
					backgroundColor: colors.backgroundColor,
					color: colors.textColor,
					borderColor: colors.borderColor,
					"--ui-tooltip-bg": colors.backgroundColor,
					"--ui-tooltip-text": colors.textColor,
					"--ui-tooltip-border": colors.borderColor
				},
				children: tip.content
			}) : null, mini !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: miniRef,
				className: ui_module_css_a81be0b626_default.tooltipMini,
				"data-mini-theme": mini.theme ?? void 0,
				children: mini.text
			}) : null] });
		}
		// src/client/ui/popconfirm.tsx
		/**
		* 全局确认弹窗：移植原扩展 GlobalPopconfirmManager。
		* title + content + 取消/确认双按钮，确认键四种变体（danger 默认/primary/
		* success/default），点击遮罩外部与 ESC 取消，Promise<boolean> 返回。
		*/
		const bus$1 = new Bus(null);
		function close(result) {
			const current = bus$1.get();
			if (current === null || current.closing) return;
			bus$1.set({
				...current,
				closing: true
			});
			current.resolve(result);
			setTimeout(() => {
				if (bus$1.get()?.closing === true) bus$1.set(null);
			}, 200);
		}
		/** 命令式 Popconfirm API（等价原 window.globalPopconfirmManager）。 */
		const popconfirm = {
			show(options) {
				return new Promise((resolve) => {
					const current = bus$1.get();
					if (current !== null && !current.closing) close(false);
					if ((options.title ?? "") === "" && (options.content ?? "") === "") {
						resolve(false);
						return;
					}
					bus$1.set({
						...options,
						resolve,
						closing: false
					});
				});
			},
			hide(result = false) {
				close(result);
			}
		};
		/** 确认键变体 → 类名。 */
		const CONFIRM_CLASS = {
			danger: ui_module_css_a81be0b626_default.popconfirmBtnDanger,
			primary: ui_module_css_a81be0b626_default.popconfirmBtnPrimary,
			success: ui_module_css_a81be0b626_default.popconfirmBtnSuccess,
			default: ui_module_css_a81be0b626_default.popconfirmBtnDefault
		};
		/**
		* Popconfirm 宿主。
		* @param props - 词典默认按钮文案。
		* @returns 遮罩 + 弹窗。
		*/
		function PopconfirmHost({ defaultConfirmText, defaultCancelText }) {
			const state = (0, react.useSyncExternalStore)(bus$1.subscribe, () => bus$1.get());
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
				className: !state.closing && entered ? `${ui_module_css_a81be0b626_default.popconfirmOverlay} ${ui_module_css_a81be0b626_default.popconfirmVisible}` : ui_module_css_a81be0b626_default.popconfirmOverlay,
				onClick: (e) => {
					if (e.target === e.currentTarget) close(false);
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ui_module_css_a81be0b626_default.popconfirm,
					role: "alertdialog",
					"aria-modal": "true",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ui_module_css_a81be0b626_default.popconfirmContent,
						children: [
							(state.title ?? "") !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ui_module_css_a81be0b626_default.popconfirmTitle,
								children: state.title
							}) : null,
							(state.content ?? "") !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ui_module_css_a81be0b626_default.popconfirmText,
								children: state.content
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ui_module_css_a81be0b626_default.popconfirmActions,
								children: [state.showCancel !== false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${ui_module_css_a81be0b626_default.popconfirmBtn} ${ui_module_css_a81be0b626_default.popconfirmBtnCancel}`,
									onClick: (e) => {
										e.stopPropagation();
										close(false);
									},
									children: state.cancelText ?? defaultCancelText
								}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${ui_module_css_a81be0b626_default.popconfirmBtn} ${CONFIRM_CLASS[state.confirmTextType ?? "danger"]}`,
									onClick: (e) => {
										e.stopPropagation();
										close(true);
									},
									children: state.confirmText ?? defaultConfirmText
								})]
							})
						]
					})
				})
			});
		}
		// src/client/ui/dropdown.tsx
		/**
		* 全局下拉菜单：移植原扩展 GlobalDropdownManager。
		* - 智能定位（bottom-left 等四方位 + 视口边界翻转/修正）；
		* - 透明遮罩阻挡下层点击；点击外部/滚动/resize 关闭；
		* - 菜单项：图标（ReactNode）、分割线、禁用、danger / create-action 变体；
		* - 子菜单：hover 展开、最多三级、右侧优先左侧回退、mouseleave 分层关闭。
		* 命令式 API（dropdown.show）+ React 宿主（DropdownHost，portal 到 body）。
		*/
		const bus = new Bus(null);
		let hideAnimTimer = null;
		let showSeq = 0;
		/** 命令式 Dropdown API（等价原 window.globalDropdownManager）。 */
		const dropdown = {
			show(options) {
				if (!options.trigger.isConnected || options.items.length === 0) return;
				const id = options.id ?? `dropdown-${Date.now()}`;
				const current = bus.get();
				if (current !== null && !current.closing && current.id === id) return;
				if (hideAnimTimer !== null) {
					clearTimeout(hideAnimTimer);
					hideAnimTimer = null;
				}
				showSeq += 1;
				bus.set({
					...options,
					id,
					seq: showSeq,
					closing: false
				});
			},
			hide(immediate = false) {
				const current = bus.get();
				if (current === null) return;
				if (hideAnimTimer !== null) {
					clearTimeout(hideAnimTimer);
					hideAnimTimer = null;
				}
				if (immediate) {
					bus.set(null);
					return;
				}
				bus.set({
					...current,
					closing: true
				});
				hideAnimTimer = setTimeout(() => {
					hideAnimTimer = null;
					bus.set(null);
				}, 150);
			},
			forceHideAll() {
				if (hideAnimTimer !== null) {
					clearTimeout(hideAnimTimer);
					hideAnimTimer = null;
				}
				bus.set(null);
			},
			isVisible() {
				const s = bus.get();
				return s !== null && !s.closing;
			}
		};
		let submenuKeySeq = 0;
		const CONFIG = {
			defaultWidth: 200,
			gap: 8,
			padding: 8
		};
		/** 主菜单定位（移植 _calculatePosition）。 */
		function calcMenuPosition(trigger, menuRect, preferred) {
			const triggerRect = trigger.getBoundingClientRect();
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const gap = CONFIG.gap;
			const padding = CONFIG.padding;
			let left;
			let top;
			let placement = preferred;
			switch (preferred) {
				case "bottom-right":
					left = triggerRect.right - menuRect.width;
					top = triggerRect.bottom + gap;
					break;
				case "top-left":
					left = triggerRect.left;
					top = triggerRect.top - menuRect.height - gap;
					break;
				case "top-right":
					left = triggerRect.right - menuRect.width;
					top = triggerRect.top - menuRect.height - gap;
					break;
				default:
					left = triggerRect.left;
					top = triggerRect.bottom + gap;
					placement = "bottom-left";
			}
			if (left < padding) left = padding;
			else if (left + menuRect.width > vw - padding) left = vw - menuRect.width - padding;
			if (top + menuRect.height > vh - padding) {
				const topPos = triggerRect.top - menuRect.height - gap;
				if (topPos >= padding) {
					top = topPos;
					placement = placement.replace("bottom", "top");
				} else top = vh - menuRect.height - padding;
			}
			if (top < padding) {
				const bottomPos = triggerRect.bottom + gap;
				if (bottomPos + menuRect.height <= vh - padding) {
					top = bottomPos;
					placement = placement.replace("top", "bottom");
				} else top = padding;
			}
			return {
				left: Math.round(left),
				top: Math.round(top),
				placement
			};
		}
		/** 子菜单定位（移植 _calculateSubmenuPosition：右侧优先、顶对齐、边界回退）。 */
		function calcSubmenuPosition(parentEl, menuRect) {
			const parentRect = parentEl.getBoundingClientRect();
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const gap = 7;
			let left;
			if (parentRect.right + gap + menuRect.width <= vw - 10) left = parentRect.right + gap;
			else left = parentRect.left - menuRect.width - gap;
			let top = parentRect.top;
			if (top + menuRect.height > vh - 10) top = vh - menuRect.height - 10;
			top = Math.max(10, top);
			return {
				left,
				top
			};
		}
		/** 单个菜单面板（主菜单与子菜单共用）。 */
		function MenuPanel({ state, items, level, submenus, actions, width, className, submenuInfo }) {
			const ref = (0, react.useRef)(null);
			const closing = submenuInfo?.closing === true;
			(0, react.useLayoutEffect)(() => {
				const el = ref.current;
				if (el === null) return;
				const rect = el.getBoundingClientRect();
				if (level === 0) {
					const pos = calcMenuPosition(state.trigger, rect, state.position ?? "bottom-left");
					el.style.left = `${pos.left}px`;
					el.style.top = `${pos.top}px`;
					el.setAttribute("data-placement", pos.placement);
				} else {
					if (submenuInfo === void 0) return;
					const pos = calcSubmenuPosition(submenuInfo.parentEl, rect);
					el.style.left = `${pos.left}px`;
					el.style.top = `${pos.top}px`;
				}
				requestAnimationFrame(() => {
					el.classList.add(ui_module_css_a81be0b626_default.dropdownVisible);
				});
			}, []);
			(0, react.useEffect)(() => {
				if (closing) ref.current?.classList.remove(ui_module_css_a81be0b626_default.dropdownVisible);
			}, [closing]);
			const onPanelLeave = (e) => {
				const related = e.relatedTarget;
				if (level === 0) {
					if (related instanceof Element) {
						const menu = related.closest("[data-dsh-dropdown-level]");
						if (menu !== null && menu.getAttribute("data-dsh-dropdown-level") !== "0") return;
						if (related.closest("[data-dsh-dropdown-overlay]") !== null) return;
					}
					actions.closeAllImmediate();
					return;
				}
				if (related instanceof Element) {
					const menu = related.closest("[data-dsh-dropdown-level]");
					if (menu !== null) {
						const targetLevel = Number(menu.getAttribute("data-dsh-dropdown-level"));
						if (targetLevel === 0 || targetLevel >= level) return;
					}
				}
				actions.closeFrom(level);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref,
				className: [
					ui_module_css_a81be0b626_default.dropdown,
					level > 0 ? ui_module_css_a81be0b626_default.dropdownSubmenu : "",
					className ?? ""
				].filter(Boolean).join(" "),
				"data-dsh-dropdown-level": level,
				style: {
					...level === 0 ? { width: `${width}px` } : {},
					...state.closing ? {
						opacity: 0,
						transform: "translateY(-8px)"
					} : {}
				},
				onMouseLeave: onPanelLeave,
				children: items.map((item, index) => {
					if (item.type === "divider") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: ui_module_css_a81be0b626_default.dropdownDivider }, `div-${index}`);
					const hasSubmenu = item.children !== void 0 && item.children.length > 0;
					const isSubActive = submenus.some((s) => s.level === level + 1 && s.parentItem === item && !s.closing);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: [
							ui_module_css_a81be0b626_default.dropdownItem,
							item.disabled === true ? ui_module_css_a81be0b626_default.dropdownItemDisabled : "",
							item.className === "danger" ? ui_module_css_a81be0b626_default.dropdownItemDanger : "",
							item.className === "create-action" ? ui_module_css_a81be0b626_default.dropdownItemCreate : "",
							hasSubmenu ? ui_module_css_a81be0b626_default.dropdownItemHasSub : "",
							isSubActive ? ui_module_css_a81be0b626_default.dropdownItemSubActive : ""
						].filter(Boolean).join(" "),
						onMouseEnter: (e) => {
							if (item.disabled === true) return;
							if (hasSubmenu) actions.open(item, e.currentTarget, level);
							else actions.closeFrom(level + 1);
						},
						onClick: (e) => {
							if (item.disabled === true) return;
							e.stopPropagation();
							item.onClick?.(item);
							if (level === 0) state.onSelect?.(item);
							dropdown.hide();
						},
						children: [
							item.icon !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ui_module_css_a81be0b626_default.dropdownItemIcon,
								children: item.icon
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ui_module_css_a81be0b626_default.dropdownItemLabel,
								children: item.label
							}),
							hasSubmenu ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ui_module_css_a81be0b626_default.dropdownItemArrow,
								children: "›"
							}) : null
						]
					}, `item-${index}`);
				})
			});
		}
		/** 单次打开的菜单实例（key=id:seq 隔离，子菜单状态随实例重建）。 */
		function DropdownInstance({ state }) {
			const submenusRef = (0, react.useRef)([]);
			const [submenus, setSubmenusState] = (0, react.useState)([]);
			const fadeTimersRef = (0, react.useRef)(/* @__PURE__ */ new Set());
			const commit = (next) => {
				submenusRef.current = next;
				setSubmenusState(next);
			};
			/** 淡出关闭 >= fromLevel 的子菜单（200ms 后移除，原 _hideSubmenusFromLevel）。 */
			const closeFrom = (fromLevel) => {
				const targets = submenusRef.current.filter((s) => s.level >= fromLevel && !s.closing);
				if (targets.length === 0) return;
				const keys = new Set(targets.map((t) => t.key));
				commit(submenusRef.current.map((s) => keys.has(s.key) ? {
					...s,
					closing: true
				} : s));
				const timer = setTimeout(() => {
					fadeTimersRef.current.delete(timer);
					commit(submenusRef.current.filter((s) => !keys.has(s.key)));
				}, 200);
				fadeTimersRef.current.add(timer);
			};
			/** 立即关闭全部子菜单（原 _hideAllSubmenus(true)）。 */
			const closeAllImmediate = () => {
				for (const timer of fadeTimersRef.current) clearTimeout(timer);
				fadeTimersRef.current.clear();
				if (submenusRef.current.length > 0) commit([]);
			};
			/** 展开子菜单（原 _showSubmenu）。 */
			const open = (item, parentEl, parentLevel) => {
				const submenuLevel = parentLevel + 1;
				if (submenuLevel > 2) return;
				if (submenusRef.current.some((s) => s.level === submenuLevel && s.parentItem === item && !s.closing)) return;
				closeFrom(submenuLevel);
				submenuKeySeq += 1;
				commit([...submenusRef.current, {
					key: submenuKeySeq,
					level: submenuLevel,
					parentItem: item,
					parentEl,
					closing: false
				}]);
			};
			const actions = {
				open,
				closeFrom,
				closeAllImmediate
			};
			(0, react.useEffect)(() => {
				if (state.closing) closeAllImmediate();
			}, [state.closing]);
			(0, react.useEffect)(() => () => {
				for (const timer of fadeTimersRef.current) clearTimeout(timer);
				fadeTimersRef.current.clear();
			}, []);
			(0, react.useEffect)(() => {
				if (state.closing) return;
				const onClick = (e) => {
					const t = e.target;
					if (t instanceof Element && t.closest("[data-dsh-dropdown-level]") !== null) return;
					dropdown.hide();
				};
				const onScroll = (e) => {
					const t = e.target;
					if (t instanceof Element && t.closest("[data-dsh-dropdown-level]") !== null) return;
					dropdown.hide();
				};
				const onResize = () => {
					dropdown.hide();
				};
				document.addEventListener("click", onClick, true);
				document.addEventListener("scroll", onScroll, true);
				window.addEventListener("resize", onResize);
				return () => {
					document.removeEventListener("click", onClick, true);
					document.removeEventListener("scroll", onScroll, true);
					window.removeEventListener("resize", onResize);
				};
			}, [state]);
			const width = state.width ?? CONFIG.defaultWidth;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ui_module_css_a81be0b626_default.dropdownOverlay,
					"data-dsh-dropdown-overlay": "",
					onMouseLeave: (e) => {
						const related = e.relatedTarget;
						if (related instanceof Element && related.closest("[data-dsh-dropdown-level]") !== null) return;
						closeAllImmediate();
					}
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuPanel, {
					state,
					items: state.items,
					level: 0,
					submenus,
					actions,
					width,
					className: state.className
				}),
				submenus.map((s) => {
					const children = s.parentItem.children ?? [];
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuPanel, {
						state,
						items: children,
						level: s.level,
						submenus,
						actions,
						width,
						submenuInfo: s
					}, `sub-${s.key}`);
				})
			] });
		}
		/**
		* Dropdown 宿主。
		* portal 到 body：收藏弹窗等也在 body / 更高层叠上下文，挂在 shell.overlay
		* 里会被挡住，表现为「收藏到」点击无反应。
		* @param props - dark 为宿主主题（portal 后需自带 data-theme 才能吃暗色样式）。
		* @returns 遮罩 + 主菜单 + 已展开的子菜单链。
		*/
		function DropdownHost({ dark }) {
			const state = (0, react.useSyncExternalStore)(bus.subscribe, () => bus.get());
			if (state === null) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ui_module_css_a81be0b626_default.host,
				"data-theme": dark ? "dark" : "light",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DropdownInstance, { state }, `${state.id}:${String(state.seq)}`)
			}), document.body);
		}
		// src/client/library/panel.ts
		const libraryPanel = new Bus(null);
		// \0dsh-css:src/client/library/panel.module.css?d2f88171ee.mjs
		const css$1 = "._Mcp9q_modal{z-index:99999;pointer-events:auto;box-sizing:border-box;background:0 0;border:none;justify-content:center;align-items:center;width:100vw;height:100vh;margin:0;padding:0;display:flex;position:fixed;inset:0}._Mcp9q_overlay{cursor:pointer;background:#00000080;border:none;margin:0;padding:0;animation:.2s ease-out _Mcp9q_panel-fade-in;position:absolute;inset:0}._Mcp9q_wrapper{z-index:1;text-align:left;letter-spacing:normal;word-spacing:normal;text-transform:none;text-indent:0;white-space:normal;color:#333;direction:ltr;background:#fff;border-radius:12px;width:820px;max-width:90vw;height:600px;max-height:80vh;margin:0;padding:0;font-style:normal;line-height:normal;text-decoration:none;animation:.3s cubic-bezier(.16,1,.3,1) _Mcp9q_panel-fade-in-scale;display:flex;position:relative;overflow:hidden;box-shadow:0 20px 60px #0000004d}._Mcp9q_sidebar{background:#f6f6f8;border-right:1px solid #e5e5e7;flex-direction:column;width:180px;display:flex}._Mcp9q_sidebarHeader{border-bottom:1px solid #0000000f;flex-shrink:0;align-items:center;gap:8px;height:56px;padding:0 12px;display:flex}._Mcp9q_close{cursor:pointer;color:#666;background:0 0;border:none;border-radius:8px;flex-shrink:0;justify-content:center;align-items:center;width:32px;height:32px;margin-left:5px;padding:0;transition:all .2s;display:flex}._Mcp9q_close:hover{color:#333;background:#0000001a}._Mcp9q_close:active{transform:scale(.95)}._Mcp9q_close svg{stroke-width:2.5px;width:18px;height:18px}._Mcp9q_sidebarTitle{color:#24324a;white-space:nowrap;letter-spacing:-.3px;margin-left:-2px;font-size:16px;font-weight:700}._Mcp9q_tabs{flex:1;padding:12px 0;overflow:hidden auto}._Mcp9q_tabs::-webkit-scrollbar{width:4px}._Mcp9q_tabs::-webkit-scrollbar-thumb{background:#0003;border-radius:2px}._Mcp9q_tabs::-webkit-scrollbar-track{background:0 0}._Mcp9q_tab{cursor:pointer;color:#666;text-align:left;background:0 0;border:none;border-radius:8px;align-items:center;gap:10px;width:calc(100% - 24px);margin:0 12px;padding:8px 12px;font-size:15px;transition:all .2s;display:flex}._Mcp9q_tab:hover{color:#333;background:#0000000a}._Mcp9q_tab._Mcp9q_tabActive{color:#7450ff;background:#7450ff1a;font-weight:500}._Mcp9q_tabIcon{flex-shrink:0;justify-content:center;align-items:center;width:20px;height:20px;font-size:18px;display:flex}._Mcp9q_tabIcon svg{color:currentColor;width:20px;height:20px;transition:color .2s}._Mcp9q_tabLabel{text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}._Mcp9q_footer{color:#888;border-top:none;padding:12px 10px 12px 24px;font-size:11px;line-height:1.6}._Mcp9q_footerVersion{color:#6d28d9;background:linear-gradient(135deg,#6d28d91a 0%,#4c1d951a 100%);border:1px solid #6d28d933;border-radius:10px;padding:3px 8px;font-size:10px;transition:opacity .15s;display:inline-block}._Mcp9q_main{background:#fff;flex-direction:column;flex:1;display:flex;overflow:hidden}._Mcp9q_header{background:#fafafa;border-bottom:1px solid #0000000f;flex-shrink:0;grid-template-columns:minmax(0,1fr) minmax(0,auto) minmax(max-content,1fr);align-items:center;height:56px;padding:0 18px;display:grid}._Mcp9q_headerActions{grid-column:3;justify-self:end;align-items:center;gap:8px;display:flex}._Mcp9q_shareBtn{color:#6b7280;cursor:pointer;background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;width:32px;height:32px;padding:0;transition:background .15s,color .15s,transform .15s;display:flex}._Mcp9q_shareBtn:hover{color:#374151;background:#0000000f}._Mcp9q_shareBtn:active{transform:scale(.96)}._Mcp9q_shareBtn svg{width:18px;height:18px}._Mcp9q_title{color:#333;text-overflow:ellipsis;white-space:nowrap;grid-column:2;margin:0;font-size:20px;font-weight:600;overflow:hidden}._Mcp9q_content{flex:1;padding:20px;overflow:hidden auto}._Mcp9q_content::-webkit-scrollbar{width:8px}._Mcp9q_content::-webkit-scrollbar-thumb{background:#0003;border-radius:4px}._Mcp9q_content::-webkit-scrollbar-track{background:0 0}@keyframes _Mcp9q_panel-fade-in{0%{opacity:0}to{opacity:1}}@keyframes _Mcp9q_panel-fade-in-scale{0%{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}._Mcp9q_settingsRoot{box-sizing:border-box;flex-direction:column;height:100%;padding:0;display:flex}._Mcp9q_settingsScroll{flex:1;min-height:0;padding-bottom:30px;overflow-y:auto}._Mcp9q_bottomDivider{background:#e5e7eb;flex-shrink:0;height:1px;margin:8px 12px}._Mcp9q_bottomSection{flex-shrink:0;padding:4px 6px 0}._Mcp9q_bottomSection ._Mcp9q_settingItem{padding:8px 10px}._Mcp9q_divider{background:#e5e7eb;height:1px;margin:20px 0}._Mcp9q_settingSection{margin-bottom:0}._Mcp9q_settingItem{background:#f9fafb;border-radius:8px;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px;transition:background .2s;display:flex}._Mcp9q_settingItem:hover{background:#f3f4f6}._Mcp9q_settingInfo{flex:1}._Mcp9q_settingLabel{color:#1f2937;align-items:center;gap:6px;margin-bottom:6px;font-size:15px;font-weight:500;display:flex}._Mcp9q_settingLabelIcon{flex-shrink:0;width:16px;height:16px}._Mcp9q_settingHint{color:#6b7280;font-size:13px;line-height:1.6}._Mcp9q_toggle{flex-shrink:0;width:48px;height:26px;display:inline-block;position:relative}._Mcp9q_toggle input{opacity:0;width:0;height:0}._Mcp9q_toggleSlider{cursor:pointer;corner-shape:round;background-color:#d1d5db;border-radius:999px;transition:background-color .3s;position:absolute;inset:0}._Mcp9q_toggleSlider:before{content:\"\";corner-shape:round;background-color:#fff;border-radius:50%;width:20px;height:20px;transition:transform .3s;position:absolute;bottom:3px;left:3px}._Mcp9q_toggle input:checked+._Mcp9q_toggleSlider{background-color:#000}._Mcp9q_toggle input:checked+._Mcp9q_toggleSlider:before{transform:translate(22px)}._Mcp9q_toggle input:focus+._Mcp9q_toggleSlider{box-shadow:0 0 0 3px #0000001a}._Mcp9q_promptListSection{padding:0}._Mcp9q_promptListHeader{justify-content:space-between;align-items:center;margin-bottom:6px;display:flex}._Mcp9q_promptListTitle{color:#1f2937;font-size:14px;font-weight:600}._Mcp9q_promptAddBtn{color:#fff;cursor:pointer;background:#000;border:none;border-radius:6px;align-items:center;gap:4px;padding:6px 12px;font-size:13px;font-weight:500;transition:all .15s;display:flex}._Mcp9q_promptAddBtn:hover{background:#333}._Mcp9q_promptAddBtn:active{transform:scale(.98)}._Mcp9q_promptAddBtn svg{width:14px;height:14px}._Mcp9q_promptListContainer{background:#f9fafb;border-radius:8px;padding:8px}._Mcp9q_promptEmpty{color:#9ca3af;flex-direction:column;justify-content:center;align-items:center;padding:32px 16px;display:flex}._Mcp9q_promptEmpty svg{opacity:.5;width:40px;height:40px;margin-bottom:8px}._Mcp9q_promptEmpty span{font-size:13px}._Mcp9q_promptItem{background:#fff;border:1px solid #0000;border-radius:6px;flex-direction:column;margin-bottom:6px;padding:10px 12px;transition:all .15s;display:flex}._Mcp9q_promptItem:last-child{margin-bottom:0}._Mcp9q_promptItem:hover{border-color:#eef0f2;box-shadow:0 1px 2px #00000008}._Mcp9q_promptItemContent{flex:1;min-width:0}._Mcp9q_promptItemHeader{justify-content:space-between;align-items:center;margin-bottom:2px;display:flex}._Mcp9q_promptItemName{color:#1f2937;flex:1;align-items:center;min-width:0;font-size:14px;font-weight:500;display:flex}._Mcp9q_promptItemNameText{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}._Mcp9q_promptItemText{color:#6b7280;word-break:break-word;align-items:flex-start;font-size:12px;line-height:1.5;display:flex}._Mcp9q_promptItemTextContent{-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1;display:-webkit-box;overflow:hidden}._Mcp9q_promptItemActions{opacity:0;flex-shrink:0;align-items:center;gap:2px;transition:opacity .15s;display:flex}._Mcp9q_promptItem:hover ._Mcp9q_promptItemActions{opacity:1}._Mcp9q_promptItemBtn{color:#6b7280;cursor:pointer;background:0 0;border:none;border-radius:4px;justify-content:center;align-items:center;width:24px;height:24px;padding:0;transition:all .15s;display:flex}._Mcp9q_promptItemBtn:hover{color:#374151;background:#f3f4f6}._Mcp9q_promptItemBtn svg{width:14px;height:14px}._Mcp9q_promptDeleteBtn:hover{color:#dc2626;background:#fee2e2}._Mcp9q_promptPinBadge{color:#facc15;flex-shrink:0;align-items:center;margin-right:4px;display:flex}._Mcp9q_promptPinBadge svg{stroke-width:3px;width:16px;height:16px}._Mcp9q_promptPinBtnActive{color:#facc15}._Mcp9q_promptPinBtnActive svg{stroke-width:2.5px}._Mcp9q_promptListContainer::-webkit-scrollbar{width:6px}._Mcp9q_promptListContainer::-webkit-scrollbar-track{background:0 0}._Mcp9q_promptListContainer::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}._Mcp9q_promptListContainer::-webkit-scrollbar-thumb:hover{background:#9ca3af}._Mcp9q_promptModalOverlay{z-index:2147483647;opacity:0;background:#00000080;justify-content:center;align-items:center;transition:opacity .2s;display:flex;position:fixed;inset:0}._Mcp9q_promptModalOverlay._Mcp9q_promptModalVisible{opacity:1}._Mcp9q_promptModal{text-align:left;letter-spacing:normal;text-transform:none;text-indent:0;direction:ltr;background:#fff;border-radius:12px;width:90%;max-width:480px;max-height:90vh;line-height:normal;transition:transform .2s;overflow:hidden;transform:scale(.95)translateY(10px);box-shadow:0 20px 60px #0003}._Mcp9q_promptModalOverlay._Mcp9q_promptModalVisible ._Mcp9q_promptModal{transform:scale(1)translateY(0)}._Mcp9q_promptModalHeader{border-bottom:1px solid #e5e7eb;justify-content:space-between;align-items:center;padding:16px 20px;display:flex}._Mcp9q_promptModalHeader h3{color:#1f2937;margin:0;font-size:16px;font-weight:600}._Mcp9q_promptModalClose{color:#6b7280;cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;width:32px;height:32px;padding:0;transition:all .15s;display:flex}._Mcp9q_promptModalClose:hover{color:#374151;background:#f3f4f6}._Mcp9q_promptModalClose svg{width:18px;height:18px}._Mcp9q_promptModalBody{padding:20px}._Mcp9q_promptModalField{margin-bottom:16px}._Mcp9q_promptModalField:last-child{margin-bottom:0}._Mcp9q_promptModalField label{color:#374151;margin-bottom:6px;font-size:13px;font-weight:500;display:block}._Mcp9q_requiredMark{color:#ef4444;margin-left:2px}._Mcp9q_promptModalInput,._Mcp9q_promptModalTextarea{color:#1f2937;box-sizing:border-box;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;outline:none;width:100%;padding:10px 12px;font-size:14px;transition:all .15s}._Mcp9q_promptModalInput:focus,._Mcp9q_promptModalTextarea:focus{background:#fff;border-color:#000;box-shadow:0 0 0 3px #0000001a}._Mcp9q_promptModalInput::placeholder,._Mcp9q_promptModalTextarea::placeholder{color:#9ca3af}._Mcp9q_promptModalTextarea{resize:none;min-height:60px;max-height:200px;font-family:inherit;line-height:1.5;overflow-y:auto}._Mcp9q_promptCharCounter{color:#9ca3af;justify-content:flex-end;align-items:center;margin-top:6px;font-size:12px;display:flex}._Mcp9q_promptModalFooter{background:#f9fafb;border-top:1px solid #e5e7eb;justify-content:flex-end;gap:8px;padding:16px 20px;display:flex}._Mcp9q_promptModalBtn{cursor:pointer;border-radius:6px;padding:8px 16px;font-size:14px;font-weight:500;transition:all .15s}._Mcp9q_promptModalCancel{color:#374151;background:#fff;border:1px solid #d1d5db}._Mcp9q_promptModalCancel:hover{background:#f3f4f6;border-color:#9ca3af}._Mcp9q_promptModalConfirm{color:#fff;background:#000;border:none}._Mcp9q_promptModalConfirm:hover{background:#333}._Mcp9q_promptModalConfirm:active{transform:scale(.98)}._Mcp9q_smartInputRoot{box-sizing:border-box;height:100%;padding:0;overflow-y:auto}._Mcp9q_smartEnterModeTrigger{color:#7450ff;cursor:pointer;border-bottom:1px dashed #7450ff;align-items:center;gap:3px;padding:0 1px;font-weight:500;transition:all .2s;display:inline-flex}._Mcp9q_smartEnterModeTrigger:hover{color:#5a3dd6;border-bottom-color:#5a3dd6}._Mcp9q_smartEnterModeTrigger svg{opacity:.7;flex-shrink:0;transition:transform .2s}._Mcp9q_smartEnterModeTrigger:hover svg{transform:translateY(1px)}._Mcp9q_exportRoot,._Mcp9q_syncRoot{box-sizing:border-box;height:100%;padding:0;overflow-y:auto}._Mcp9q_syncSection{background:#f9fafb;border-radius:8px;margin-bottom:16px;padding:16px}._Mcp9q_syncSection:last-of-type{margin-bottom:0}._Mcp9q_syncTitle{color:#1f2937;align-items:center;margin-bottom:8px;font-size:15px;font-weight:500;display:flex}._Mcp9q_syncTitle svg{flex-shrink:0;margin-right:6px}._Mcp9q_syncHint{color:#6b7280;margin-bottom:16px;font-size:13px;line-height:1.6}._Mcp9q_syncBtn{color:#fff;cursor:pointer;background:#000;border:none;border-radius:6px;align-items:center;gap:8px;padding:10px 20px;font-size:14px;font-weight:500;transition:all .2s;display:inline-flex}._Mcp9q_syncBtn:hover{background:#1f2937}._Mcp9q_syncBtn:active{transform:scale(.98)}._Mcp9q_syncBtn:disabled{opacity:.6;cursor:not-allowed}._Mcp9q_syncBtn svg{width:18px;height:18px}._Mcp9q_syncGroup{flex-direction:column;gap:14px;display:flex}._Mcp9q_syncItem{align-items:flex-start;gap:14px;display:flex}._Mcp9q_syncItemLabel{color:#6b7280;flex-shrink:0;width:36px;padding-top:10px;font-size:13px;font-weight:500}._Mcp9q_syncItemBody{flex:1;min-width:0}._Mcp9q_syncItemBody ._Mcp9q_syncBtn{justify-content:center;width:100%}._Mcp9q_syncItemBody ._Mcp9q_importOptions{margin-bottom:10px}._Mcp9q_importOptions{flex-direction:column;gap:10px;margin-bottom:16px;display:flex}._Mcp9q_importOption{cursor:pointer;background:#fff;border:1px solid #e5e7eb;border-radius:6px;align-items:flex-start;gap:12px;padding:12px;transition:all .2s;display:flex}._Mcp9q_importOption:hover{background:#f3f4f6;border-color:#d1d5db}._Mcp9q_importOption:has(input:checked){background:#f3f4f6;border-color:#000}._Mcp9q_importOption input[type=radio]{opacity:0;width:0;height:0;position:absolute}._Mcp9q_optionRadio{corner-shape:round;border:2px solid #d1d5db;border-radius:50%;flex-shrink:0;width:18px;height:18px;margin-top:2px;transition:all .2s;position:relative}._Mcp9q_importOption:has(input:checked) ._Mcp9q_optionRadio{border-color:#000}._Mcp9q_optionRadio:after{content:\"\";corner-shape:round;background:#000;border-radius:50%;width:10px;height:10px;transition:transform .2s;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)scale(0)}._Mcp9q_importOption:has(input:checked) ._Mcp9q_optionRadio:after{transform:translate(-50%,-50%)scale(1)}._Mcp9q_optionContent{flex-direction:column;gap:4px;display:flex}._Mcp9q_optionLabel{color:#1f2937;font-size:14px;font-weight:500}._Mcp9q_optionDesc{color:#6b7280;font-size:12px;line-height:1.4}._Mcp9q_syncStatus{text-align:center;border-radius:6px;margin-top:16px;padding:12px 16px;font-size:13px}._Mcp9q_syncStatusLoading{color:#374151;background:#f3f4f6}._Mcp9q_syncStatusSuccess{color:#065f46;background:#d1fae5}._Mcp9q_syncStatusError{color:#991b1b;background:#fee2e2}._Mcp9q_generalRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;padding:12px 0;display:flex}._Mcp9q_generalRow button{font:inherit;color:inherit;cursor:pointer;background:0 0;border:1px solid;border-radius:6px;padding:4px 12px}";
		const tagId$1 = "dsh-prompt-library/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-prompt-library";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var panel_module_css_d2f88171ee_default = {
			"header": "_Mcp9q_header",
			"promptItemBtn": "_Mcp9q_promptItemBtn",
			"panel-fade-in": "_Mcp9q_panel-fade-in",
			"footerVersion": "_Mcp9q_footerVersion",
			"settingItem": "_Mcp9q_settingItem",
			"promptModalField": "_Mcp9q_promptModalField",
			"promptModalBtn": "_Mcp9q_promptModalBtn",
			"promptModalConfirm": "_Mcp9q_promptModalConfirm",
			"close": "_Mcp9q_close",
			"sidebar": "_Mcp9q_sidebar",
			"shareBtn": "_Mcp9q_shareBtn",
			"promptItemContent": "_Mcp9q_promptItemContent",
			"footer": "_Mcp9q_footer",
			"promptModalTextarea": "_Mcp9q_promptModalTextarea",
			"promptItemActions": "_Mcp9q_promptItemActions",
			"promptItemHeader": "_Mcp9q_promptItemHeader",
			"promptModalInput": "_Mcp9q_promptModalInput",
			"promptItemNameText": "_Mcp9q_promptItemNameText",
			"promptCharCounter": "_Mcp9q_promptCharCounter",
			"syncHint": "_Mcp9q_syncHint",
			"panel-fade-in-scale": "_Mcp9q_panel-fade-in-scale",
			"syncItemBody": "_Mcp9q_syncItemBody",
			"syncGroup": "_Mcp9q_syncGroup",
			"importOptions": "_Mcp9q_importOptions",
			"optionContent": "_Mcp9q_optionContent",
			"syncStatusLoading": "_Mcp9q_syncStatusLoading",
			"promptModal": "_Mcp9q_promptModal",
			"settingsRoot": "_Mcp9q_settingsRoot",
			"content": "_Mcp9q_content",
			"main": "_Mcp9q_main",
			"wrapper": "_Mcp9q_wrapper",
			"headerActions": "_Mcp9q_headerActions",
			"settingsScroll": "_Mcp9q_settingsScroll",
			"settingLabelIcon": "_Mcp9q_settingLabelIcon",
			"tabIcon": "_Mcp9q_tabIcon",
			"promptListHeader": "_Mcp9q_promptListHeader",
			"promptPinBtnActive": "_Mcp9q_promptPinBtnActive",
			"promptModalClose": "_Mcp9q_promptModalClose",
			"promptModalFooter": "_Mcp9q_promptModalFooter",
			"promptDeleteBtn": "_Mcp9q_promptDeleteBtn",
			"divider": "_Mcp9q_divider",
			"syncBtn": "_Mcp9q_syncBtn",
			"syncItem": "_Mcp9q_syncItem",
			"optionRadio": "_Mcp9q_optionRadio",
			"syncStatusSuccess": "_Mcp9q_syncStatusSuccess",
			"tabLabel": "_Mcp9q_tabLabel",
			"promptItemName": "_Mcp9q_promptItemName",
			"sidebarHeader": "_Mcp9q_sidebarHeader",
			"overlay": "_Mcp9q_overlay",
			"promptListTitle": "_Mcp9q_promptListTitle",
			"tabs": "_Mcp9q_tabs",
			"syncItemLabel": "_Mcp9q_syncItemLabel",
			"syncStatusError": "_Mcp9q_syncStatusError",
			"requiredMark": "_Mcp9q_requiredMark",
			"promptModalOverlay": "_Mcp9q_promptModalOverlay",
			"promptEmpty": "_Mcp9q_promptEmpty",
			"promptModalHeader": "_Mcp9q_promptModalHeader",
			"sidebarTitle": "_Mcp9q_sidebarTitle",
			"promptListSection": "_Mcp9q_promptListSection",
			"exportRoot": "_Mcp9q_exportRoot",
			"promptModalVisible": "_Mcp9q_promptModalVisible",
			"smartInputRoot": "_Mcp9q_smartInputRoot",
			"optionLabel": "_Mcp9q_optionLabel",
			"promptPinBadge": "_Mcp9q_promptPinBadge",
			"title": "_Mcp9q_title",
			"optionDesc": "_Mcp9q_optionDesc",
			"settingInfo": "_Mcp9q_settingInfo",
			"promptItemText": "_Mcp9q_promptItemText",
			"promptAddBtn": "_Mcp9q_promptAddBtn",
			"promptItemTextContent": "_Mcp9q_promptItemTextContent",
			"settingSection": "_Mcp9q_settingSection",
			"smartEnterModeTrigger": "_Mcp9q_smartEnterModeTrigger",
			"syncStatus": "_Mcp9q_syncStatus",
			"syncTitle": "_Mcp9q_syncTitle",
			"promptModalCancel": "_Mcp9q_promptModalCancel",
			"promptModalBody": "_Mcp9q_promptModalBody",
			"bottomDivider": "_Mcp9q_bottomDivider",
			"tab": "_Mcp9q_tab",
			"toggle": "_Mcp9q_toggle",
			"settingLabel": "_Mcp9q_settingLabel",
			"syncSection": "_Mcp9q_syncSection",
			"bottomSection": "_Mcp9q_bottomSection",
			"importOption": "_Mcp9q_importOption",
			"modal": "_Mcp9q_modal",
			"syncRoot": "_Mcp9q_syncRoot",
			"toggleSlider": "_Mcp9q_toggleSlider",
			"promptItem": "_Mcp9q_promptItem",
			"generalRow": "_Mcp9q_generalRow",
			"tabActive": "_Mcp9q_tabActive",
			"promptListContainer": "_Mcp9q_promptListContainer",
			"settingHint": "_Mcp9q_settingHint"
		};
		// src/client/library/PromptManager.tsx
		/** 开关（原 .ait-toggle-switch）。 */
		function Toggle({ checked, ariaLabel, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: panel_module_css_d2f88171ee_default.toggle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked,
					"aria-label": ariaLabel,
					onChange: (e) => {
						onChange(e.target.checked);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_d2f88171ee_default.toggleSlider })]
			});
		}
		/** 设置行（原 .setting-item）。 */
		function SettingItem({ label, hint, control }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_d2f88171ee_default.settingItem,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_d2f88171ee_default.settingInfo,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_d2f88171ee_default.settingLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_d2f88171ee_default.settingHint,
						children: hint
					})]
				}), control]
			});
		}
		function PromptTab({ t }) {
			const library = (0, react.useSyncExternalStore)(promptsStore.subscribe, promptsStore.get);
			const prompts = library.prompts;
			const sorted = (0, react.useMemo)(() => sortPrompts(prompts), [prompts]);
			const [modal, setModal] = (0, react.useState)(null);
			const actionTooltip = (id, text) => ({
				"aria-label": text,
				onMouseEnter: (e) => {
					tooltip.show(id, e.currentTarget, text, {});
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
					cancelText: t("common.cancel"),
					confirmTextType: "danger"
				}) && change(() => promptsStore.remove(id))) toast.success(t("panel.promptDeleted"));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_d2f88171ee_default.settingsRoot,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_d2f88171ee_default.settingsScroll,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_d2f88171ee_default.promptListSection,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_d2f88171ee_default.promptListHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_d2f88171ee_default.promptListTitle,
									children: t("panel.promptListTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: panel_module_css_d2f88171ee_default.promptAddBtn,
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
								className: panel_module_css_d2f88171ee_default.promptListContainer,
								children: sorted.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_d2f88171ee_default.promptEmpty,
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
									className: panel_module_css_d2f88171ee_default.promptItem,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_d2f88171ee_default.promptItemContent,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: panel_module_css_d2f88171ee_default.promptItemHeader,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: panel_module_css_d2f88171ee_default.promptItemName,
												children: [prompt.pinned === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_d2f88171ee_default.promptPinBadge,
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
													className: panel_module_css_d2f88171ee_default.promptItemNameText,
													children: prompt.name
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: panel_module_css_d2f88171ee_default.promptItemActions,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: prompt.pinned === true ? `${panel_module_css_d2f88171ee_default.promptItemBtn} ${panel_module_css_d2f88171ee_default.promptPinBtnActive}` : panel_module_css_d2f88171ee_default.promptItemBtn,
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
														className: panel_module_css_d2f88171ee_default.promptItemBtn,
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
														className: `${panel_module_css_d2f88171ee_default.promptItemBtn} ${panel_module_css_d2f88171ee_default.promptDeleteBtn}`,
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
														className: panel_module_css_d2f88171ee_default.promptItemBtn,
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
														className: panel_module_css_d2f88171ee_default.promptItemBtn,
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
											className: panel_module_css_d2f88171ee_default.promptItemText,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_d2f88171ee_default.promptItemTextContent,
												children: prompt.content
											})
										})]
									})
								}, prompt.id))
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: panel_module_css_d2f88171ee_default.bottomDivider }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_d2f88171ee_default.bottomSection,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingItem, {
							label: t("panel.promptBtnLabel"),
							hint: t("panel.promptBtnHint"),
							control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								ariaLabel: t("panel.promptBtnLabel"),
								checked: library.promptButtonEnabled,
								onChange: (enabled) => {
									change(() => promptsStore.setButtonEnabled(enabled));
								}
							})
						})
					}),
					modal !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptModal, {
						t,
						prompt: modal.mode === "edit" ? modal.prompt : null,
						onClose: () => {
							setModal(null);
						}
					}) : null
				]
			});
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
				className: visible && !closing ? `${panel_module_css_d2f88171ee_default.promptModalOverlay} ${panel_module_css_d2f88171ee_default.promptModalVisible}` : panel_module_css_d2f88171ee_default.promptModalOverlay,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_d2f88171ee_default.promptModal,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": isEdit ? t("panel.promptEditTitle") : t("panel.promptAddTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_d2f88171ee_default.promptModalHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: isEdit ? t("panel.promptEditTitle") : t("panel.promptAddTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_d2f88171ee_default.promptModalClose,
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
							className: panel_module_css_d2f88171ee_default.promptModalBody,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_d2f88171ee_default.promptModalField,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("panel.promptNameLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_d2f88171ee_default.requiredMark,
									children: "*"
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: nameRef,
									type: "text",
									className: panel_module_css_d2f88171ee_default.promptModalInput,
									placeholder: t("panel.promptNamePlaceholder"),
									maxLength: 16,
									value: name,
									onChange: (e) => {
										setName(e.target.value);
									}
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_d2f88171ee_default.promptModalField,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("panel.promptContentLabel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_d2f88171ee_default.requiredMark,
										children: "*"
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										ref: contentRef,
										className: panel_module_css_d2f88171ee_default.promptModalTextarea,
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
										className: panel_module_css_d2f88171ee_default.promptCharCounter,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: `${String(content.length)}/20000` })
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_d2f88171ee_default.promptModalFooter,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${panel_module_css_d2f88171ee_default.promptModalBtn} ${panel_module_css_d2f88171ee_default.promptModalCancel}`,
								onClick: close,
								children: t("common.cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${panel_module_css_d2f88171ee_default.promptModalBtn} ${panel_module_css_d2f88171ee_default.promptModalConfirm}`,
								onClick: save,
								children: t("panel.promptSave")
							})]
						})
					]
				})
			});
		}
		// src/client/library/InputSettings.tsx
		const CTRL_LABEL = navigator.platform.toUpperCase().includes("MAC") ? "⌘" : "Ctrl";
		function modeLabel(mode, t) {
			switch (mode) {
				case "ctrlEnter": return `${CTRL_LABEL} + Enter`;
				case "shiftEnter": return "Shift + Enter";
				default: return t("panel.smartEnterModeDouble");
			}
		}
		function SmartInputTab({ t }) {
			const settings = (0, react.useSyncExternalStore)(settingsStore.subscribe, () => settingsStore.get());
			const hintTemplate = t("panel.smartEnterHint");
			const modeIndex = hintTemplate.indexOf("{mode}");
			const hintBefore = modeIndex >= 0 ? hintTemplate.slice(0, modeIndex) : hintTemplate;
			const hintAfter = modeIndex >= 0 ? hintTemplate.slice(modeIndex + 6) : "";
			const setMode = (mode) => {
				settingsStore.set({
					smartEnterMode: mode,
					smartEnterToastCount: 0
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_d2f88171ee_default.smartInputRoot,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: panel_module_css_d2f88171ee_default.settingSection,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingItem, {
						label: t("panel.smartEnterTitle"),
						hint: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							hintBefore,
							modeIndex >= 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: panel_module_css_d2f88171ee_default.smartEnterModeTrigger,
								onClick: (e) => {
									dropdown.show({
										trigger: e.currentTarget,
										items: [
											{
												label: modeLabel("doubleEnter", t),
												onClick: () => {
													setMode("doubleEnter");
												}
											},
											{
												label: modeLabel("ctrlEnter", t),
												onClick: () => {
													setMode("ctrlEnter");
												}
											},
											{
												label: modeLabel("shiftEnter", t),
												onClick: () => {
													setMode("shiftEnter");
												}
											}
										],
										width: 180,
										position: "bottom-left"
									});
								},
								children: [modeLabel(settings.smartEnterMode, t), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 12 12",
									width: "10",
									height: "10",
									"aria-hidden": true,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										d: "M3 4.5L6 7.5L9 4.5",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "1.5",
										strokeLinecap: "round",
										strokeLinejoin: "round"
									})
								})]
							}) : null,
							hintAfter
						] }),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
							checked: settings.smartEnterEnabled,
							onChange: (enabled) => {
								settingsStore.set({ smartEnterEnabled: enabled });
							}
						})
					})
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
		/** 数据同步 tab（原 DataSyncTab，仅本地文件导入导出，云同步不迁移）。 */
		function DataSyncTab({ t }) {
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
					toast.success(t("panel.syncExportSuccess"), null, { color: SYNC_TOAST_COLOR });
				} catch {
					setStatus(null);
					toast.error(t("panel.syncExportFailed"), null, { color: SYNC_TOAST_COLOR });
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
				className: panel_module_css_d2f88171ee_default.syncRoot,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: panel_module_css_d2f88171ee_default.syncSection,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_d2f88171ee_default.syncHint,
							children: t("panel.syncHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_d2f88171ee_default.syncGroup,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_d2f88171ee_default.syncItem,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_d2f88171ee_default.syncItemLabel,
									children: t("panel.syncExportLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_d2f88171ee_default.syncItemBody,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: panel_module_css_d2f88171ee_default.syncBtn,
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
								className: panel_module_css_d2f88171ee_default.syncItem,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_d2f88171ee_default.syncItemLabel,
									children: t("panel.syncImportLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_d2f88171ee_default.syncItemBody,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_d2f88171ee_default.importOptions,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: panel_module_css_d2f88171ee_default.importOption,
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
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_d2f88171ee_default.optionRadio }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_d2f88171ee_default.optionContent,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_d2f88171ee_default.optionLabel,
														children: t("panel.syncModeMerge")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_d2f88171ee_default.optionDesc,
														children: t("panel.syncModeMergeDesc")
													})]
												})
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: panel_module_css_d2f88171ee_default.importOption,
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
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: panel_module_css_d2f88171ee_default.optionRadio }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_d2f88171ee_default.optionContent,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_d2f88171ee_default.optionLabel,
														children: t("panel.syncModeOverwrite")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_d2f88171ee_default.optionDesc,
														children: t("panel.syncModeOverwriteDesc")
													})]
												})
											]
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: panel_module_css_d2f88171ee_default.syncBtn,
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
					className: `${panel_module_css_d2f88171ee_default.syncStatus} ${status.type === "loading" ? panel_module_css_d2f88171ee_default.syncStatusLoading : panel_module_css_d2f88171ee_default.syncStatusError}`,
					children: status.message
				}) : null]
			});
		}
		// src/client/library/PanelHost.tsx
		const tabs = [
			["prompts", "panel.tabPrompt"],
			["input", "panel.tabSmartInput"],
			["backup", "panel.tabDataSync"]
		];
		function SettingsEntry({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_d2f88171ee_default.generalRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("prompt.tooltipLibrary") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => libraryPanel.set("prompts"),
					children: t("prompt.settings")
				})]
			});
		}
		function dismiss() {
			tooltip.forceHideAll();
			dropdown.forceHideAll();
			popconfirm.hide(false);
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
				className: ui_module_css_a81be0b626_default.host,
				"data-theme": dark ? "dark" : "light",
				children: [
					open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_d2f88171ee_default.modal,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: panel_module_css_d2f88171ee_default.overlay,
							onClick: dismiss
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_d2f88171ee_default.wrapper,
							role: "dialog",
							"aria-modal": "true",
							"aria-label": t("prompt.tooltipLibrary"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_d2f88171ee_default.sidebar,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_d2f88171ee_default.sidebarHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: panel_module_css_d2f88171ee_default.close,
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
										className: panel_module_css_d2f88171ee_default.sidebarTitle,
										children: t("prompt.tooltipLibrary")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_d2f88171ee_default.tabs,
									children: tabs.map(([id, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: id === activeTab ? `${panel_module_css_d2f88171ee_default.tab} ${panel_module_css_d2f88171ee_default.tabActive}` : panel_module_css_d2f88171ee_default.tab,
										onClick: () => libraryPanel.set(id),
										children: t(label)
									}, id))
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_d2f88171ee_default.main,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_d2f88171ee_default.header,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: panel_module_css_d2f88171ee_default.title,
										children: t(tabs.find(([id]) => id === activeTab)[1])
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_d2f88171ee_default.content,
									children: [
										activeTab === "prompts" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptTab, { t }),
										activeTab === "input" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SmartInputTab, { t }),
										activeTab === "backup" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DataSyncTab, { t })
									]
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToastHost, { dark }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DropdownHost, { dark }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PopconfirmHost, {
						defaultConfirmText: t("common.confirm"),
						defaultCancelText: t("common.cancel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TooltipHost, { dark })
				]
			}), document.body);
		}
		// src/client/ui/SettingsIcon.tsx
		function SettingsIcon({ strokeWidth = 2 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9.67 4.14a2.34 2.34 0 0 1 4.66 0 2.34 2.34 0 0 0 3.32 1.91 2.34 2.34 0 0 1 2.33 4.04 2.34 2.34 0 0 0 0 3.82 2.34 2.34 0 0 1-2.33 4.04 2.34 2.34 0 0 0-3.32 1.91 2.34 2.34 0 0 1-4.66 0 2.34 2.34 0 0 0-3.32-1.91 2.34 2.34 0 0 1-2.33-4.04 2.34 2.34 0 0 0 0-3.82 2.34 2.34 0 0 1 2.33-4.04 2.34 2.34 0 0 0 3.32-1.91Z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "12",
					cy: "12",
					r: "3"
				})]
			});
		}
		// src/client/library/smartEnter.ts
		/**
		* 智能回车：移植原 SmartEnterManager 的按键接管逻辑。
		* 三种模式：双击 Enter 发送 / Ctrl(⌘)+Enter 发送 / Shift+Enter 发送，
		* 皆为「Enter 换行」+ 指定组合键发送。
		* 通过 capture 阶段拦截 DSH composer textarea 的 keydown，
		* 换行走原生 value setter + input 事件（触发 React onChange），
		* 发送则重放一个合成 Enter 事件放行给宿主自身的提交逻辑。
		*/
		/** 双击 Enter 判定间隔（原 SMART_ENTER_CONFIG.DOUBLE_CLICK_INTERVAL）。 */
		const DOUBLE_CLICK_INTERVAL = 300;
		/** DOM 变化防抖（原 SMART_ENTER_CONFIG.DEBOUNCE_DELAY）。 */
		const DEBOUNCE_DELAY = 200;
		/** 健康检查周期（原 _startHealthCheck 的 5000ms）。 */
		const HEALTH_CHECK_INTERVAL = 5e3;
		/** 换行提示 toast 的最大展示次数（原 _showNewlineToast 的 count >= 5）。 */
		const TOAST_MAX_COUNT = 5;
		/** 换行提示 toast 配色（原 _showNewlineToast 的 color；黑底改取宿主 tooltip 底板 token）。 */
		const NEWLINE_TOAST_COLOR = {
			light: {
				backgroundColor: "var(--dsw-alias-tooltip-bg)",
				textColor: "#ffffff",
				borderColor: "var(--dsw-alias-tooltip-bg)"
			},
			dark: {
				backgroundColor: "#ffffff",
				textColor: "#1f2937",
				borderColor: "#e5e7eb"
			}
		};
		/** DSH composer 的 textarea（宿主 InputBar 的输入元素）。 */
		const INPUT_SELECTOR$1 = "[data-input-scroll] textarea, [data-input-scroll] [contenteditable=true]";
		/** React 受控 textarea 的原生赋值（绕过 React 的 value 劫持，再派发 input）。 */
		function setNativeValue(el, value) {
			const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
			if (setter === void 0) return;
			setter.call(el, value);
		}
		var SmartEnterManager = class {
			getToastText;
			/** 状态（原 this.state）。 */
			lastEnterTime = 0;
			enterCount = 0;
			savedSelection = null;
			savedRange = null;
			allowNextEnter = false;
			newlineTimer = null;
			debounceTimer = null;
			healthCheckInterval = null;
			observer = null;
			input = null;
			inputListeners = null;
			constructor(getToastText) {
				this.getToastText = getToastText;
			}
			init() {
				this.attachIfNeeded();
				this.observer = new MutationObserver((mutations) => {
					if (!mutations.some((m) => m.addedNodes.length > 0 || m.removedNodes.length > 0)) return;
					if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
					this.debounceTimer = setTimeout(() => {
						this.debounceTimer = null;
						this.attachIfNeeded();
					}, DEBOUNCE_DELAY);
				});
				this.observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				this.healthCheckInterval = setInterval(() => {
					this.attachIfNeeded();
				}, HEALTH_CHECK_INTERVAL);
			}
			destroy() {
				this.observer?.disconnect();
				this.observer = null;
				if (this.healthCheckInterval !== null) {
					clearInterval(this.healthCheckInterval);
					this.healthCheckInterval = null;
				}
				this.inputListeners?.abort();
				this.inputListeners = null;
				this.input = null;
				this.resetState();
			}
			attachIfNeeded() {
				const input = document.querySelector(INPUT_SELECTOR$1);
				if (input === this.input) return;
				this.inputListeners?.abort();
				this.inputListeners = null;
				this.input = input;
				this.resetState();
				if (input === null) return;
				const controller = new AbortController();
				this.inputListeners = controller;
				const { signal } = controller;
				input.addEventListener("keydown", (event) => this.handleKeyDown(input, event), {
					capture: true,
					signal
				});
				input.addEventListener("input", () => this.handleInput(), { signal });
			}
			handleInput() {
				if (this.newlineTimer !== null) {
					clearTimeout(this.newlineTimer);
					this.newlineTimer = null;
					this.resetState();
				}
			}
			handleKeyDown(input, e) {
				if (e.isComposing || e.keyCode === 229) {
					this.resetState();
					return;
				}
				if (e.key !== "Enter" || this.allowNextEnter) return;
				const settings = settingsStore.get();
				if (!settings.smartEnterEnabled) return;
				if (e.repeat) {
					e.preventDefault();
					e.stopImmediatePropagation();
					return;
				}
				const mode = settings.smartEnterMode;
				if (mode === "doubleEnter") this.handleDoubleEnterMode(input, e);
				else if (mode === "ctrlEnter") this.handleCtrlEnterMode(input, e);
				else this.handleShiftEnterMode(input, e);
			}
			/** 模式1：快速双击 Enter 发送（原 _handleDoubleEnterMode）。 */
			handleDoubleEnterMode(input, e) {
				if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
				e.preventDefault();
				e.stopImmediatePropagation();
				const now = Date.now();
				const timeSinceLastEnter = now - this.lastEnterTime;
				if (this.enterCount > 0 && timeSinceLastEnter < DOUBLE_CLICK_INTERVAL) {
					this.enterCount += 1;
					if (this.enterCount >= 2) {
						if (this.newlineTimer !== null) {
							clearTimeout(this.newlineTimer);
							this.newlineTimer = null;
						}
						this.triggerSend(input);
						this.resetState();
					}
				} else {
					if (this.newlineTimer !== null) {
						clearTimeout(this.newlineTimer);
						this.newlineTimer = null;
					}
					if (input instanceof HTMLTextAreaElement) this.savedSelection = {
						start: input.selectionStart,
						end: input.selectionEnd
					};
					else {
						const selection = window.getSelection();
						if (selection && selection.rangeCount && input.contains(selection.anchorNode)) this.savedRange = selection.getRangeAt(0).cloneRange();
					}
					this.enterCount = 1;
					this.lastEnterTime = now;
					this.newlineTimer = setTimeout(() => {
						this.newlineTimer = null;
						if (this.enterCount === 1 && this.canSend(input)) this.insertNewlineAtSavedPosition(input);
						this.resetState();
					}, DOUBLE_CLICK_INTERVAL);
				}
			}
			/** 模式2：Enter 即时换行，Ctrl/Cmd+Enter 发送（原 _handleCtrlEnterMode）。 */
			handleCtrlEnterMode(input, e) {
				if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
					e.preventDefault();
					e.stopImmediatePropagation();
					this.triggerSend(input);
				} else if (!e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
					e.preventDefault();
					e.stopImmediatePropagation();
					this.insertNewline(input);
					this.showNewlineToast(input);
				}
			}
			/** 模式3：Enter 即时换行，Shift+Enter 发送（原 _handleShiftEnterMode）。 */
			handleShiftEnterMode(input, e) {
				if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
					e.preventDefault();
					e.stopImmediatePropagation();
					this.triggerSend(input);
				} else if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
					e.preventDefault();
					e.stopImmediatePropagation();
					this.insertNewline(input);
					this.showNewlineToast(input);
				}
			}
			/** 在保存的位置插入换行（原 _insertNewlineAtSavedPosition）。 */
			insertNewlineAtSavedPosition(input) {
				if (input instanceof HTMLTextAreaElement && this.savedSelection !== null) {
					input.selectionStart = this.savedSelection.start;
					input.selectionEnd = this.savedSelection.end;
				} else if (this.savedRange !== null && input.contains(this.savedRange.commonAncestorContainer)) {
					const selection = window.getSelection();
					selection?.removeAllRanges();
					selection?.addRange(this.savedRange);
				}
				this.insertNewline(input);
				this.showNewlineToast(input);
			}
			/** 插入换行符（原 _insertNewline 的 textarea 分支，改用原生 setter 兼容受控组件）。 */
			insertNewline(input) {
				if (!(input instanceof HTMLTextAreaElement)) {
					const clipboardData = new DataTransfer();
					clipboardData.setData("text/plain", "\n");
					input.dispatchEvent(new ClipboardEvent("paste", {
						clipboardData,
						bubbles: true,
						cancelable: true
					}));
					return;
				}
				const start = input.selectionStart;
				const end = input.selectionEnd;
				const value = input.value;
				setNativeValue(input, `${value.substring(0, start)}\n${value.substring(end)}`);
				const newPosition = start + 1;
				input.selectionStart = newPosition;
				input.selectionEnd = newPosition;
				input.dispatchEvent(new Event("input", { bubbles: true }));
			}
			/** 换行提示 toast，最多提示 5 次（原 _showNewlineToast）。 */
			showNewlineToast(input) {
				const settings = settingsStore.get();
				if (settings.smartEnterToastCount >= TOAST_MAX_COUNT) return;
				const message = this.getToastText(settings.smartEnterMode);
				toast.info(message, input, {
					duration: 2500,
					icon: "",
					color: NEWLINE_TOAST_COLOR
				});
				settingsStore.set({ smartEnterToastCount: settings.smartEnterToastCount + 1 });
			}
			/** 输入框非空才允许发送（原 adapter.canSend）。 */
			canSend(input) {
				return (input instanceof HTMLTextAreaElement ? input.value : input.textContent ?? "").trim().length > 0;
			}
			/** 触发发送：重放合成 Enter 让宿主原生处理（原 _triggerSend）。 */
			triggerSend(input) {
				if (!this.canSend(input)) return;
				if (document.activeElement !== input) input.focus();
				this.allowNextEnter = true;
				try {
					input.dispatchEvent(new KeyboardEvent("keydown", {
						key: "Enter",
						code: "Enter",
						keyCode: 13,
						which: 13,
						bubbles: true,
						cancelable: true
					}));
				} finally {
					this.allowNextEnter = false;
				}
			}
			resetState() {
				this.lastEnterTime = 0;
				this.enterCount = 0;
				this.savedRange = null;
				this.savedSelection = null;
				this.allowNextEnter = false;
				if (this.newlineTimer !== null) {
					clearTimeout(this.newlineTimer);
					this.newlineTimer = null;
				}
				if (this.debounceTimer !== null) {
					clearTimeout(this.debounceTimer);
					this.debounceTimer = null;
				}
			}
		};
		/** 智能回车挂载 hook：composer 槽位组件调用（随会话生命周期附加/清理）。 */
		function useSmartEnter(getToastText) {
			(0, react.useEffect)(() => {
				const manager = new SmartEnterManager(getToastText);
				manager.init();
				return () => {
					manager.destroy();
				};
			}, []);
		}
		// src/client/shared/preventAutoScroll.ts
		/**
		* Prevent Auto Scroll On Send（移植原 preventAutoScroll/index.js）。
		*
		* 解决的问题：向上滚动浏览历史时，发送一条新消息后，平台会强制把页面滚动
		* 到底部，并在 AI 生成过程中多次自动滚动到底部，打断当前阅读。
		*
		* 方案：「发送 + 生成期间持续锚定阅读位置」
		*   1. capture 阶段捕获发送动作（回车），早于宿主自身处理。点击发送按钮
		*      无稳定选择器，且普通消息发送不经过 InputState.phase 提交态（宿主
		*      状态机对非斜杠草稿直接走 default-sink，phase 恒为 plain），因此
		*      点击发送以「草稿 COMMIT 清空」（send-committed）为确认信号：
		*      capture 阶段 pointerdown 先记录发送前滚动位置快照（早于宿主处理），
		*      草稿从非空变空时用快照启动锚定；斜杠命令仍由 phase 提交态通知。
		*   2. 仅当发送前用户已向上滚动、不在底部时才介入；已在底部则不干预。
		*   3. 用 rAF 循环把 scrollTop 钉回 savedTop，抵消宿主的自动滚动；
		*      锚定持续到 AI 生成结束（依据 chat.running，由 React 侧喂入）。
		*   4. 生成期间用户主动滚动时不放弃保护，而是「跟随」用户更新 savedTop：
		*      wheel 事件的 deltaY 累计为「用户滚动预算」，每帧位移在预算内视为
		*      用户滚动予以跟随，超出预算视为程序化大跳予以拒绝（原 issue #129）。
		*
		* 时间轴等插件内导航通过 notifyUserNavigation/settleUserNavigation 声明
		* 可信滚动，避免锚定逻辑把插件主动跳转误判为平台自动滚动。
		*/
		/** 发送后等待生成开始的宽限期（ms）。 */
		const START_GRACE = 2e3;
		/** 生成结束后继续锚定一小段，拦截收尾时的自动滚动（ms）。 */
		const TAIL_AFTER = 600;
		/** 安全上限，防止生成态检测异常导致无限锚定（ms）。 */
		const MAX_DURATION = 12e4;
		/** 距底部多少 px 内视为「已在底部」。 */
		const BOTTOM_THRESHOLD = 150;
		/** 用户主动滚动后的「跟随」窗口（ms）。 */
		const USER_WINDOW = 250;
		/** 跟随窗口内，无预算时单帧位移 <= 此值视为用户滚动。 */
		const USER_STEP_MAX = 400;
		/** 用户滚动预算上限（px），防止累计预算过大放行平台跳转。 */
		const USER_BUDGET_MAX = 6e3;
		/** 窗口过期后预算的存活期（ms），覆盖卡顿时滚动位移延迟到达。 */
		const BUDGET_TTL = 300;
		/** pointerdown 位置快照的有效期（ms）：点击发送到草稿清空的最大间隔。 */
		const CLICK_SNAPSHOT_TTL = 800;
		/** 锚定期间按下即视为用户想自己滚动的导航键。 */
		const NAV_KEYS = /* @__PURE__ */ new Set([
			"ArrowUp",
			"ArrowDown",
			"PageUp",
			"PageDown",
			"Home",
			"End"
		]);
		/** DSH composer 的 textarea（与智能回车共用选择器）。 */
		const INPUT_SELECTOR = "[data-input-scroll] textarea, [data-input-scroll] [contenteditable=true]";
		/** DSH 会话滚动容器（时间轴同款选择器）。 */
		const SCROLL_SELECTOR = "[data-conversation-scroll]";
		var ScrollAnchor = class {
			pinning = false;
			scrollContainer = null;
			savedTop = 0;
			rafId = null;
			startTs = 0;
			sawGenerating = false;
			lastGeneratingTs = 0;
			userScrollUntil = 0;
			pendingUserDelta = 0;
			lastTouchY = null;
			trustedNavigationUntil = 0;
			trustedNavigationId = 0;
			/** 生成态（React 侧经 setGenerating 喂入 chat.running）。 */
			generating = false;
			/** pointerdown 时的滚动位置快照（点击发送的「发送前」位置，早于宿主滚底）。 */
			clickSnapshot = null;
			onKeydown = (e) => {
				if (this.pinning && NAV_KEYS.has(e.key)) {
					this.userScrollUntil = performance.now() + USER_WINDOW;
					return;
				}
				if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
				const target = e.target;
				if (!(target instanceof Element)) return;
				const editor = target.closest(INPUT_SELECTOR);
				if (editor === null) return;
				if ((editor instanceof HTMLTextAreaElement ? editor.value : editor.textContent ?? "").trim().length === 0) return;
				this.maybeStartPin();
			};
			onPointerDown = () => {
				if (this.pinning) return;
				if (!settingsStore.get().preventAutoScrollEnabled) return;
				const container = this.findScrollContainer();
				const { top, atBottom } = this.measure(container);
				this.clickSnapshot = {
					top,
					atBottom,
					ts: performance.now()
				};
			};
			onUserScrollIntent = (e) => {
				if (!this.pinning) return;
				if (e.type === "wheel" && !this.canScrollInDirection(e.deltaY)) return;
				const now = performance.now();
				const gestureExpired = now >= this.userScrollUntil;
				this.userScrollUntil = now + USER_WINDOW;
				if (e.type === "wheel") {
					const wheel = e;
					let dy = Math.abs(wheel.deltaY);
					if (wheel.deltaMode === 1) dy *= 16;
					else if (wheel.deltaMode === 2) dy *= window.innerHeight;
					this.pendingUserDelta = Math.min(USER_BUDGET_MAX, this.pendingUserDelta + dy);
				} else if (e.type === "touchmove") {
					const touch = e.touches[0];
					const y = touch !== void 0 ? touch.clientY : null;
					if (y !== null) {
						if (!gestureExpired && this.lastTouchY !== null) this.pendingUserDelta = Math.min(USER_BUDGET_MAX, this.pendingUserDelta + Math.abs(y - this.lastTouchY));
						this.lastTouchY = y;
					}
				}
			};
			loop = () => {
				if (!this.pinning || this.scrollContainer === null) return;
				const now = performance.now();
				const cur = this.readTop(this.scrollContainer);
				if (this.pendingUserDelta > 0 && now >= this.userScrollUntil + BUDGET_TTL) this.pendingUserDelta = 0;
				if (now < this.trustedNavigationUntil) this.savedTop = cur;
				else if (now < this.userScrollUntil || this.pendingUserDelta > 0) {
					const step = Math.abs(cur - this.savedTop);
					if (step <= USER_STEP_MAX + this.pendingUserDelta) {
						this.pendingUserDelta = Math.max(0, this.pendingUserDelta - step);
						this.savedTop = cur;
					} else this.setTop(this.scrollContainer, this.savedTop);
				} else this.setTop(this.scrollContainer, this.savedTop);
				const elapsed = now - this.startTs;
				if (this.generating) {
					this.sawGenerating = true;
					this.lastGeneratingTs = now;
				}
				let cont;
				if (elapsed >= MAX_DURATION) cont = false;
				else if (this.sawGenerating) cont = this.generating || now - this.lastGeneratingTs < TAIL_AFTER;
				else cont = elapsed < START_GRACE;
				if (cont) this.rafId = requestAnimationFrame(this.loop);
				else this.stopPin();
			};
			listening = false;
			/** 挂载引用计数：多个槽位实例共存时，最后一个卸载才真正拆监听。 */
			mounts = 0;
			/** 挂载全局监听（capture 阶段发送捕获 + 位置快照 + 用户滚动意图）。 */
			init() {
				this.mounts += 1;
				if (this.listening) return;
				this.listening = true;
				document.addEventListener("keydown", this.onKeydown, true);
				document.addEventListener("pointerdown", this.onPointerDown, true);
				window.addEventListener("wheel", this.onUserScrollIntent, {
					passive: true,
					capture: true
				});
				window.addEventListener("touchmove", this.onUserScrollIntent, {
					passive: true,
					capture: true
				});
			}
			destroy() {
				this.mounts = Math.max(0, this.mounts - 1);
				if (this.mounts > 0) return;
				this.stopPin();
				document.removeEventListener("keydown", this.onKeydown, true);
				document.removeEventListener("pointerdown", this.onPointerDown, true);
				window.removeEventListener("wheel", this.onUserScrollIntent, { capture: true });
				window.removeEventListener("touchmove", this.onUserScrollIntent, { capture: true });
				this.listening = false;
			}
			/** React 侧喂入生成态（chat.running）。 */
			setGenerating(generating) {
				this.generating = generating;
			}
			/** 发送意图（InputState.phase 进入提交态时由 React 侧调用，对应原 _onClick）。 */
			notifySendIntent() {
				if (this.generating) return;
				this.maybeStartPin();
			}
			/**
			* 发送已提交（草稿被 COMMIT 清空时由 React 侧调用）。
			* 覆盖点击发送按钮发送普通消息：该路径不产生 Enter keydown，
			* phase 也恒为 plain，草稿清空是唯一可观测的稳定信号。
			* 通知到达时宿主可能已滚底，故优先用 pointerdown 快照里的「发送前」位置。
			*/
			notifySendCommitted() {
				if (this.pinning) return;
				const snap = this.clickSnapshot;
				this.clickSnapshot = null;
				if (snap !== null && performance.now() - snap.ts <= CLICK_SNAPSHOT_TTL) {
					if (snap.atBottom) return;
					if (!settingsStore.get().preventAutoScrollEnabled) return;
					this.startPinAt(snap.top);
					return;
				}
				this.maybeStartPin();
			}
			/**
			* 插件内主动导航（时间轴节点、问题列表等）可大幅改变 scrollTop，
			* 不适用 USER_STEP_MAX 的用户手势阈值。
			* @param options - 可信跟随时长。
			* @returns navigation id，供 settleUserNavigation 校验。
			*/
			notifyUserNavigation(options = {}) {
				if (!this.pinning || this.scrollContainer === null) return void 0;
				if (options.scrollContainer !== void 0 && this.scrollContainer !== options.scrollContainer) return void 0;
				const durationMs = options.durationMs;
				const followMs = durationMs !== void 0 && Number.isFinite(durationMs) && durationMs > 0 ? durationMs : USER_WINDOW;
				this.trustedNavigationId += 1;
				this.trustedNavigationUntil = performance.now() + followMs;
				this.savedTop = this.readTop(this.scrollContainer);
				return this.trustedNavigationId;
			}
			/**
			* 插件内导航落点后，将当前位置固化为新的阅读锚点。
			* @param options - notifyUserNavigation 返回的 id（不匹配则忽略）。
			*/
			settleUserNavigation(options = {}) {
				if (!this.pinning || this.scrollContainer === null) return;
				if (options.id !== void 0 && options.id !== this.trustedNavigationId) return;
				this.savedTop = this.readTop(this.scrollContainer);
				this.trustedNavigationUntil = 0;
			}
			/** 设置开关关闭时立即解除当前锚定（原 loadSetting 的 onChanged 分支）。 */
			stopPin() {
				this.pinning = false;
				if (this.rafId !== null) {
					cancelAnimationFrame(this.rafId);
					this.rafId = null;
				}
				this.scrollContainer = null;
				this.pendingUserDelta = 0;
				this.lastTouchY = null;
				this.trustedNavigationUntil = 0;
				this.trustedNavigationId += 1;
			}
			maybeStartPin() {
				if (!settingsStore.get().preventAutoScrollEnabled) return;
				const container = this.findScrollContainer();
				const { top, atBottom } = this.measure(container);
				if (atBottom) return;
				this.startPinAt(top);
			}
			/** 以给定阅读位置为锚点启动（或重置）锚定循环。 */
			startPinAt(top) {
				this.scrollContainer = this.findScrollContainer();
				this.savedTop = top;
				this.startTs = performance.now();
				this.sawGenerating = false;
				this.lastGeneratingTs = 0;
				this.userScrollUntil = 0;
				this.pendingUserDelta = 0;
				this.lastTouchY = null;
				this.trustedNavigationUntil = 0;
				this.trustedNavigationId += 1;
				if (!this.pinning) {
					this.pinning = true;
					this.rafId = requestAnimationFrame(this.loop);
				}
			}
			/** 会话滚动容器（DSH 稳定选择器），回退到 window。 */
			findScrollContainer() {
				const el = document.querySelector(SCROLL_SELECTOR);
				return el instanceof HTMLElement ? el : window;
			}
			readTop(container) {
				if (container instanceof Window) return container.scrollY;
				return container.scrollTop;
			}
			/** 容器在手势方向上是否还有可滚动空间（deltaY > 0 向下）。 */
			canScrollInDirection(deltaY) {
				const container = this.scrollContainer;
				if (container === null || deltaY === 0) return false;
				const top = this.readTop(container);
				if (deltaY < 0) return top > 1;
				return top < (container instanceof Window ? document.documentElement.scrollHeight - window.innerHeight : container.scrollHeight - container.clientHeight) - 1;
			}
			measure(container) {
				if (container instanceof Window) {
					const top = container.scrollY;
					const clientHeight = window.innerHeight;
					return {
						top,
						atBottom: document.documentElement.scrollHeight - clientHeight - top < BOTTOM_THRESHOLD
					};
				}
				const top = container.scrollTop;
				return {
					top,
					atBottom: container.scrollHeight - container.clientHeight - top < BOTTOM_THRESHOLD
				};
			}
			setTop(container, top) {
				if (container instanceof Window) container.scrollTo(0, top);
				else container.scrollTop = top;
			}
		};
		/** 模块单例（原 window.__aitPreventAutoScroll 的 DSH 形态）。 */
		const preventAutoScroll = new ScrollAnchor();
		/**
		* 挂载 hook：composer 槽位组件调用。
		* - 挂载/卸载全局监听；
		* - 喂入生成态（chat.running）；
		* - 监听 InputState.phase 跃迁到提交态触发锚定（斜杠命令发送路径）；
		* - 监听草稿从非空 COMMIT 清空触发锚定（普通消息发送路径，含点击发送按钮）；
		* - 开关关闭时立即解除锚定。
		* @param running - 当前会话 chat.running。
		* @param phase - 当前 InputState.phase。
		* @param draft - 当前 InputState.draft。
		*/
		function usePreventAutoScroll(running, phase, draft) {
			(0, react.useEffect)(() => {
				preventAutoScroll.init();
				return () => {
					preventAutoScroll.destroy();
				};
			}, []);
			(0, react.useEffect)(() => {
				preventAutoScroll.setGenerating(running);
			}, [running]);
			const prevPhase = (0, react.useRef)(phase);
			(0, react.useEffect)(() => {
				const prev = prevPhase.current;
				prevPhase.current = phase;
				if (phase === prev) return;
				if (phase === "adjudicating" || phase === "submitting") preventAutoScroll.notifySendIntent();
			}, [phase]);
			const prevDraft = (0, react.useRef)(draft);
			(0, react.useEffect)(() => {
				const prev = prevDraft.current;
				prevDraft.current = draft;
				if (draft === "" && prev.trim() !== "") preventAutoScroll.notifySendCommitted();
			}, [draft]);
			(0, react.useEffect)(() => settingsStore.subscribe(() => {
				if (!settingsStore.get().preventAutoScrollEnabled) preventAutoScroll.stopPin();
			}), []);
		}
		// \0dsh-css:src/client/library/promptButton.module.css?2b816f077c.mjs
		const css = ".KfIHGW_promptBtn{corner-shape:round;width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;user-select:none;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;margin-left:-8px;margin-right:-14px;padding:0;display:grid;position:relative}.KfIHGW_promptBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.KfIHGW_promptIcon{flex-shrink:0;width:14px;height:14px}.KfIHGW_updateDot{box-sizing:border-box;border:1px solid var(--dsw-specific-selector);corner-shape:round;background:#ef4444;border-radius:50%;width:8px;height:8px;position:absolute;top:0;right:0}.KfIHGW_overlay{z-index:17;position:fixed;inset:0}.KfIHGW_container{z-index:18;opacity:0;text-align:left;letter-spacing:normal;word-spacing:normal;text-transform:none;text-indent:0;white-space:normal;direction:ltr;background:#fff;border-radius:12px;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:normal;transition:opacity .15s,transform .15s;display:flex;position:fixed;overflow:hidden;transform:translateY(4px)scale(.98);box-shadow:0 0 0 1px #00000014,0 4px 16px #0000001f,0 8px 32px #00000014}.KfIHGW_container.KfIHGW_visible{opacity:1;transform:translateY(0)scale(1)}.KfIHGW_container[data-theme=dark]{background:#262626;box-shadow:0 0 0 1px #ffffff14,0 8px 24px #00000059,0 16px 48px #0000003d}.KfIHGW_tabs{background:#fff;border-bottom:1px solid #e5e7eb;flex-shrink:0;align-items:center;padding:6px 10px 0;display:flex}.KfIHGW_container[data-theme=dark] .KfIHGW_tabs{background:#262626;border-bottom-color:#404040}.KfIHGW_tabGroup{flex:1;gap:14px;min-width:0;display:flex}.KfIHGW_tab{color:#6b7280;cursor:pointer;background:0 0;border:none;border-radius:0;flex:0 auto;justify-content:center;align-items:center;gap:5px;min-width:0;height:38px;padding:0 2px;font-size:13px;font-weight:500;transition:color .15s;display:flex;position:relative}.KfIHGW_tabText{white-space:nowrap;min-width:0;position:relative;overflow:visible}.KfIHGW_tabLabel{text-overflow:ellipsis;display:block;overflow:hidden}.KfIHGW_tabText:after{content:\"\";corner-shape:round;opacity:0;background:0 0;border-radius:999px;height:3px;transition:transform .18s,opacity .18s,background .18s;position:absolute;bottom:-12px;left:0;right:0;transform:scaleX(.35)}.KfIHGW_tab:hover{color:#4c1d95}.KfIHGW_tab.KfIHGW_tabActive{color:#5b21b6;font-weight:600}.KfIHGW_tab.KfIHGW_tabActive .KfIHGW_tabText:after{opacity:1;background:#7c3aed;transform:scaleX(1)}.KfIHGW_container[data-theme=dark] .KfIHGW_tab{color:#a3a3a3}.KfIHGW_container[data-theme=dark] .KfIHGW_tab:hover,.KfIHGW_container[data-theme=dark] .KfIHGW_tab.KfIHGW_tabActive{color:#c4b5fd}.KfIHGW_container[data-theme=dark] .KfIHGW_tab.KfIHGW_tabActive .KfIHGW_tabText:after{background:#8b5cf6}.KfIHGW_tabIcon{color:currentColor;cursor:pointer;border-radius:5px;flex-shrink:0;justify-content:center;align-items:center;width:18px;height:18px;transition:background .15s,color .15s,transform .15s;display:flex}.KfIHGW_tabIcon:hover{color:#5b21b6;background:#7c3aed1f}.KfIHGW_tabIcon:active{transform:scale(.96)}.KfIHGW_tabIcon svg{width:13px;height:13px}.KfIHGW_container[data-theme=dark] .KfIHGW_tabIcon:hover{color:#ddd6fe;background:#8b5cf62e}.KfIHGW_headerActions{flex-shrink:0;align-items:center;gap:6px;margin-left:4px;display:flex}.KfIHGW_shareBtn{color:#6b7280;cursor:pointer;background:0 0;border:none;border-radius:7px;flex-shrink:0;justify-content:center;align-items:center;width:28px;height:28px;padding:0;transition:background .15s,color .15s,transform .15s;display:flex}.KfIHGW_shareBtn:hover{color:#5b21b6;background:#7c3aed1f}.KfIHGW_shareBtn:active{transform:scale(.96)}.KfIHGW_shareBtn svg{width:16px;height:16px}.KfIHGW_container[data-theme=dark] .KfIHGW_shareBtn{color:#a3a3a3}.KfIHGW_container[data-theme=dark] .KfIHGW_shareBtn:hover{color:#ddd6fe;background:#8b5cf62e}.KfIHGW_panel{flex-direction:column;flex:1;min-height:0;display:none}.KfIHGW_panel.KfIHGW_panelActive{display:flex}.KfIHGW_search{flex-shrink:0;padding:10px 10px 4px}.KfIHGW_searchInput{color:#333;box-sizing:border-box;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;outline:none;width:100%;height:32px;padding:0 10px;font-size:13px;transition:border-color .2s}.KfIHGW_searchInput::placeholder{color:#9ca3af}.KfIHGW_searchInput:focus{background:#fff;border-color:#7c3aed}.KfIHGW_container[data-theme=dark] .KfIHGW_searchInput{color:#f5f5f5;background:#1f1f1f;border-color:#404040}.KfIHGW_container[data-theme=dark] .KfIHGW_searchInput::placeholder{color:#737373}.KfIHGW_container[data-theme=dark] .KfIHGW_searchInput:focus{background:#171717;border-color:#8b5cf6;box-shadow:0 0 0 3px #8b5cf62e}.KfIHGW_searchEmpty{text-align:center;color:#9ca3af;padding:24px 16px;font-size:13px}.KfIHGW_container[data-theme=dark] .KfIHGW_searchEmpty{color:#a3a3a3}.KfIHGW_body{flex-direction:column;flex:1;padding:10px;display:flex;overflow:hidden auto}.KfIHGW_body::-webkit-scrollbar{width:6px}.KfIHGW_body::-webkit-scrollbar-track{background:0 0}.KfIHGW_body::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:3px}.KfIHGW_body::-webkit-scrollbar-thumb:hover{background:#d0d0d0}.KfIHGW_container[data-theme=dark] .KfIHGW_body::-webkit-scrollbar-thumb{background:#525252}.KfIHGW_container[data-theme=dark] .KfIHGW_body::-webkit-scrollbar-thumb:hover{background:#737373}.KfIHGW_item{cursor:pointer;background:#fff;border:1px solid #f0f0f0;border-radius:8px;flex-direction:column;margin-bottom:4px;padding:10px 12px;transition:all .15s;display:flex}.KfIHGW_item:last-child{margin-bottom:0}.KfIHGW_item:hover{border-color:#d1d5db}.KfIHGW_item:active{background-color:#f0ebff}.KfIHGW_container[data-theme=dark] .KfIHGW_item{background:#1f1f1f;border-color:#3f3f46}.KfIHGW_container[data-theme=dark] .KfIHGW_item:hover{background:#27272a;border-color:#52525b}.KfIHGW_container[data-theme=dark] .KfIHGW_item:active{background:#8b5cf629}.KfIHGW_itemMain{align-items:center;gap:6px;margin-bottom:4px;display:flex}.KfIHGW_itemName{color:#1f2937;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;overflow:hidden}.KfIHGW_container[data-theme=dark] .KfIHGW_itemName{color:#f5f5f5}.KfIHGW_itemContent{color:#6b7280;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.4;overflow:hidden}.KfIHGW_container[data-theme=dark] .KfIHGW_itemContent{color:#a3a3a3}.KfIHGW_itemIcon{color:#ccc;flex-shrink:0;justify-content:center;align-items:center;width:16px;height:16px;display:flex}.KfIHGW_itemIcon svg{width:14px;height:14px}.KfIHGW_itemIcon.KfIHGW_pinnedIcon{color:#f5a623}.KfIHGW_empty{flex-direction:column;flex:1;justify-content:center;align-items:center;min-height:150px;padding:40px 20px;display:flex}.KfIHGW_emptyHint{color:#6b7280;text-align:center;max-width:220px;font-size:12px;line-height:1.5}.KfIHGW_container[data-theme=dark] .KfIHGW_emptyHint{color:#a3a3a3}.KfIHGW_emptyAction{color:#fff;cursor:pointer;background:#111827;border:none;border-radius:8px;justify-content:center;align-items:center;gap:6px;height:32px;margin-top:14px;padding:0 14px;font-size:13px;font-weight:500;transition:background .15s,transform .15s;display:flex}.KfIHGW_emptyAction:hover{background:#374151}.KfIHGW_emptyAction:active{transform:scale(.97)}.KfIHGW_emptyAction svg{width:14px;height:14px}.KfIHGW_container[data-theme=dark] .KfIHGW_emptyAction{color:#171717;background:#f5f5f5}.KfIHGW_container[data-theme=dark] .KfIHGW_emptyAction:hover{background:#e5e5e5}.KfIHGW_commonSettings{flex-direction:column;flex:1;gap:8px;min-height:0;padding:10px;display:flex;overflow-y:auto}.KfIHGW_commonSettings::-webkit-scrollbar{width:6px}.KfIHGW_commonSettings::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:3px}.KfIHGW_container[data-theme=dark] .KfIHGW_commonSettings::-webkit-scrollbar-thumb{background:#525252}.KfIHGW_settingItem{background:#fff;border:1px solid #f0f0f0;border-radius:10px;justify-content:space-between;align-items:center;gap:12px;padding:12px;display:flex}.KfIHGW_container[data-theme=dark] .KfIHGW_settingItem{background:#1f1f1f;border-color:#3f3f46}.KfIHGW_container[data-theme=dark] .KfIHGW_settingItem:hover{background:#27272a;border-color:#52525b}.KfIHGW_settingInfo{flex:1;min-width:0}.KfIHGW_settingTitleRow{align-items:center;gap:8px;display:flex}.KfIHGW_settingLabel{color:#1f2937;font-size:14px;font-weight:600}.KfIHGW_container[data-theme=dark] .KfIHGW_settingLabel{color:#f5f5f5}.KfIHGW_settingHint{color:#6b7280;margin-top:5px;font-size:12px;line-height:1.4}.KfIHGW_container[data-theme=dark] .KfIHGW_settingHint{color:#a3a3a3}.KfIHGW_settingBtn{color:#fff;cursor:pointer;background:#111827;border:none;border-radius:8px;flex-shrink:0;height:30px;padding:0 12px;font-size:12px;font-weight:500;transition:background .15s,transform .15s}.KfIHGW_settingBtn:hover{background:#374151}.KfIHGW_settingBtn:active{transform:scale(.97)}.KfIHGW_container[data-theme=dark] .KfIHGW_settingBtn{color:#171717;background:#f5f5f5}.KfIHGW_container[data-theme=dark] .KfIHGW_settingBtn:hover{background:#e5e5e5}.KfIHGW_toggleSwitch{flex-shrink:0;width:48px;height:26px;display:inline-block;position:relative}.KfIHGW_toggleSwitch input{opacity:0;width:0;height:0}.KfIHGW_toggleSlider{cursor:pointer;corner-shape:round;background-color:#d1d5db;border-radius:999px;transition:background-color .3s;position:absolute;inset:0}.KfIHGW_toggleSlider:before{content:\"\";corner-shape:round;background-color:#fff;border-radius:50%;width:20px;height:20px;transition:transform .3s;position:absolute;bottom:3px;left:3px}.KfIHGW_toggleSwitch input:checked+.KfIHGW_toggleSlider{background-color:#000}.KfIHGW_toggleSwitch input:checked+.KfIHGW_toggleSlider:before{transform:translate(22px)}.KfIHGW_toggleSwitch input:focus+.KfIHGW_toggleSlider{box-shadow:0 0 0 3px #0000001a}.KfIHGW_container[data-theme=dark] .KfIHGW_toggleSlider{background-color:#525252}.KfIHGW_container[data-theme=dark] .KfIHGW_toggleSwitch input:checked+.KfIHGW_toggleSlider{background-color:#8b5cf6}.KfIHGW_container[data-theme=dark] .KfIHGW_toggleSwitch input:focus+.KfIHGW_toggleSlider{box-shadow:0 0 0 3px #8b5cf63d}";
		const tagId = "dsh-prompt-library/promptButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-prompt-library";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var promptButton_module_css_2b816f077c_default = {
			"tab": "KfIHGW_tab",
			"settingTitleRow": "KfIHGW_settingTitleRow",
			"toggleSlider": "KfIHGW_toggleSlider",
			"tabs": "KfIHGW_tabs",
			"search": "KfIHGW_search",
			"settingInfo": "KfIHGW_settingInfo",
			"updateDot": "KfIHGW_updateDot",
			"tabText": "KfIHGW_tabText",
			"empty": "KfIHGW_empty",
			"visible": "KfIHGW_visible",
			"tabActive": "KfIHGW_tabActive",
			"shareBtn": "KfIHGW_shareBtn",
			"body": "KfIHGW_body",
			"item": "KfIHGW_item",
			"pinnedIcon": "KfIHGW_pinnedIcon",
			"commonSettings": "KfIHGW_commonSettings",
			"emptyHint": "KfIHGW_emptyHint",
			"settingLabel": "KfIHGW_settingLabel",
			"settingHint": "KfIHGW_settingHint",
			"emptyAction": "KfIHGW_emptyAction",
			"itemMain": "KfIHGW_itemMain",
			"searchInput": "KfIHGW_searchInput",
			"promptIcon": "KfIHGW_promptIcon",
			"container": "KfIHGW_container",
			"settingItem": "KfIHGW_settingItem",
			"panelActive": "KfIHGW_panelActive",
			"toggleSwitch": "KfIHGW_toggleSwitch",
			"tabLabel": "KfIHGW_tabLabel",
			"overlay": "KfIHGW_overlay",
			"searchEmpty": "KfIHGW_searchEmpty",
			"settingBtn": "KfIHGW_settingBtn",
			"promptBtn": "KfIHGW_promptBtn",
			"tabIcon": "KfIHGW_tabIcon",
			"tabGroup": "KfIHGW_tabGroup",
			"headerActions": "KfIHGW_headerActions",
			"itemName": "KfIHGW_itemName",
			"itemContent": "KfIHGW_itemContent",
			"itemIcon": "KfIHGW_itemIcon",
			"panel": "KfIHGW_panel"
		};
		// src/client/library/PromptButton.tsx
		/** 下拉固定尺寸与定位参数（原 _positionPromptDropdown）。 */
		const DROPDOWN_WIDTH = 320;
		const DROPDOWN_HEIGHT = 400;
		const TOP_PADDING = 20;
		const GAP = 8;
		/** GitHub 仓库（原插件商店链接在 DSH 下统一指向 GitHub）。 */
		const GITHUB_URL = "https://github.com/houyanchao/dsh-prompt-library";
		const FEEDBACK_URL = "https://github.com/houyanchao/dsh-prompt-library/issues";
		function openExternalUrl(url) {
			window.open(url, "_blank", "noopener,noreferrer");
		}
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
		* @param enabled - 按钮是否启用（关闭时锚点不渲染，需重建）。
		* @returns 挂载座；定位不到命令按钮时为 null（调用方就地渲染兜底）。
		*/
		function useCommandSideSeat(markerRef, enabled) {
			const [seat, setSeat] = (0, react.useState)(null);
			(0, react.useLayoutEffect)(() => {
				if (!enabled) return;
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
			}, [enabled]);
			return seat;
		}
		function PromptButton({ useInput, useSession, inputActions, t }) {
			const library = (0, react.useSyncExternalStore)(promptsStore.subscribe, promptsStore.get);
			const draft = useInput((s) => s.draft);
			usePreventAutoScroll(useSession((s) => s.running), useInput((s) => s.phase), draft);
			const [dark, setDark] = (0, react.useState)(() => detectDarkTheme());
			(0, react.useEffect)(() => observeTheme(() => {
				setDark(detectDarkTheme());
			}), []);
			const [open, setOpen] = (0, react.useState)(false);
			const btnRef = (0, react.useRef)(null);
			const markerRef = (0, react.useRef)(null);
			const draftRef = (0, react.useRef)(draft);
			draftRef.current = draft;
			const seat = useCommandSideSeat(markerRef, library.promptButtonEnabled);
			useSmartEnter((mode) => {
				if (mode === "ctrlEnter") {
					const ctrlLabel = navigator.platform.toUpperCase().includes("MAC") ? "⌘" : "Ctrl";
					return t("smartEnter.toastCtrl").replace("{ctrl}", ctrlLabel);
				}
				if (mode === "shiftEnter") return t("smartEnter.toastShift");
				return t("smartEnter.toastDouble");
			});
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
			if (!library.promptButtonEnabled) return null;
			const libraryLabel = t("prompt.tooltipLibrary");
			const button = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				ref: btnRef,
				type: "button",
				className: promptButton_module_css_2b816f077c_default.promptBtn,
				"aria-label": libraryLabel,
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
					className: promptButton_module_css_2b816f077c_default.promptIcon,
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
			const [activeTab, setActiveTab] = (0, react.useState)("prompts");
			const settings = (0, react.useSyncExternalStore)(settingsStore.subscribe, settingsStore.get);
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
			const closeForNavigation = () => {
				tooltip.forceHideAll();
				onClose();
			};
			const openManage = () => {
				closeForNavigation();
				libraryPanel.set("prompts");
			};
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: promptButton_module_css_2b816f077c_default.overlay,
				onClick: onClose
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: containerRef,
				className: visible ? `${promptButton_module_css_2b816f077c_default.container} ${promptButton_module_css_2b816f077c_default.visible}` : promptButton_module_css_2b816f077c_default.container,
				"data-theme": dark ? "dark" : "light",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: promptButton_module_css_2b816f077c_default.tabs,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: promptButton_module_css_2b816f077c_default.tabGroup,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: activeTab === "prompts" ? `${promptButton_module_css_2b816f077c_default.tab} ${promptButton_module_css_2b816f077c_default.tabActive}` : promptButton_module_css_2b816f077c_default.tab,
								onClick: () => {
									setActiveTab("prompts");
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: promptButton_module_css_2b816f077c_default.tabText,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: promptButton_module_css_2b816f077c_default.tabLabel,
										children: t("prompt.title")
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: promptButton_module_css_2b816f077c_default.tabIcon,
									"aria-label": t("prompt.add"),
									onClick: (e) => {
										e.stopPropagation();
										openManage();
									},
									onMouseEnter: (e) => {
										tooltip.showOverlay(e.currentTarget, t("prompt.add"), {
											placement: "top",
											theme: dark ? "dark" : "light"
										});
									},
									onMouseLeave: () => {
										tooltip.hideOverlay();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
										width: "12",
										height: "12",
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
									})
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: activeTab === "common-settings" ? `${promptButton_module_css_2b816f077c_default.tab} ${promptButton_module_css_2b816f077c_default.tabActive}` : promptButton_module_css_2b816f077c_default.tab,
								onClick: () => {
									setActiveTab("common-settings");
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: promptButton_module_css_2b816f077c_default.tabText,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: promptButton_module_css_2b816f077c_default.tabLabel,
										children: t("prompt.commonSettingsTab")
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: promptButton_module_css_2b816f077c_default.tabIcon,
									"aria-label": t("prompt.allSettings"),
									onClick: (e) => {
										e.stopPropagation();
										closeForNavigation();
										libraryPanel.set("prompts");
									},
									onMouseEnter: (e) => {
										tooltip.showOverlay(e.currentTarget, t("prompt.allSettings"), {
											placement: "top",
											theme: dark ? "dark" : "light"
										});
									},
									onMouseLeave: () => {
										tooltip.hideOverlay();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsIcon, { strokeWidth: 2.2 })
								})]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: promptButton_module_css_2b816f077c_default.headerActions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: promptButton_module_css_2b816f077c_default.shareBtn,
								"aria-label": t("prompt.share"),
								onClick: (e) => {
									e.stopPropagation();
									openExternalUrl(GITHUB_URL);
								},
								onMouseEnter: (e) => {
									tooltip.showOverlay(e.currentTarget, t("prompt.share"), {
										placement: "top",
										theme: dark ? "dark" : "light"
									});
								},
								onMouseLeave: () => {
									tooltip.hideOverlay();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
									viewBox: "0 0 24 24",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "2.2",
									strokeLinecap: "round",
									strokeLinejoin: "round",
									"aria-hidden": true,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
											cx: "18",
											cy: "5",
											r: "3"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
											cx: "6",
											cy: "12",
											r: "3"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
											cx: "18",
											cy: "19",
											r: "3"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8.59 13.51 15.42 17.49" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M15.41 6.51 8.59 10.49" })
									]
								})
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: activeTab === "prompts" ? `${promptButton_module_css_2b816f077c_default.panel} ${promptButton_module_css_2b816f077c_default.panelActive}` : promptButton_module_css_2b816f077c_default.panel,
						children: [sorted.length >= 5 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: promptButton_module_css_2b816f077c_default.search,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: promptButton_module_css_2b816f077c_default.searchInput,
								placeholder: t("prompt.search"),
								autoComplete: "off",
								value: query,
								onChange: (e) => {
									setQuery(e.target.value);
								}
							})
						}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: promptButton_module_css_2b816f077c_default.body,
							children: sorted.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: promptButton_module_css_2b816f077c_default.empty,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: promptButton_module_css_2b816f077c_default.emptyHint,
									children: t("prompt.emptyHint")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: promptButton_module_css_2b816f077c_default.emptyAction,
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
								className: promptButton_module_css_2b816f077c_default.searchEmpty,
								children: t("prompt.noResults")
							}) : filtered.map((prompt) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptItem, {
								prompt,
								onClick: () => {
									onItemClick(prompt);
								}
							}, prompt.id))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: activeTab === "common-settings" ? `${promptButton_module_css_2b816f077c_default.panel} ${promptButton_module_css_2b816f077c_default.panelActive}` : promptButton_module_css_2b816f077c_default.panel,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: promptButton_module_css_2b816f077c_default.commonSettings,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: promptButton_module_css_2b816f077c_default.settingItem,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: promptButton_module_css_2b816f077c_default.settingInfo,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: promptButton_module_css_2b816f077c_default.settingTitleRow,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: promptButton_module_css_2b816f077c_default.settingLabel,
												children: t("prompt.feedbackTitle")
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: promptButton_module_css_2b816f077c_default.settingHint,
											children: t("prompt.feedbackHint")
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: promptButton_module_css_2b816f077c_default.settingBtn,
										onClick: (e) => {
											e.stopPropagation();
											openExternalUrl(FEEDBACK_URL);
										},
										children: t("prompt.feedbackButton")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: promptButton_module_css_2b816f077c_default.settingItem,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: promptButton_module_css_2b816f077c_default.settingInfo,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: promptButton_module_css_2b816f077c_default.settingTitleRow,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: promptButton_module_css_2b816f077c_default.settingLabel,
												children: t("prompt.githubStarTitle")
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: promptButton_module_css_2b816f077c_default.settingHint,
											children: t("prompt.githubStarHint")
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: promptButton_module_css_2b816f077c_default.settingBtn,
										onClick: (e) => {
											e.stopPropagation();
											openExternalUrl(GITHUB_URL);
										},
										children: t("prompt.githubStarButton")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: promptButton_module_css_2b816f077c_default.settingItem,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: promptButton_module_css_2b816f077c_default.settingInfo,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: promptButton_module_css_2b816f077c_default.settingTitleRow,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: promptButton_module_css_2b816f077c_default.settingLabel,
												children: t("prompt.preventAutoScrollLabel")
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: promptButton_module_css_2b816f077c_default.settingHint,
											children: t("prompt.preventAutoScrollHint")
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: promptButton_module_css_2b816f077c_default.toggleSwitch,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: settings.preventAutoScrollEnabled,
											onChange: (e) => {
												settingsStore.set({ preventAutoScrollEnabled: e.target.checked });
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: promptButton_module_css_2b816f077c_default.toggleSlider })]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: promptButton_module_css_2b816f077c_default.settingItem,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: promptButton_module_css_2b816f077c_default.settingInfo,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: promptButton_module_css_2b816f077c_default.settingTitleRow,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: promptButton_module_css_2b816f077c_default.settingLabel,
												children: t("prompt.smartInputTitle")
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: promptButton_module_css_2b816f077c_default.settingHint,
											children: t("prompt.smartInputHint")
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: promptButton_module_css_2b816f077c_default.settingBtn,
										onClick: (e) => {
											e.stopPropagation();
											tooltip.hide(true);
											onClose();
											libraryPanel.set("input");
										},
										children: t("prompt.settings")
									})]
								})
							]
						})
					})
				]
			})] }), document.body);
		}
		/** 单条提示词（原 _promptDropdownCreateItem：置顶图标 + 溢出时 hover tooltip）。 */
		function PromptItem({ prompt, onClick }) {
			const contentRef = (0, react.useRef)(null);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: promptButton_module_css_2b816f077c_default.item,
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
					className: promptButton_module_css_2b816f077c_default.itemMain,
					children: [prompt.pinned === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${promptButton_module_css_2b816f077c_default.itemIcon} ${promptButton_module_css_2b816f077c_default.pinnedIcon}`,
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
						className: promptButton_module_css_2b816f077c_default.itemName,
						children: prompt.name
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: contentRef,
					className: promptButton_module_css_2b816f077c_default.itemContent,
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
			bindInputSettings(ctx, onUnsaved);
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
