# What Is Public Administration? 项目交接

Claude Code、Codex 和项目维护者可以共同使用这份文档。工作目录是 `~/Documents/sirui_vault/phd/website/what-is-public-administration`，它是独立的 Git 仓库。公开的 v0.1 覆盖 1980–2025 年五本期刊的 10,606 篇论文，有 10 个宏观组、30 个子主题。五刊直接比较使用 2001–2025 年。 [GitHub 仓库](https://github.com/Day1Dream1/what-is-public-administration) · [GitHub Pages 公开版](https://day1dream1.github.io/what-is-public-administration/)

## 用 Claude Code 打开

在装好 Claude Code 的终端中运行：

```bash
cd "$HOME/Documents/sirui_vault/phd/website/what-is-public-administration"
git fetch origin
git status --short --branch
git rev-parse --short HEAD
git rev-parse --short origin/main
claude
```

Claude Code 的仓库入口是 `CLAUDE.md`，Codex 从 `AGENTS.md` 进入，两者都指向这份交接文档。轮流编辑时共用当前目录即可。同时编辑时各用独立分支和 Git worktree，把变更提交、验证结果和待核对事项放在 PR 中。合并到 `main` 会触发 GitHub Pages 的发布流程。 [Claude Code 的项目说明文件](https://code.claude.com/docs/en/memory)

可以把下面这段交给 Claude Code 做首轮诊断。

> 先读 `docs/HANDOFF.md`，记录当前提交，按文档启动本地生产预览。逐章检查滚动、图形与正文高亮同步、章内按钮、章节切换和直达链接；对照线上同一路径，分别测试桌面和窄屏。检查数值和文案是否符合发布数据与题名短语的证据口径。先做只读诊断，列出可复现的问题、预期与实际表现、相关文件和行号，并标注待确认项。如果我给了截图或复现步骤，请先从该案例入手。请先交报告，在我审阅前保持文件和 Git 发布状态原样。

## 五章入口

从 [正式版章节索引](https://day1dream1.github.io/what-is-public-administration/#/chapters)进入。本地预览也使用下表的哈希路径，地址以 Vite 在终端打印的为准。旧的 `#/findings` 链接仍应打开第一章。

| 章节 | 路径 | 步数 | 证据与图形 |
| --- | --- | ---: | --- |
| 学科如何演变 | `#/chapters/field-map` | 8 | 同一张地图的出版时期高亮、主题份额对比、摘要覆盖口径检查 |
| 理论与概念 | `#/chapters/ideas` | 5 | 三个理论或概念短语的分期计数、比例和行高亮 |
| 五本期刊 | `#/chapters/journals` | 6 | 固定投影切换期刊高亮，随后比较刊内主题份额 |
| 题名里的方法 | `#/chapters/methods-in-titles` | 6 | 四类方法措辞的分期计数、比例和行高亮 |
| 方法与研究主题 | `#/chapters/methods-and-questions` | 5 | 固定投影切换方法线索，随后比较主题内的共现比例 |

理论和方法线索来自题名中的明确短语。图表分母是对应时期或主题的样本量，同一文章可能匹配多个短语。第五章统计方法短语与主题标签的共现，两个指标都用到了题名文本，文案据此限定为描述性证据。 [参考站 95 步走查](reference-audit/README.md)

## 改哪里

| 想调整什么 | 入口 |
| --- | --- |
| 首页标题、导读和地图预览 | `site/src/pages/home.js`、`site/src/style.css` |
| 地图、搜索、筛选和单篇论文 | `site/src/map.js`、`site/src/pages/explore.js`、`site/src/router.js` |
| 第一章文案与对比设定 | `site/public/content/findings.json` |
| 第二至第五章文案与高亮设定 | `site/public/content/chapters.json` |
| 章内滚动、图形与分母 | `site/src/pages/findings.js`、`site/src/chapter-evidence.js`、`site/src/style.css` |
| 章节索引、导航和旧路径兼容 | `site/src/chapters.js`、`site/src/main.js` |
| 趋势和方法说明 | `site/src/pages/trends.js`、`site/src/pages/methods.js` |
| 语料范围、纳入规则、主题名称 | `pipeline/config.toml`、`pipeline/audit/publisher-sample.csv`、`pipeline/labels/topics.csv` |
| 正式构建和上线 | `site/scripts/check-release.mjs`、`.github/workflows/deploy.yml` |

网站是 Vite 和 D3 静态项目。布局、筛选、动效和文字可用已生成的 `site/public/data/` 直接调试。图表统计基于同一个版本的论文、主题、覆盖和趋势数据。调整纳入规则、主题或聚类参数时，按 [README 的分析流程](../README.md)重跑并核对五章引用的主题 ID、文案数字及分母。供复核的原始数据与模型在本机 `pipeline/data/`，公开仓库使用发布用书目及派生结果。

## 本地验收

从项目根目录开始运行：

```bash
cd site
npm ci
node scripts/check-release.mjs
npm run build
node scripts/check-release.mjs dist
npm run preview
```

- 在终端打印的预览地址后加 `#/chapters`，从索引打开五章。分别以桌面宽度和 390、320 CSS 像素宽度滚完各章，确认图台、正文高亮和进度计数同步，每章末步与表中步数相符。
- 试用图台内的 Previous 和 Next、章末的章节链接、导航中的章节链接，以及直达路径刷新。需要记录问题时，注明章节路径、步骤标题、窗口尺寸、滚动方向、实际表现和控制台错误。
- 回归检查 Home、Explore、Trends 和 Data & Methods。测试地图修改时也检查桌面及手机上的缩放、点击、键盘焦点与不同设备像素比。
- 在 Explore 输入 `10.1093/jopart/mui057`，应得到 Dunleavy 等人的唯一匹配。刷新 `#/explore?paper=W2123431441` 后应恢复论文详情。
- 语料复核中的一条勘误和一篇专题导言见[核验记录](literature-and-journal-audit.md)。处理纳入问题时，从记录证据、重新导出和复核趋势入手。

## 第一次部署到 GitHub Pages

当前仓库已经启用 GitHub Actions 发布源，`main` 上的部署已验证。以下步骤适用于首次设置或未来迁移到新仓库。

1. 登录 `Day1Dream1`，在该账号下[新建仓库](https://github.com/new)，命名为 `what-is-public-administration`，选择 **Public**。留空 README、`.gitignore` 和许可证选项，以便推送现有项目历史。
2. 在本项目根目录执行 `git push -u origin main`。当前本机 `origin` 使用已验证的 `github-sirui` SSH 配置。其他电脑可从 GitHub 克隆，使用各自已授权的 Git 连接。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。如果初次 push 的工作流早于这一步，可到 **Actions → Deploy site to GitHub Pages → Run workflow**，选择 `main` 后运行一次。
4. 等发布任务成功，再从 **Settings → Pages** 或工作流部署任务中复制实际网址。常见地址为 `https://day1dream1.github.io/what-is-public-administration/`。用无痕窗口确认首页、论文链接刷新和 `data/manifest.json` 的 `status: release`。

以后修改先在分支预览，审阅通过后合并到 `main`。工作流运行发布数据检查、构建、上传 `site/dist` 并部署。 [配置 GitHub Pages 发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
