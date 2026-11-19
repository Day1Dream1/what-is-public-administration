# 六章一比一重构：诊断与逐步对照

日期：2026-11-19。本文件说明为什么把原先的五章改为与 *What is Strategy?* 一一对应的六章，以及每一步滚动在参考站和本站分别做什么。逐步截图对照（参考站 74 步，本站 74 步）由 Playwright 在 1440×900 的桌面视口下生成，生成脚本见文末。 [参考站](https://whatisstrategy.org/) · [参考站逐步审计](../reference-audit/README.md)

## 一、诊断：旧版五章与参考站的差距

| 维度 | 参考站 | 旧版本站（v0.1，提交 43a06cf） | 后果 |
| --- | --- | --- | --- |
| 章节数与问题 | 6 章，每章一个问题，每章用不同证据回答 | 5 章；“学科是否分裂”一章缺失，“结论”一章缺失 | 读者无法沿“是什么 → 理论 → 分裂 → 方法 → 方法塑造问题 → 结论”的论证链读完 |
| 吸顶图段 / 滚动步 | 14 段 / 74 步 | 5 个图台 / 30 步，各章共用一个图台 | 每一步的画面变化无法与参考站对应 |
| 证据类型 | LLM 摘要分类、摘要中的理论提及、50 簇集中度、语义凝聚度、引文网络、因果方法编码、数据来源编码、中心距离检验、问题评分 | 全部来自题名短语计数 | 题名很少写理论或方法，证据过薄；无法量化参考站提出的问题 |
| 图形种类 | 粒子地图、小多图、双线面积、堆叠面积、发散条形、四指标卡、弦图、热图、散点+同心圆、箱线图、四线综合 | 地图 + 条形 + 表格 | 视觉节奏单一 |
| 段间衔接 | 每段之间一个整屏衬线问句，问句出现时侧栏滑出 | 无 | 段与段之间没有转场 |
| Explore | 7 个工具（语义地图、主题浏览、主题生命周期、期刊对照、引文流、方法面板、About） | 地图、Trends、Data & Methods 3 个 | 读者无法自行核查章节中的结论 |

## 二、新结构

| 章 | 路径 | 吸顶图段 × 步数 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| 1 What is public administration — and how has the field evolved? | `#/chapters/what-is-public-administration` | 语义地图 6 + 主题小多图 7 = 13 | 已发布的主题与坐标 | 可用 |
| 2 What happened to the big theories? | `#/chapters/big-theories` | 理论 vs 现象 4 + 理论轨迹 7 + 子领域增减 4 = 15 | LLM 分类（8,874 篇已完成）、摘要理论提及、子主题份额变化 | — |
| 3 Is the public administration field fracturing? | `#/chapters/fracturing` | 四项分裂指标 6 + 引文弦图 5 = 11 | 子主题 HHI、SPECTER2 语义凝聚度与离散度、Crossref 引文 | 可用 |
| 4 What methods do scholars use? | `#/chapters/methods` | 因果方法面积图 5 + 主题×时期热图 6 + 数据来源 4 = 15 | 关键词规则（`pipeline/coding_rules.toml`） | 可用 |
| 5 Are our methods shaping the questions we ask? | `#/chapters/methods-shaping-questions` | 语义空间散点 5 + 问题评分箱线图 4 = 9 | 中心距离 Welch 检验；LLM 评分（已完成） | — |
| 6 What we learned | `#/chapters/conclusion` | 四条趋势 6 + 五个解释视角 5 = 11 | 前五章的汇总 | — |

合计 14 个吸顶图段、74 步，与参考站完全一致。旧路径（`#/findings`、`#/chapters/field-map` 等）自动跳转到对应新章；`#/chapters/journals` 跳到 Explore › Journal Comparison。

Explore 七项：Semantic Map（`#/explore`）、Theme Browser（`#/explore/themes`）、Topic Lifecycles（`#/explore/topics`）、Journal Comparison（`#/explore/journals`）、Citation Flows（`#/explore/citations`，弦图 / Sankey / 网络三个标签）、Methods Dashboard（`#/explore/methods`）、About（`#/about`，原 Data & Methods，新增“Chapter evidence”一节）。

## 三、逐步对照（74 步）

每行：步骤 ID ｜参考站这一步的画面 ｜本站这一步的画面 ｜本站文案依据的数据。文案中的数字全部在浏览器端从 `data/chapters/*.json` 或已发布论文数据实时计算，数据更新后自动变化。

### 第 1 章（13 步）

| ID | 参考站画面 | 本站画面 | 数据 |
| --- | --- | --- | --- |
| map-hook | 全量地图（2025），粒子 + 主题标签 | 同左 | 论文数、五刊 |
| map-read | 全图保持 | 同左 | 宏观主题数 |
| map-1980 | 滚动回拨到 1980，后来的点消失 | 同左（分段进度：0–22% 停 2025，22–42% 回拨到 1980） | 1980 年篇数；各刊创刊年 |
| map-reform（参考站 map-rbv） | 推进到 1995 前后，增长最快主题出现光晕 | 同左（42–56% 推到 1995；光晕 = 近五年比前五年增量前三的主题） | Comparative Governance and Administrative Reform 份额：1980s→1990s→2000s |
| map-diversify | 推进到 2025，光晕随增量换组 | 同左（56–82%） | 四个后起主题 |
| map-explore | 回到 2025，播放 / 拖动年份 | 同左：卡片内嵌播放键（每 200 毫秒一年）和 1980–2025 滑块 | 主题数 |
| sm-overview | 十张小图均衡显示 | 同左，可切换 % / # | 份额 = 当年主题篇数 ÷ 当年总篇数 |
| sm-decline | 突出资源基础观 | 突出 The Administrative State and Public Management | 1980s 26.9% → 2020–25 2.9% |
| sm-explosive | 突出创新与技术 | 突出 Collaborative Governance and Citizen Participation | 1.6% → 18.6% |
| sm-steady | 突出战略人力资本 | 突出 Public Workforces, Leadership and Representation | 7.1% → 16.5% |
| sm-arrivals | 突出企业社会责任 | 突出 Digital Government and Performance Management | 约 5.6% → 14.0% |
| sm-foundation | 突出组织设计与知识 | 突出 Local Government and Public Service Delivery | 各年代 8.8%–11.7% |
| sm-shift | 同时突出三张卡 | 同时突出 Collaborative Governance、Bureaucratic Discretion、Administrative State | 2020–25 份额对比 |

### 第 2 章（15 步）

| ID | 参考站画面 | 本站画面 | 数据 |
| --- | --- | --- | --- |
| tvp-method | 理论（琥珀）与现象（蓝）两条带阴影曲线，50% 虚线 | 同左；LLM 标签生成前显示“Awaiting data”提示和空坐标 | `ch2_orientation.json` |
| tvp-peak | 理论线突出，2002 虚线标记，右上大字年份 | 同左（峰值年份由数据决定） | 同上 |
| tvp-shift | 现象线突出 | 同左 | 同上 |
| tvp-meaning | 两线恢复 | 同左 | — |
| tt-intro | 六条理论堆叠面积 | 同左：NPM、Principal–Agent、Institutional、Network/NPG、PSM、Public Value | `ch2_theories.json`（摘要提及率，5 年滚动） |
| tt-method | 保持 | 同左 | 规则见 `coding_rules.toml` |
| tt-tce / tt-rbv / tt-dc | 依次突出三条主框架 | 依次突出 NPM（2001 年峰值 8.0%）、委托—代理（1999，1.4%）、制度理论（1997，2.0%） | 同上 |
| tt-peak | 三条一起突出，标 2002 | 三条一起突出，标 1999（合计 10.8%） | 同上 |
| tt-decline | 恢复六条，标 2025 | 同左（合计降到 3.7%） | 同上 |
| ps-intro | 发散条形：前十降、前十升 | 同左（30 个子主题，2008–13 对 2020–25，|变化| ≥ 0.5 个百分点） | `ch2_shifts.json` |
| ps-declining | 只亮负向条 | 同左 | 降幅最大的 4 个子主题 |
| ps-growing | 只亮正向条 | 同左 | 增幅最大的 5 个子主题 |
| ps-punchline | 恢复全部，颜色 = 理论 / 现象 / 混合 | 同左；LLM 标签生成前按升 / 降着色 | 同上 |

### 第 3 章（11 步）

| ID | 参考站画面 | 本站画面 | 数据 |
| --- | --- | --- | --- |
| frag-method | 2×2 四张指标卡同等显示，虚线为线性趋势 | 同左 | `ch3_fragmentation.json` |
| frag-paradigms | 突出有效范式数（1/HHI） | 同左：12.5（1980）→ 24.7（2009）→ 18.1（2025） | 30 个子主题 |
| frag-coherence | 突出语义凝聚度 | 同左：年内两两余弦均值，0.846 → 0.869 | SPECTER2 向量（本地） |
| frag-hhi | 突出 HHI | 同左：前五大子主题份额 45% → 33% | — |
| frag-dispersion | 突出语义离散度 | 同左：到年度质心的平均距离，−8% | SPECTER2 向量 |
| frag-verdict | 四张恢复 | 同左 | — |
| cf-method | 弦图全显示，中心显示跨区 / 区内比例 | 同左 | `ch3_citations.json`（Crossref 参考文献按 DOI 匹配） |
| cf-cross | 保持全图 | 同左 | 跨区比例 |
| cf-rbv | 只亮 RBV 及其弦，中心显示自引 / 出 / 入 | 只亮自引比例最高的主题 | 同上 |
| cf-innovation | 只亮创新与技术 | 只亮跨区往来最多的主题 | 同上 |
| cf-spread | 恢复全图 | 同左（自引率区间） | 同上 |

### 第 4 章（15 步）

| ID | 参考站画面 | 本站画面 | 数据 |
| --- | --- | --- | --- |
| sa-intro | 九种方法堆叠面积 | 同左 | `ch4_methods.json` |
| sa-panel / sa-did / sa-experiment | 依次突出固定效应、双重差分、随机实验（加深轮廓，其余降到 15%） | 顺序按公共行政的实际：随机实验（2025 年 12.8%）→ 面板 / 固定效应 → 双重差分 + 断点 + 自然实验（合计约 2%） | 同上 |
| sa-overall | 恢复全部 | 同左：0.0%（1980）→ 20.5%（2025） | `any_causal` |
| hm-intro | 10 主题 × 9 时期热图 | 同左 | `ch4_heatmap.json` |
| hm-early | 只亮 1980–94 三列 | 同左 | — |
| hm-recent | 只亮 2010–25 三列 | 同左 | — |
| hm-csr | 只亮最高的一行 | 只亮 2020–25 最高主题（Digital Government and Performance Management，36.3%） | — |
| hm-rbv | 只亮最低的一行 | 只亮最低主题（Administrative State，3.3%；排除“Mixed Topics”，且要求 n ≥ 30） | — |
| hm-verdict | 恢复 | 同左 | — |
| dt-intro | 数据来源堆叠面积 | 同左（五类） | `ch4_sources.json` |
| dt-archival | 突出档案 / 二手数据 | 突出调查（公共行政最常见的来源） | — |
| dt-survey | 突出调查 | 同时突出档案 / 行政数据与实验（增长最快） | — |
| dt-verdict | 恢复 | 同左 | — |

### 第 5 章（9 步）

| ID | 参考站画面 | 本站画面 | 数据 |
| --- | --- | --- | --- |
| ps-lamppost | 灰点 + 橙点，虚线同心圆，中心十字 | 同左（灰 = 非因果，橙 = 因果） | `ch5_periphery.json` + `paper_codes.json` |
| ps-noncausal | 只画灰点 | 同左 | — |
| ps-causal | 只画橙点 | 同左 | — |
| ps-both | 两组同画 | 同左 | — |
| ps-distance | 正文给出距离比较 | 同左：因果组离中心略远，p < 0.001，d = 0.20（与参考站方向相反） | Welch t 检验 |
| qi-setup | 双面板箱线图 | 同左；LLM 评分生成前显示提示 | `ch5_importance.json` |
| qi-importance | 只亮左面板 | 同左 | 同上 |
| qi-scope | 只亮右面板 | 同左 | 同上 |
| qi-verdict | 两面板恢复 | 同左 | 同上 |

### 第 6 章（11 步）

| ID | 参考站画面 | 本站画面 | 数据 |
| --- | --- | --- | --- |
| syn-intro | 左侧较宽文字卡，右侧四条线 | 同左 | `ch6_synthesis.json`（5 年滚动） |
| syn-theory | 突出理论线 | 同左；LLM 前该线缺席，正文改用第 2 章理论提及数据 | — |
| syn-phenomenon | 突出现象线 | 同左；LLM 前缺席 | — |
| syn-methods | 突出因果方法线 | 同左 | — |
| syn-coherence | 突出语义凝聚度线 | 同左 | — |
| syn-together | 恢复 | 同左 | — |
| phil-kuhn / phil-lamppost / phil-new-paradigm / phil-trading / phil-stokes | 图不变，只换文字卡 | 同左，五个视角改写为公共行政语境 | — |

## 四、LLM 标签（2026-11-19 已完成）

gpt-4o-mini 对 8,874 篇有摘要的论文逐篇标注了理论 / 现象导向、问题重要性和适用范围（1–10），0 条失败，费用约 0.62 美元。标签文件 `pipeline/data/interim/llm_labels.jsonl` 只留在本机，不进 Git；公开数据只含汇总数。

数据推翻了沿用参考站的几处假设，正文已改为按数据生成：

- 理论导向不是一路下降：1980 年代约 18%，2015 年前后升到约 41% 的峰值，近年回落到约 31%。现象导向始终是多数。
- 第 2 章子领域的“理论 / 现象 / 混合”按全领域基准 ±10 个百分点判定（固定 50% 阈值会把几乎全部子领域判为现象导向）。增长和萎缩的子领域在导向上没有明显差别。
- 因果论文的重要性（7.69 对 7.57，d = 0.22）和适用范围（6.68 对 6.56，d = 0.23）略高。评分基本是整数，箱线图改用均值 ± 0.674 SD 和 ± 1.645 SD，与参考站一致。

重跑方法（密钥只放环境变量）：

```bash
cd pipeline && source .venv/bin/activate
export OPENAI_API_KEY="$(cat ~/path/to/openai_key.txt)"   # 不要写进仓库
python -m pa_map classify               # 已有标签会跳过
python -m pa_map evidence               # 重算全部章节数据
cd ../site && npm run build && node scripts/check-release.mjs dist
```

建议人工抽查约 100 篇的分类结果，把一致率写进 About。

## 五、复现截图对照

```bash
# 参考站：每章逐步截图（需要 Playwright 与 Chrome）
node refsteps.mjs chapters/what-is-strategy chapters/big-theories ...
# 本站：npm run preview 后
node oursteps.mjs 1440 900 chapters/what-is-public-administration chapters/big-theories ...
```

两个脚本都按 `.step` 卡片中心逐一滚动到视口中线再截图，因此两边的第 n 张截图对应同一步。
