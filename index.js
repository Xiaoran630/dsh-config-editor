import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";

const name = "dsh-config-editor";
const inject = ["webServer"];

/** 当前 profile 名（可用 DSH_PROFILE 覆盖，默认 desktop）。 */
function profileName() {
  return process.env.DSH_PROFILE || "desktop";
}

function profileDir() {
  return join(homedir(), ".dsh", "profiles", profileName());
}

function userPatchPath() {
  return join(profileDir(), "cordis.patch.yml");
}

function packageJsonPath() {
  return join(profileDir(), "package.json");
}

/** 某个 bundle 包内 cordis.patch.yml 的路径。 */
function bundlePatchPath(bundle) {
  return join(profileDir(), "node_modules", ...bundle.split("/"), "cordis.patch.yml");
}

async function readText(p) {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

/** 从 patch YAML 文本里提取所有 insert 插件行（id / name / config）。 */
function rowsOf(text) {
  let doc;
  try {
    doc = parse(text);
  } catch {
    doc = [];
  }
  const out = [];
  if (!Array.isArray(doc)) return out;
  for (const entry of doc) {
    if (entry == null || typeof entry !== "object") continue;
    if (!Array.isArray(entry.insert)) continue;
    for (const row of entry.insert) {
      if (row == null || typeof row !== "object") continue;
      out.push({
        id: typeof row.id === "string" ? row.id : "",
        name: typeof row.name === "string" ? row.name : "",
        config: row.config != null && typeof row.config === "object" ? row.config : {},
      });
    }
  }
  return out;
}

/** 读取 package.json 里的 dsh.profile.bundles。 */
async function readBundles() {
  const text = await readText(packageJsonPath());
  if (text === null) return [];
  try {
    const pkg = JSON.parse(text);
    return Array.isArray(pkg?.dsh?.profile?.bundles) ? pkg.dsh.profile.bundles : [];
  } catch {
    return [];
  }
}

/** 收集所有可配置插件：bundles 里的插件（过滤基础包），合并 bundle 默认 + 用户覆盖。 */
async function collectPlugins() {
  const bundles = await readBundles();
  const userText = await readText(userPatchPath());
  const userRows = userText === null ? [] : rowsOf(userText);
  const plugins = [];

  for (const bundle of bundles) {
    if (bundle.startsWith("@deepseek-ai/")) continue;
    const bundleText = await readText(bundlePatchPath(bundle));
    // 没有 bundle patch 的包（无 cordis.patch.yml 或结构不符）跳过：无法确定其挂载 id。
    if (bundleText === null) continue;
    const bundleRows = rowsOf(bundleText);
    if (bundleRows.length === 0) continue;

    for (const row of bundleRows) {
      const id = row.id || bundle;
      const userConfig = userRows.find((r) => r.id === id)?.config ?? {};
      plugins.push({
        bundle,
        id,
        name: row.name || bundle,
        defaultConfig: row.config || {},
        config: { ...(row.config || {}), ...userConfig },
      });
    }
  }
  return plugins;
}

/** 把某个插件的用户覆盖 config 写回用户层 cordis.patch.yml。 */
async function saveConfig(pluginId, config) {
  const userText = await readText(userPatchPath());
  let doc;
  try {
    doc = userText === null ? [] : parse(userText);
  } catch {
    doc = [];
  }
  if (!Array.isArray(doc)) doc = [];

  let updated = false;
  for (const entry of doc) {
    if (entry == null || typeof entry !== "object") continue;
    if (!Array.isArray(entry.insert)) continue;
    for (const row of entry.insert) {
      if (row != null && typeof row === "object" && row.id === pluginId) {
        if (config && Object.keys(config).length > 0) row.config = config;
        else delete row.config;
        updated = true;
      }
    }
  }
  if (!updated) {
    doc.push({ insert: [{ id: pluginId, config }] });
  }

  const next = stringify(doc, { lineWidth: 0 });
  await writeFile(userPatchPath(), next, "utf8");
  return next;
}

function writeJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/config-editor/api",
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://dsh.internal");
        const sub = url.pathname.replace(/^\/config-editor\/api\/?/, "");

        if (sub === "list" || sub === "") {
          if (req.method !== "GET") {
            writeJson(res, 405, { ok: false, error: "method not allowed" });
            return;
          }
          const plugins = await collectPlugins();
          writeJson(res, 200, {
            ok: true,
            profile: profileName(),
            path: userPatchPath(),
            plugins,
          });
          return;
        }

        if (sub === "save") {
          if (req.method !== "POST") {
            writeJson(res, 405, { ok: false, error: "method not allowed" });
            return;
          }
          const body = await readJsonBody(req);
          const pluginId = typeof body.id === "string" ? body.id : "";
          const config = body.config != null && typeof body.config === "object" ? body.config : {};
          if (pluginId === "") {
            writeJson(res, 400, { ok: false, error: "missing id" });
            return;
          }
          await saveConfig(pluginId, config);
          writeJson(res, 200, { ok: true, plugins: await collectPlugins() });
          return;
        }

        writeJson(res, 404, { ok: false, error: "unknown method" });
      } catch (error) {
        writeJson(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  }), "dsh-config-editor: api");
}

export { apply, inject, name };
