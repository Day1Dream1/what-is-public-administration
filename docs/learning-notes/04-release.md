# 数据更新后如何重新上线？

日期：2026-11-19

v0.1 的[公开站点](https://what-is-public-administration.threegogoing.chatgpt.site/)使用 1980–2025 年真实语料。公开产物包含书目、二维坐标、主题与汇总数据。本机保留原始快照、摘要、模型和审读工作表。GitHub Pages 工作流使用独立项目仓库，开启 Pages 的 GitHub Actions 发布源后才会出正式地址。

```bash
cd pipeline
.venv/bin/python -m pa_map export --release
cd ../site
npm ci
node scripts/check-release.mjs
npm run build
node scripts/check-release.mjs dist
```

更新版本时重新运行数据与模型步骤，复核主题标签及 Findings 的数值和 `data_version`，再执行上述检查。v0.1 匹配 10,606 条唯一论文，趋势汇总和 230 个期刊年度单元均通过构建前后对账。桌面与手机测试涵盖仓库子路径。公开版也通过免登录 DOI 检索和[论文直达链接重载](https://what-is-public-administration.threegogoing.chatgpt.site/#/explore?paper=W2123431441)。
