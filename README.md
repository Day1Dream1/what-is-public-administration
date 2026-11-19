# What Is Public Administration?

五刊实证地图：把 *JPART*、*PAR*、*Public Administration*、*PMR* 和 *Governance* 1980–2025 年的研究论文放到同一张主题地图上。

`site/public/data/manifest.json` 记录当前数据版本和状态。GitHub Pages 仅部署通过校验的 `release` 版本。五刊 ISSN、抽查记录和解释用的参考文献见[核验报告](docs/literature-and-journal-audit.md)。

[GitHub Pages 公开版 v0.1](https://day1dream1.github.io/what-is-public-administration/)收录 1980–2025 年五刊的 10,606 篇论文。[Sites 公开版](https://what-is-public-administration.threegogoing.chatgpt.site/)使用同一份数据。

[Claude Code 与 Codex 交接文档](docs/HANDOFF.md)包含入口命令、文件地图、本地验收和 GitHub Pages 首次部署步骤。

## 目录结构

```
what-is-public-administration/
├── PLAN.revised.md            修订版计划
├── pipeline/                  Python 数据管线（本地运行）
│   ├── config.toml            期刊、ISSN、年份、筛选规则、模型参数 ← 先改这里
│   ├── requirements.txt
│   ├── pa_map/                fetch → clean → embed → cluster → export，以及 demo
│   ├── labels/topics.csv      主题人工命名表（cluster 阶段生成模板，由你填写）
│   └── data/                  仅本地：原始数据、摘要、向量、审读表（已在 .gitignore 中，不会提交）
├── site/                      Vite + D3 静态网站
│   ├── public/data/           export 生成的公开数据（网站读取这里）
│   ├── public/content/findings.json   Findings 页文案（不用改代码就能写）
│   └── src/                   页面、地图、图表、样式
├── docs/learning-notes/       每阶段一页学习笔记模板
└── .github/workflows/deploy.yml   推送后自动部署到 GitHub Pages
```

## 第一次运行（在你的 Mac 终端里）

### 0. 准备环境

```bash
cd ~/Documents/sirui_vault/phd/website/what-is-public-administration/pipeline
brew install python@3.12 node        # 已安装可跳过
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.lock.txt  # 含 torch 与 SPECTER2，本版在 macOS arm64 验证
```

可在自己的终端设置 `PA_MAP_CONTACT_EMAIL` 为 Crossref 联系地址。OpenAlex 和 Crossref 的匿名查询在本次运行中可用。如果 OpenAlex 提示免费额度不足，可配置 `OPENALEX_API_KEY`。把凭证保留在本地环境变量。模型首次运行时从 Hugging Face 下载固定版本，论文文本在本机编码。

### 1. 试点语料（2016–2025）

```bash
export PA_MAP_DATA_DIR="$PWD/data/pilot"
export PA_MAP_LABELS_DIR="$PWD/data/pilot/labels"
python -m pa_map fetch --pilot     # OpenAlex 候选 + 按期刊批量获取 Crossref 日期
python -m pa_map clean --pilot     # 年份规则、类型筛选、去重、覆盖表
```

检查 `$PA_MAP_DATA_DIR/review/` 下的三个文件：

| 文件 | 看什么 |
|---|---|
| `coverage.csv` | 逐刊逐年的候选数、排除数、合格数、有摘要数；`gap` 表示该年没有合格论文，需要去出版商目录核对 |
| `exclusions.csv` | 每条被排除的记录和原因，抽查有没有误删 |
| `manual_check.csv` | 需要人工判断的记录：PAR 实务栏目、无页码且无参考文献的记录、疑似重复 |

`pipeline/audit/publisher-sample.csv` 保存逐 DOI 或 OpenAlex ID 的核验结论。PAR 首版按学术实质筛选，对已确认的编辑、介绍和观点栏目作排除处理，并保留实质性论文。新的出版商证据可以录入该表，随后重跑清洗。

### 2. 嵌入与聚类

```bash
python -m pa_map embed                  # 题名 + 摘要（无摘要的只用题名），M 系列芯片会自动用 MPS 加速
python -m pa_map embed --title-only     # 敏感性分析：全部只用题名
python -m pa_map cluster                # 稳定性检查、k-means、宏观主题、UMAP、审读表
```

- `$PA_MAP_DATA_DIR/review/stability.csv`：不同 k 在多个随机种子之间的平均 ARI。
- `$PA_MAP_DATA_DIR/review/topic_review.csv`：每个子主题的中心、随机和边界论文各最多 5 篇。
- `$PA_MAP_LABELS_DIR/topics.csv`：主题命名表。填写 `label` 和 `description`，审读完把 `reviewed` 改成 `yes`。

> ⚠️ 重新运行 `cluster` 会改变主题编号。命名完成后，除非有意重做，否则不要再跑 cluster；重跑时程序会把新模板写到 `topics.draft.csv`，不会覆盖你填好的表。

### 3. 全量语料与模型

```bash
unset PA_MAP_DATA_DIR PA_MAP_LABELS_DIR
python -m pa_map fetch
python -m pa_map clean
export PA_MAP_REUSE_EMBEDDINGS="$PWD/data/pilot/private"
python -m pa_map embed
python -m pa_map embed --title-only
python -m pa_map cluster
```

审读全量模型的主题后更新 `pipeline/labels/topics.csv`。重跑聚类会生成 `topics.draft.csv`，应按新编号核对并采用新的命名表。确定新数据版本时更新 `config.toml` 里的 `data_version`，然后运行 `python -m pa_map export --release`。导出核验全时段、标签状态、语料版本、文件字段和逐刊逐年的图表分母。

### 4. 写 Findings 并预览

编辑 `site/public/content/findings.json`：

- `steps` 按阅读顺序排列。每步用 `heading` 和 `text` 解释一个问题，用 `figure` 选择地图、对比图或敏感性表。
- 地图步骤用 `filter.period` 选择 `periods` 中的时间窗。对比步骤在 `compare.macros` 中按揭示顺序列出主题 ID，两个五年组的篇数和分母由网站随数据计算。
- 更新数据时复核叙事中的数字、主题名和敏感性表。定稿后将 `status` 设为 `final`，并让 `data_version` 与导出版本一致。

```bash
cd ../site
npm ci
node scripts/check-release.mjs
npm run build
node scripts/check-release.mjs dist
npm run preview
```

## 部署到 GitHub Pages

1. 在 GitHub 新建项目专用的公开仓库。提交前检查暂存列表，只推本项目，`pipeline/data/` 与 `.venv` 等本地分析输入已配置忽略。
2. 在仓库 Settings → Pages → Build and deployment 中，Source 选 **GitHub Actions**。
3. 每次推送到 `main` 分支都会自动构建和发布，网址形如 `https://<用户名>.github.io/<仓库名>/`。
4. 用未登录的浏览器（无痕窗口）打开这个网址，走通一次检索，作为验收。

如果改用 Netlify 或 Cloudflare Pages：构建目录填 `site`，构建命令填 `npm run build`，发布目录填 `site/dist`。

## 更新与重新发布

为新语料提高 `data_version`，按顺序跑完整管线并审读新主题，再导出发布版、核对 Findings 与部署前检查。需要复现现版时使用同一批原始快照，Live API 重新抓取会受源库更新影响。向量缓存以输入和模型版本校验。保留数据版本与发布日期，便于对账。

## 数据字典（`site/public/data/`）

| 文件 | 内容 |
|---|---|
| `manifest.json` | `status`（demo / pilot / release）、数据版本、时间窗、期刊、计数、模型参数、稳定性、敏感性、筛选设置 |
| `papers.json` | 列式存储：`fields` + `rows`。字段为 `id`（OpenAlex ID）、`doi`、`title`、`authors`（前 3 位加 et al.）、`year`（卷期年）、`j`（期刊序号）、`m`（宏观主题 id）、`s`（子主题 id）、`x` / `y`（0–1 的地图坐标）、`a`（1 = 有摘要）、`c`（OpenAlex 被引数） |
| `topics.json` | `macro`：id、label、description、reviewed、color、n；`sub`：id、macro、label、reviewed、n、cx、cy（标签位置） |
| `coverage.json` | 每刊每年一行：`status`（ok / gap / not_launched）、predecessor、candidates、excluded、eligible、with_abstract、mapped |
| `trends.json` | `[期刊序号, 年, 宏观主题, 篇数]` |
| `downloads/*.csv` | papers 和 coverage 的 CSV 版本 |

公开数据不含摘要、全文或向量。`export` 阶段会检查字段，一旦出现这些字段就直接失败。

## 重新生成演示数据

```bash
cd pipeline && python -m pa_map demo     # 写入 pipeline/demo/ 和 site/public/data/，不会动真实数据
```
