# dsh-config-editor

DSH 插件：在设置页里用**表单**可视化编辑 profile 的 `cordis.patch.yml` 插件配置，替代手动改 yaml。

## 功能

- 在 DSH 设置页新增「插件配置」页面（入口在设置里，不占主页）。
- 列出 `cordis.patch.yml` 里所有 `insert` 插件行。
- 按字段类型（字符串 / 数字 / 布尔 / 字符串数组 / 对象）渲染表单控件，可增删字段。
- 保存后写回 `~/.dsh/profiles/<profile>/cordis.patch.yml`。

## 安装

```sh
# 本地源码
dsh plugin --profile desktop add ./dsh-config-editor

# 或从 npm / GitHub 安装
dsh plugin --profile desktop add dsh-config-editor@latest
```

首次安装后**重启 DSH Desktop**，在 `设置 → 插件配置` 中打开。

## 使用

1. 打开 设置 → 插件配置。
2. 在「选择插件」里选中要配置的插件（如 `dsh-better-sidebar`）。
3. 编辑它的 config 字段（可添加 / 删除字段，切换类型）。
4. 点「保存」写回 `cordis.patch.yml`。
5. 重启 DSH（或等待 `patchReload` 热载）使配置生效。

## 目录结构

- `index.js` — host 半：读写 `cordis.patch.yml` + HTTP 路由。
- `client.js` — client 半：设置页表单（`settings.section`）。
- `cordis.patch.yml` — bundle patch：把插件行挂载进 profile 组合。

## 已知限制

- 保存使用 `parse → stringify` 整文件重写，`cordis.patch.yml` 里手写的注释会丢失（配置本身不丢）。
- 当前默认操作 `desktop` profile，可用环境变量 `DSH_PROFILE` 覆盖。

## License

MIT
