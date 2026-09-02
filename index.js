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

/** 目标 cordis.patch.yml 的绝对路径。 */
function patchPath() {
  return join(homedir(), ".dsh", "profiles", profileName(), "cordis.patch.yml");
}

/** 读取 patch 文档（缺失时返回一个空的默认文档）。 */
async function readPatch() {
  try {
    const text = await readFile(patchPath(), "utf8");
    return { exists: true, text };
  } catch {
    return { exists: false, text: "# 插件配置（由 dsh-config-editor 管理）\n[]\n" };
  }
}

/** 从 patch YAML 文本里提取所有 insert 插件行（id / name / config）。 */
function pluginsOf(text) {
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
          const { exists, text } = await readPatch();
          writeJson(res, 200, {
            ok: true,
            exists,
            profile: profileName(),
            path: patchPath(),
            plugins: pluginsOf(text),
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

          const { text } = await readPatch();
          let doc;
          try {
            doc = parse(text);
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
                if (Object.keys(config).length > 0) row.config = config;
                else delete row.config;
                updated = true;
              }
            }
          }
          if (!updated) {
            doc.push({ insert: [{ id: pluginId, config }] });
          }

          const next = stringify(doc, { lineWidth: 0 });
          await writeFile(patchPath(), next, "utf8");
          writeJson(res, 200, { ok: true, plugins: pluginsOf(next) });
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
