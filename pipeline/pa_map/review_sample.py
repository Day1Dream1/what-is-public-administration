"""Stratified sample of LLM-labelled research articles for human review (Excel).

  python -m pa_map review-sample [--seed N]

Draws ~100 eligible research articles (see eligibility.py) from data/interim/llm_labels.jsonl,
stratified by LLM orientation x period, and writes data/review/LLM标签复核_100篇_v2.xlsx.
The sheet contains abstracts: it stays in data/review/ (gitignored) and is never published.
"""
from __future__ import annotations

import collections
import json
import random

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

from .common import INTERIM, REVIEW, read_jsonl
from .eligibility import reasons

OUT_NAME = "LLM标签复核_100篇_v2.xlsx"
PERIODS = ["1980–1999", "2000–2009", "2010–2017", "2018–2025"]


def period(y):
    return "1980–1999" if y < 2000 else "2000–2009" if y < 2010 else "2010–2017" if y < 2018 else "2018–2025"


def run(cfg=None, seed=20261119):
    papers = {p["id"]: p for p in read_jsonl(INTERIM / "papers.jsonl")}
    labels = [L for L in read_jsonl(INTERIM / "llm_labels.jsonl") if L.get("orientation")]
    eligible = [L for L in labels if L["id"] in papers and not reasons(papers[L["id"]])]
    print(f"{len(labels)} labelled records; {len(eligible)} eligible research articles")
    strata = collections.defaultdict(list)
    for L in eligible:
        strata[(L["orientation"], period(papers[L["id"]]["year"]))].append(L)
    rng = random.Random(seed)
    ns, sample = {}, []
    for o in ["theory", "phenomenon"]:
        for per in PERIODS:
            pool = sorted(strata[(o, per)], key=lambda L: L["id"])
            k = min(13 if per != "1980–1999" else 11, len(pool))
            ns[(o, per)] = (k, len(pool))
            for L in rng.sample(pool, k):
                sample.append((L, len(pool) / k))
    rng.shuffle(sample)
    for (o, per), (k, n) in ns.items():
        print(f"  {o:10s} {per}: {k} of {n}")
    _write(sample, papers, len(eligible), seed)


