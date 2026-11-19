# What Is Public Administration?｜五刊实证地图（修订版）

> 修订说明：本版在原 PLAN 基础上，补充了网站结构、无摘要论文的处理、年份与文献类型规则、模型与聚类参数、前端工程细节、里程碑和待核实事项。修改处标有 **〔修订〕**。

## 项目目标

建成一个面向国际公共管理研究者和学生的英文网站。访客可以从地图找到论文，追踪主题随时间的变化，比较五本期刊，并查清每个图表用了哪些文献。最终交付是一个**无需登录即可访问的 HTTPS 网址**，以及能在本地重新生成数据和网站的项目源码。

首版覆盖 **1980–2025 年**，纳入 *Journal of Public Administration Research and Theory*、*Public Administration Review*、*Public Administration*、*Public Management Review* 和 *Governance*。各刊从其在研究窗口内的首个刊年起计（PAR、PA 自 1980 年，Governance 自 1988 年，JPART 自 1991 年，PMR 及其前身自 1999 年）。五刊横向比较使用 **2001–2025 年**，PMR 的 1999–2000 年前身（*Public Management*）在方法说明中单列。Peters 等人的研究也选了这五本刊，可作为语料设计和结果解读的学科参照。〔修订：正文改写为 “Peters et al. (年份)”，并核对作者、年份及五刊是否完全一致。〕 [PMR 出版商档案](https://www.tandfonline.com/loi/rpxm20?treeId=vrpxm19-1) · [五刊研究先例](https://doi.org/10.1111/gove.12705)

本次只读查询初步得到 **12,140 条候选记录，其中 9,415 条有摘要，约 77.6%**。按相同初筛口径，PAR 的摘要覆盖率约为 65%，PMR 约为 99%。这些是 OpenAlex 的候选数，正式篇数由卷期核对、文献类型筛选和去重决定。这一差异直接影响主题趋势的解读，因此网站会向读者展示摘要覆盖率和图表分母。 [OpenAlex 字段说明](https://help.openalex.org/data/works/attributes/)

## 网站结构 〔修订〕

| 页面 | 作用 | 与参考站的关系 |
|---|---|---|
| **Home** | 导读：研究了什么、语料边界、四个入口 | 借用 hero 结构（kicker + 衬线标题 + 一句话 + 数字行） |
| **Explore** | 彩色地图与论文列表并排，共用筛选条件；支持搜索和单篇直达链接 | 对应参考站的 Semantic Map |
| **Trends** | 主题篇数与占比、五刊对比；每张图都显示分母和摘要覆盖率 | 对应 Topic Lifecycles 和 Journal Comparison |
| **Findings** | 3–5 个问题，每个配一张吸顶图表和滚动叙事卡片；只放通过覆盖率检查和敏感性检查的结论 | **保留参考站的叙事编排** |
| **Data & Methods** | 逐刊逐年覆盖、筛选规则、模型参数、数据版本、局限 | 对应 About |

验收标准中的“首页结论”改为 **Findings 页结论**。Home 只链接到 Findings，不单独陈述结论。

## 从学习到上线

| 阶段 | 学习任务与交付 |
|---|---|
| **1. 拆解参考项目，建立五刊语料** | 从 *What is Strategy?* 学习题名与摘要如何变成可浏览地图，以及如何交代语料边界。先跑通 **2016–2025 年**五刊试点，再扩展到完整年份。用 OpenAlex 建立候选清单，用 Crossref 补核 DOI 和出版日期，分刊、分年代抽查出版商卷期目录。保留实证研究、理论文章和学术综述，剔除书评、勘误、目录和编辑公告。统一按 DOI 去重，无 DOI 的近似重复记录人工核验。交付逐刊逐年覆盖表、排除日志和冻结的数据版本。 [参考站方法](https://whatisstrategy.org/about) · [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) |
| 〔修订〕年份规则 | 归档年按以下优先级取：Crossref `journal-issue.published-print` → `published-print` → `issued` → OpenAlex `publication_year`。每条记录保存 `year_source` 字段。**截止规则**：只纳入卷期年 ≤ 2025 的论文；在线优先发表、但卷期年为 2026 的不纳入。只有在线日期的记录，在覆盖表中单独计数。 |
| 〔修订〕文献类型规则 | 按以下规则依次判断：① OpenAlex `type` 属于 {article, review}；② 标题不匹配排除正则（book review、erratum、correction、editorial、issue information、front/back matter、reviewers list、in memoriam、call for papers 等）；③ 页数已知时不少于 4 页；④ 页数未知且 `referenced_works_count = 0` 的记录进入人工核验清单，不自动排除。**PAR 的实务栏目**（Viewpoint、Commentary、Theory to Practice 等）是否纳入，在试点阶段抽样后决定，并写入 Data & Methods。 |
| **2. 生成并检验主题地图** | 用本地 **SPECTER2** 嵌入。〔修订〕**所有合格论文都嵌入并上图**：有摘要的输入 `title [SEP] abstract`，无摘要的只输入题名，并标记 `input_mode`。模型为 `allenai/specter2_base` 加 proximity adapter `allenai/specter2`（需 `adapters` 库），取 [CLS] 向量，最长 512 token，依赖版本全部锁定。〔修订〕在 **L2 归一化后的高维向量**上聚类，UMAP 只用于二维展示（`n_neighbors=15, min_dist=0.1, metric=cosine, random_state=42`）。子主题用 k-means，对 k ∈ {30, 40, 50, 60} 各跑 5 个随机种子，用种子间平均 ARI 衡量稳定性。宏观主题由子主题质心层次聚类得到，取 8–12 个，用于配色和趋势；子主题 40–60 个，用于地图标签。逐簇阅读中心、随机和边界论文，确定英文主题名称、范围说明和代表作。〔修订〕敏感性分析：① 全部论文改用仅题名输入，比较主题归属一致率和趋势差异；② 只用有摘要的子集重跑趋势。两组结果写入方法说明。交付可重跑的分析脚本和主题审读记录。 [SPECTER2](https://github.com/allenai/SPECTER2) · [UMAP 聚类说明](https://umap-learn.readthedocs.io/en/latest/clustering.html) |
| **3. 建成英文交互站** | **Home** 用一段导读说明网站研究了什么。**Explore** 用彩色地图和共用筛选条件的论文列表，支持按期刊、年份、主题筛选，按题名、作者或 DOI 搜索，并分享单篇论文链接。**Trends** 展示主题篇数、占比和五刊对比。**Findings** 用滚动叙事呈现已通过检查的结论。**Data & Methods** 公布逐刊逐年覆盖、筛选规则、模型参数、数据版本和局限。视觉风格以参考站拆解为底（中性灰阶、衬线标题、颜色只给数据），桌面端地图与列表并排，手机端优先保证检索和阅读。〔修订〕工程要求：① 地图用 Canvas 绘制，用 `d3-quadtree` 做命中检测；② 单篇链接用 hash 路由（`#/explore?paper=W…`），保证在 GitHub Pages 上刷新不会 404；③ 搜索使用客户端索引；④ 公开数据拆分为 manifest、papers、topics、coverage、trends 五个文件。 |
| **4. 验证、部署并交接** | 在 `~/Documents/sirui_vault/phd/website` 下新建独立项目 `what-is-public-administration`。用 Python 3.12 生成版本化静态数据，用 Vite 和 D3 构建前端。〔修订〕部署平台写明为 **GitHub Pages**（通过 GitHub Actions 从独立仓库发布），备选 Netlify 或 Cloudflare Pages。首版使用平台域名。交付正式网址、项目源码、数据字典，以及一次完整的更新与重新发布说明。 [GitHub Pages 发布文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) |

每个阶段留一页中文学习笔记，记录关键选择、可复跑命令和实际结果。学习顺序对应四个问题：**哪些论文进来了、主题如何生成、趋势能说明什么、数据更新后如何重新上线**。理论与方法编码、数据来源识别和引文网络安排在首版上线后，各自用样本验证。

## 里程碑 〔修订〕

| 周 | 里程碑 | 完成标志 |
|---|---|---|
| 1 | 试点语料（2016–2025） | 覆盖表、排除日志；PAR 实务栏目已决定 |
| 2 | 试点地图 | 稳定性报告；主题草稿名；审读表完成一半 |
| 3 | 全年份语料与地图 | 数据版本 v0.1 冻结；敏感性报告 |
| 4 | 网站全部页面接入真实数据 | 本地验收清单全部通过 |
| 5 | Findings 写作与部署 | 未登录会话走通一次完整检索 |

## 验收标准

- **语料可追溯。** 每条公开记录都能追查到 DOI、出版商记录或索引记录。各刊各年的合格数、有可用摘要数和上图数能够对账。尚未创刊、数据缺口和真实零值分别显示。〔修订〕视觉编码：创刊前用灰色斜线，数据缺口用虚线框加 “gap”，真实零值显示实线 “0”。
- **趋势可核算。** 主题占比的分母是对应期刊、对应年份的上图论文数（等于合格论文数，因为所有合格论文都上图）。图表同时显示篇数、分母和摘要覆盖率。覆盖率低于 50% 或分母小于 20 的区间加提示。Findings 页的结论只基于通过覆盖率检查和敏感性检查的结果。
- **公开产物经过字段检查。** 站点只发布书目信息、DOI、主题标签、二维坐标和汇总数据。原始摘要、全文、高维向量、受限数据库导出和凭证保存在本地分析环境。〔修订〕导出脚本内置字段白名单检查：一旦出现 abstract、embedding 等字段，构建直接失败。首版采用可用的开放数据和本地计算，不依赖 WoS 或 Scopus 订阅。 [OpenAlex 摘要说明](https://help.openalex.org/data/works/attributes/) · [Crossref 摘要权利说明](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)
- **线上可访问。** 在桌面端、手机和纯键盘操作下，验证地图与列表筛选、空结果、论文详情和直达链接。用未登录会话重新打开正式网址，并走通一次完整检索，以此作为项目完成条件。

## 待核实 〔修订〕

- [x] Peters、Pierre、Sørensen 和 Torfing（2022）使用同样五刊，研究窗为 2005–2019 年。 [论文与表 1](https://doi.org/10.1111/gove.12705)
- [x] 五刊现刊及 PMR 前身 ISSN 已核验，配置文件为 `pipeline/config.toml`。
- [x] OpenAlex 将 PMR 前身合并到 `S37623806`，本站仍按 1999–2000 年前身标注。

卷期日期和 PAR 档案页码在真实数据核验后另作处理。证据见[文献与期刊核验](docs/literature-and-journal-audit.md)。
