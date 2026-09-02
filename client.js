window.__ModuleLoader__.load({
  id: "dsh-config-editor",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let React = require("react");

    if (typeof document !== "undefined" && !document.getElementById("dsh-config-editor-style")) {
      const style = document.createElement("style");
      style.id = "dsh-config-editor-style";
      style.textContent = [
        ".cfe-root{padding:16px;display:flex;flex-direction:column;gap:14px}",
        ".cfe-head h2{margin:0 0 4px;font-size:16px}",
        ".cfe-sub{margin:0;color:var(--dsw-alias-label-secondary,#8a8f98);font-size:12px;line-height:1.5}",
        ".cfe-error{color:var(--dsw-alias-state-error-primary,#e5484d)}",
        ".cfe-row{display:flex;align-items:center;gap:8px;font-size:13px}",
        ".cfe-row select{flex:1;height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#1e1f22);color:var(--dsw-alias-label-primary,#fff)}",
        ".cfe-fields{display:flex;flex-direction:column;gap:8px}",
        ".cfe-field{display:flex;align-items:center;gap:8px}",
        ".cfe-key{flex:0 0 150px;height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#1e1f22);color:var(--dsw-alias-label-primary,#fff);font-size:13px}",
        ".cfe-type{flex:0 0 110px;height:30px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#1e1f22);color:var(--dsw-alias-label-primary,#fff);font-size:13px}",
        ".cfe-value{flex:1;display:flex}",
        ".cfe-value input,.cfe-value textarea{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#1e1f22);color:var(--dsw-alias-label-primary,#fff);font-size:13px;font-family:inherit}",
        ".cfe-value textarea{resize:vertical}",
        ".cfe-remove{flex:none;height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);cursor:pointer;font-size:12px}",
        ".cfe-actions{display:flex;gap:8px}",
        ".cfe-actions button{height:32px;padding:0 14px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#1e1f22);color:var(--dsw-alias-label-primary,#fff);cursor:pointer;font-size:13px}",
        ".cfe-actions .cfe-save{background:var(--dsw-alias-interactive-bg-hover-accent,#5a5f8a)}",
        ".cfe-actions button:disabled{opacity:.5;cursor:default}",
        ".cfe-msg{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98)}",
      ].join("\n");
      document.head.appendChild(style);
    }

    const inject = ["slots"];

    function typeOfValue(v) {
      if (v === null || v === undefined) return "string";
      if (Array.isArray(v)) return "array";
      if (typeof v === "boolean") return "boolean";
      if (typeof v === "number") return "number";
      if (typeof v === "object") return "object";
      return "string";
    }

    function parseValue(type, raw) {
      if (type === "number") {
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
      }
      if (type === "boolean") return raw === true;
      if (type === "array") {
        return String(raw).split("\n").map((s) => s.trim()).filter((s) => s !== "");
      }
      if (type === "object") {
        try {
          return JSON.parse(raw);
        } catch {
          return {};
        }
      }
      return String(raw);
    }

    function stringifyValue(type, value) {
      if (type === "array") return (Array.isArray(value) ? value : []).join("\n");
      if (type === "object") return JSON.stringify(value, null, 2);
      if (value === null || value === undefined) return "";
      return String(value);
    }

    function ConfigEditorSection() {
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState(null);
      const [plugins, setPlugins] = React.useState([]);
      const [profile, setProfile] = React.useState("");
      const [path, setPath] = React.useState("");
      const [selectedId, setSelectedId] = React.useState("");
      const [draft, setDraft] = React.useState([]);
      const [saving, setSaving] = React.useState(false);
      const [message, setMessage] = React.useState("");

      const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(window.location.origin + "/config-editor/api/list");
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "加载失败");
          const list = data.plugins || [];
          setPlugins(list);
          setProfile(data.profile || "");
          setPath(data.path || "");
          if (list.length > 0) {
            setSelectedId(list[0].id);
            setDraft(Object.entries(list[0].config || {}).map(([key, value]) => ({
              key,
              type: typeOfValue(value),
              raw: stringifyValue(typeOfValue(value), value),
            })));
          } else {
            setSelectedId("");
            setDraft([]);
          }
        } catch (e) {
          setError(e && e.message ? e.message : String(e));
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => {
        load();
      }, [load]);

      const selectPlugin = (id) => {
        setSelectedId(id);
        setMessage("");
        const plugin = plugins.find((p) => p.id === id);
        setDraft(Object.entries(plugin ? plugin.config || {} : {}).map(([key, value]) => ({
          key,
          type: typeOfValue(value),
          raw: stringifyValue(typeOfValue(value), value),
        })));
      };

      const updateField = (index, patch) => {
        setDraft((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
      };

      const addField = () => {
        setDraft((prev) => [...prev, { key: "", type: "string", raw: "" }]);
      };

      const removeField = (index) => {
        setDraft((prev) => prev.filter((_, i) => i !== index));
      };

      const save = async () => {
        if (selectedId === "") return;
        setSaving(true);
        setMessage("");
        const config = {};
        for (const f of draft) {
          const key = (f.key || "").trim();
          if (key === "") continue;
          config[key] = parseValue(f.type, f.raw);
        }
        try {
          const res = await fetch(window.location.origin + "/config-editor/api/save", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: selectedId, config }),
          });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "保存失败");
          setMessage("已保存到 " + path + "（重启 DSH 或等待热重载生效）");
          setPlugins(data.plugins || plugins);
        } catch (e) {
          setMessage("保存失败：" + (e && e.message ? e.message : String(e)));
        } finally {
          setSaving(false);
        }
      };

      const valueControl = (field, index) => {
        if (field.type === "boolean") {
          return React.createElement("input", {
            type: "checkbox",
            checked: field.raw === true,
            onChange: (ev) => updateField(index, { raw: ev.target.checked }),
          });
        }
        if (field.type === "array" || field.type === "object") {
          return React.createElement("textarea", {
            rows: field.type === "object" ? 5 : 3,
            value: field.raw,
            onChange: (ev) => updateField(index, { raw: ev.target.value }),
          });
        }
        return React.createElement("input", {
          type: field.type === "number" ? "number" : "text",
          value: field.raw,
          onChange: (ev) => updateField(index, { raw: ev.target.value }),
        });
      };

      return React.createElement("div", { className: "cfe-root" },
        React.createElement("div", { className: "cfe-head" },
          React.createElement("h2", null, "插件配置编辑器"),
          React.createElement("p", { className: "cfe-sub" },
            "可视化编辑 profile 的 cordis.patch.yml 插件 config，替代手动改 yaml。当前 profile：" + (profile || "…") + " · " + (path || "…")
          )
        ),

        loading
          ? React.createElement("p", null, "加载中…")
          : error
            ? React.createElement("p", { className: "cfe-error" }, "加载失败：" + error)
            : plugins.length === 0
              ? React.createElement("p", null, "没有检测到可配置的插件（profile 的 bundles 里没有带 cordis.patch.yml 的插件）。")
              : React.createElement(React.Fragment, null,
                  React.createElement("div", { className: "cfe-row" },
                    React.createElement("label", null, "选择插件："),
                    React.createElement("select", {
                      value: selectedId,
                      onChange: (ev) => selectPlugin(ev.target.value),
                    }, plugins.map((p) => React.createElement("option", {
                      key: p.id,
                      value: p.id,
                    }, p.name || p.id)))
                  ),

                  React.createElement("div", { className: "cfe-fields" },
                    draft.length === 0
                      ? React.createElement("p", { className: "cfe-sub" }, "该插件暂无配置项。")
                      : draft.map((field, index) => React.createElement("div", {
                          key: index,
                          className: "cfe-field",
                        },
                          React.createElement("input", {
                            className: "cfe-key",
                            placeholder: "字段名",
                            value: field.key,
                            onChange: (ev) => updateField(index, { key: ev.target.value }),
                          }),
                          React.createElement("select", {
                            className: "cfe-type",
                            value: field.type,
                            onChange: (ev) => updateField(index, { type: ev.target.value }),
                          },
                            React.createElement("option", { value: "string" }, "字符串"),
                            React.createElement("option", { value: "number" }, "数字"),
                            React.createElement("option", { value: "boolean" }, "布尔"),
                            React.createElement("option", { value: "array" }, "字符串数组"),
                            React.createElement("option", { value: "object" }, "对象(JSON)")
                          ),
                          React.createElement("div", { className: "cfe-value" }, valueControl(field, index)),
                          React.createElement("button", {
                            className: "cfe-remove",
                            type: "button",
                            onClick: () => removeField(index),
                          }, "删除")
                        ))
                  ),

                  React.createElement("div", { className: "cfe-actions" },
                    React.createElement("button", { type: "button", onClick: addField }, "添加字段"),
                    React.createElement("button", {
                      type: "button",
                      className: "cfe-save",
                      disabled: saving || selectedId === "",
                      onClick: save,
                    }, saving ? "保存中…" : "保存")
                  ),

                  message ? React.createElement("p", { className: "cfe-msg" }, message) : null
                )
      );
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "config-editor",
        order: 90,
        label: () => "插件配置",
        inject: () => ({}),
      }, ConfigEditorSection));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