def _write(sample, papers, n_eligible, seed):

    F="Arial"; hdr=Font(name=F,bold=True,color="FFFFFF"); hfill=PatternFill("solid",fgColor="1F3A5F")
    inp=PatternFill("solid",fgColor="FFF2CC"); thin=Side(style="thin",color="BFBFBF"); bd=Border(top=thin,bottom=thin,left=thin,right=thin)
    base=Font(name=F,size=10); wrap=Alignment(wrap_text=True,vertical="top")
    wb=Workbook()

    # --- Sheet 1: instructions
    ws=wb.active; ws.title="说明"
    lines=[("LLM 标签人工复核（约 100 篇）",True),
    ("",False),
    ("目的",True),
    ("检查 gpt-4o-mini 给 8,874 篇摘要打的“理论导向 / 现象导向”标签是否可靠，并粗查重要性与适用范围评分。结果会写进网站 About 页。",False),
    ("",False),
    ("抽样",True),
    (f"只从研究型 article 中抽样：OpenAlex 类型为 article，并排除社论、专刊 / 专题导言、评论与回应、勘误，以及摘要只是作者题名行、参考文献或少于 50 词的记录。符合条件的共 {n_eligible:,} 篇（规则见 pipeline/pa_map/eligibility.py）。",False),
    (f"在其中按 LLM 标签（理论 / 现象）× 时期（1980–1999、2000–2009、2010–2017、2018–2025）分层随机抽取 {len(sample)} 篇，随机种子 {seed}。理论类被有意多抽，所以总体一致率在“汇总”页按抽样权重（W 列）加权。",False),
    ("",False),
    ("复核步骤",True),
    ("1. 打开“复核”页。只读题名和摘要，先不要看“LLM 标签”页（盲评，避免被 LLM 的答案带偏）。",False),
    ("2. 在 H 列（黄色）下拉选择 theory / phenomenon / unsure。判断标准见下方，与给 LLM 的提示词一致。",False),
    ("3. （可选）在 I、J 列给 1–10 分：I = 问题重要性，J = 适用范围。时间不够可以只做 H 列；建议至少做前 30 篇。",False),
    ("4. （可选）在 K 列写备注：例如“摘要太短难判断”“理论只是点缀”“两者都很强”。",False),
    ("5. 全部做完后再打开“汇总”页：一致率、Cohen's κ、评分差距会自动算出。“不一致清单”需要你在“复核”页 L 列看完后填写：打开“LLM 标签”页对照不一致的篇目，在 L 列选 我对 / LLM对 / 都说得通。",False),
    ("6. 保存文件，把整个 Excel 发回给我（或告诉我它在你电脑上的位置）。我会把一致率和主要分歧写进 About，必要时调整提示词重跑。",False),
    ("",False),
    ("判断标准（与提示词相同）",True),
    ("theory：文章主要围绕发展、扩展或检验一个一般性理论框架或概念（如委托代理理论、制度理论、公共服务动机理论），经验场景主要服务于理论。",False),
    ("phenomenon：文章从一个现实问题、政策、改革、实践或场景出发（如预算危机、数字服务、招聘规则），理论主要是用来解释它的工具。",False),
    ("unsure：两者分不出哪个更好（LLM 被要求必须二选一，所以 unsure 计入“汇总”页的单独一行，不计入一致率）。",False),
    ("重要性 1–10：这个研究问题对公共行政学术与实践有多重要（1 = 微不足道，10 = 头等重要）。",False),
    ("适用范围 1–10：问题和答案能推广到所研究的个案、国家或组织之外多远（1 = 非常窄，10 = 非常一般）。",False),
    ("",False),
    ("填写约定",True),
    ("黄色单元格 = 你填写的地方；其他单元格不要改。第 2 行（灰色斜体）是填写示例，不计入统计。",False),
    ("此文件含论文摘要，请保留在本机（例如 pipeline/data/review/），不要提交到 GitHub。",False)]
    for i,(t,b) in enumerate(lines,1):
        c=ws.cell(row=i,column=1,value=t); c.font=Font(name=F,bold=b,size=14 if i==1 else 11); c.alignment=Alignment(wrap_text=True,vertical="top")
    ws.column_dimensions["A"].width=110

    # --- Sheet 2: review
    rv=wb.create_sheet("复核")
    cols=["序号","论文 ID","年份","时期","期刊","题名","摘要","你的判断\n(theory/phenomenon/unsure)","重要性\n1–10","适用范围\n1–10","备注","看完 LLM 后：谁对？","抽样权重 W"]
    widths=[6,13,6,11,8,38,90,16,9,9,24,14,9]
    for j,(h,w) in enumerate(zip(cols,widths),1):
        c=rv.cell(row=1,column=j,value=h); c.font=hdr; c.fill=hfill; c.alignment=Alignment(wrap_text=True,vertical="center",horizontal="center"); c.border=bd
        rv.column_dimensions[c.column_letter].width=w
    rv.row_dimensions[1].height=42
    # example row
    ex=["例","(示例)","2016","2010–2017","PAR","Does performance pay motivate public employees? Evidence from …","(示例行：读摘要后在右侧黄色格子里选择或填写)","theory",8,6,"以 PSM 理论为主线","LLM对",""]
    for j,v in enumerate(ex,1):
        c=rv.cell(row=2,column=j,value=v); c.font=Font(name=F,size=10,italic=True,color="808080"); c.alignment=wrap; c.border=bd
    lab=wb.create_sheet("LLM 标签")
    for j,h in enumerate(["序号","论文 ID","LLM 判断","LLM 重要性","LLM 适用范围"],1):
        c=lab.cell(row=1,column=j,value=h); c.font=hdr; c.fill=hfill; c.border=bd
        lab.column_dimensions[c.column_letter].width=[6,13,14,12,12][j-1]
    first=3
    for i,(L,w) in enumerate(sample):
        r=first+i; p=papers[L["id"]]
        vals=[i+1,L["id"],str(p["year"]),period(p["year"]),p["journal"],p["title"],p["abstract"],None,None,None,None,None,round(w,3)]
        for j,v in enumerate(vals,1):
            c=rv.cell(row=r,column=j,value=v); c.font=base; c.alignment=wrap; c.border=bd
            if j in (8,9,10,11,12): c.fill=inp
        rv.row_dimensions[r].height=max(60,min(300,15*(len(p["abstract"])//150+1)))
        for j,v in enumerate([i+1,L["id"],L["orientation"],L["importance"],L["scope"]],1):
            c=lab.cell(row=r-1,column=j,value=v); c.font=base; c.border=bd
    last=first+len(sample)-1
    rv.freeze_panes="H3"
    dv=DataValidation(type="list",formula1='"theory,phenomenon,unsure"',allow_blank=True); rv.add_data_validation(dv); dv.add(f"H{first}:H{last}")
    dv2=DataValidation(type="whole",operator="between",formula1="1",formula2="10",allow_blank=True,error="请输入 1–10 的整数"); rv.add_data_validation(dv2); dv2.add(f"I{first}:J{last}")
    dv3=DataValidation(type="list",formula1='"我对,LLM对,都说得通"',allow_blank=True); rv.add_data_validation(dv3); dv3.add(f"L{first}:L{last}")
    rv["M1"].comment=Comment("该层总体篇数 / 该层抽样篇数，用于把样本一致率还原为总体一致率。","Claude")
    lab["A1"].comment=Comment("请在“复核”页 H 列全部判断完之后再看这一页。行顺序与“复核”页一致（复核第 3 行 = 本页第 2 行）。","Claude")

    # --- Summary
    sm=wb.create_sheet("汇总",1)
    H=f"复核!$H${first}:$H${last}"; I=f"复核!$I${first}:$I${last}"; J=f"复核!$J${first}:$J${last}"; W=f"复核!$M${first}:$M${last}"
    LO=f"'LLM 标签'!$C$2:$C${last-1}"; LI=f"'LLM 标签'!$D$2:$D${last-1}"; LS=f"'LLM 标签'!$E$2:$E${last-1}"; Lw=f"复核!$L${first}:$L${last}"
    dec=f'(({H}="theory")+({H}="phenomenon"))'
    rows=[("理论 / 现象导向",None,None),
    ("已判断篇数（不含 unsure）",f"=SUMPRODUCT({dec}*1)","0"),
    ("标为 unsure 的篇数",f'=COUNTIF({H},"unsure")',"0"),
    ("一致篇数",f"=SUMPRODUCT({dec}*({H}={LO}))","0"),
    ("样本一致率",f"=IFERROR(B5/B3,\"\")","0.0%"),
    ("加权一致率（还原到全部符合条件的 article）",f"=IFERROR(SUMPRODUCT({dec}*({H}={LO})*{W})/SUMPRODUCT({dec}*{W}),\"\")","0.0%"),
    ("LLM = theory 时你也判 theory 的比例（精确率）",f'=IFERROR(SUMPRODUCT(({LO}="theory")*({H}="theory"))/SUMPRODUCT(({LO}="theory")*{dec}),"")',"0.0%"),
    ("LLM = phenomenon 时你也判 phenomenon 的比例",f'=IFERROR(SUMPRODUCT(({LO}="phenomenon")*({H}="phenomenon"))/SUMPRODUCT(({LO}="phenomenon")*{dec}),"")',"0.0%"),
    ("期望偶然一致率 pe",f'=IFERROR((SUMPRODUCT(({H}="theory")*1)*SUMPRODUCT(({LO}="theory")*{dec})+SUMPRODUCT(({H}="phenomenon")*1)*SUMPRODUCT(({LO}="phenomenon")*{dec}))/B3^2,"")',"0.000"),
    ("Cohen's κ（样本）",f'=IFERROR((B6-B10)/(1-B10),"")',"0.00"),
    ("",None,None),
    ("评分（只统计你填了分的篇目）",None,None),
    ("重要性：已评篇数",f"=COUNT({I})","0"),
    ("重要性：平均绝对差",f"=IFERROR(SUMPRODUCT(({I}<>\"\")*ABS({I}-{LI}))/B14,\"\")","0.00"),
    ("重要性：相差 ≤1 分的比例",f"=IFERROR(SUMPRODUCT(({I}<>\"\")*(ABS({I}-{LI})<=1))/B14,\"\")","0.0%"),
    ("重要性：你的均分 / LLM 均分",f"=IFERROR(TEXT(AVERAGE({I}),\"0.00\")&\" / \"&TEXT(SUMPRODUCT(({I}<>\"\")*{LI})/B14,\"0.00\"),\"\")",None),
    ("适用范围：已评篇数",f"=COUNT({J})","0"),
    ("适用范围：平均绝对差",f"=IFERROR(SUMPRODUCT(({J}<>\"\")*ABS({J}-{LS}))/B18,\"\")","0.00"),
    ("适用范围：相差 ≤1 分的比例",f"=IFERROR(SUMPRODUCT(({J}<>\"\")*(ABS({J}-{LS})<=1))/B18,\"\")","0.0%"),
    ("适用范围：你的均分 / LLM 均分",f"=IFERROR(TEXT(AVERAGE({J}),\"0.00\")&\" / \"&TEXT(SUMPRODUCT(({J}<>\"\")*{LS})/B18,\"0.00\"),\"\")",None),
    ("",None,None),
    ("不一致篇目的复盘（复核页 L 列）",None,None),
    ("不一致篇数",f"=B3-B5","0"),
    ("其中“我对”",f'=COUNTIF({Lw},"我对")',"0"),
    ("其中“LLM对”",f'=COUNTIF({Lw},"LLM对")',"0"),
    ("其中“都说得通”",f'=COUNTIF({Lw},"都说得通")',"0")]
    sm.column_dimensions["A"].width=46; sm.column_dimensions["B"].width=16
    sm["A1"]="复核结果（自动计算，勿改）"; sm["A1"].font=Font(name=F,bold=True,size=14)
    for i,(a,b,fmt) in enumerate(rows,2):
        ca=sm.cell(row=i,column=1,value=a); cb=sm.cell(row=i,column=2,value=b)
        ca.font=Font(name=F,bold=b is None and a!="",size=11); cb.font=Font(name=F,size=11)
        if fmt: cb.number_format=fmt
    sm["A29"]="参考：κ ≥ 0.6 通常视为较好一致，0.4–0.6 为中等。"; sm["A29"].font=Font(name=F,italic=True,size=10,color="808080")
    out = REVIEW / OUT_NAME
    wb.save(out)
    print(f"Wrote {out}")
