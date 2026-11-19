# What Is Strategy? — reference audit of Chapters 1–3

Audit date: 19 November 2026. The order and count below follow the chapter routes and their delivered client components. The homepage has additional material. Step descriptions are paraphrased, and the step identifiers name the corresponding public client states. Counts or findings attributed to the site describe its strategy corpus. [Reference site](https://whatisstrategy.org/) · [Project methods](https://whatisstrategy.org/about) · [Working paper](https://whatisstrategy.org/what_is_strategy.pdf)

| Route | Sticky sections in reading order | Steps | Main visual mechanism |
| --- | --- | ---: | --- |
| [1 · Field evolution](https://whatisstrategy.org/chapters/what-is-strategy) | Semantic map → theme trajectories | 6 + 7 = 13 | Animated paper particles on a fixed projection, then small-multiple charts |
| [2 · Grand theory](https://whatisstrategy.org/chapters/big-theories) | Theory vs. phenomenon → theory trajectories → growing/declining sub-areas | 4 + 7 + 4 = 15 | Series emphasis, year markers, and diverging bar emphasis |
| [3 · Fragmentation](https://whatisstrategy.org/chapters/fracturing) | Fragmentation metrics → thematic citation flows | 6 + 5 = 11 | Small-multiple emphasis, then a circular citation network |

All three chapters use a chapter hero, a persistent visualization beside or behind sequential notes, linking text between visual sections, and navigation at the end. The shared client chooses the text block nearest the viewport midpoint and updates section progress as the reader scrolls. On wide screens the graphic has an overlaid left text column with active-step indicators. On narrow screens text runs in full-width cards over a sticky graphic. Counts here describe distinct narrative notes and count the two responsive renderings once. Interaction details below are verified from the delivered client code. Touch and keyboard behavior were not exercised in a live browser. Asset URLs record the audited build and may change on deployment. [Chapter 1 client](https://whatisstrategy.org/_next/static/chunks/b180a0a1cd321c16.js) · [Chapter 2 client](https://whatisstrategy.org/_next/static/chunks/96b3ffb6e827f9ed.js) · [Chapter 3 client](https://whatisstrategy.org/_next/static/chunks/f96017a6129c288b.js)

## Chapter 1 · What is strategy — and how has the field evolved?

The hero introduces an abstract-based map and shows the loaded paper count, 10 macro themes, 50 subtopics, and an elapsed span of 45 years. The subtitle cites 6,550 abstracts. The data file holds 6,550 rows across five journals, but the client keeps 6,374 with nonblank titles. The year keys 1980–2025 cover 46 publication years inclusively. The chapter ends after the trajectories and footer. The stacked macro-theme and subtopic views are on the homepage. [Chapter 1](https://whatisstrategy.org/chapters/what-is-strategy) · [Chapter 1 client](https://whatisstrategy.org/_next/static/chunks/b180a0a1cd321c16.js) · [Field-map data](https://whatisstrategy.org/data/combined_strategy_field_map.json) · [Homepage](https://whatisstrategy.org/)

### Semantic Map of the Field · 6 steps

| Step | Narrative | Highlight, visual change, or interaction |
| --- | --- | --- |
| 1 · `map-hook` | Five journals and abstract embeddings define the study corpus. | Opens on the full 2025 view with paper particles and macro-theme labels. |
| 2 · `map-read` | A dot is a paper. Nearby papers have similar abstracts, and color identifies a broad theme. | Continues the full-map reading state as the initial scroll interval ends. The subsequent rewind uses the same scale and coordinates. |
| 3 · `map-1980` | The initial years yield about 30 papers per year. The displayed data include 31 in 1980. | Scroll brings the cumulative map back to 1980. Later papers disappear. Earlier dots keep their locations even as label positions adjust. |
| 4 · `map-rbv` | The article highlights the rise of the Resource-Based View and later prominence of work on corporate risk. | Cumulative years advance through the early era. A rolling-growth glow is active. The chapter does not pin a named theme in either this step or the following step. |
| 5 · `map-diversify` | Innovation, strategic human capital, CSR and alliances illustrate subsequent diversification. | The cumulative map advances toward 2025. Recently growing themes get halos as additional papers appear. |
| 6 · `map-explore` | The present map introduces all ten groupings and lets the reader replay the record. | Entering resets to 2025 and pauses. Play/Pause advances one year about every 200 ms and starts from 1980 when played from the end. A 1980–2025 range control selects a year and pauses playback. |

The canvas uses one set of precomputed UMAP coordinates and scales against the full corpus. Section progress holds 2025 for roughly the first fifth, rewinds to 1980, then runs forward through 1995 and back to 2025. The subset is cumulative through the displayed year. New dots fade and grow at their coordinates over about one second, outgoing dots disappear, and labels glide between centroids of the papers currently visible. From the end of rewind onward, growth scores compare counts in the current five-year window with the previous five years. The highest-ranked themes receive halos on wider canvases. The story itself has no clustering recomputation, animated paper relocation, or theme-specific zoom. Pointer hover on a paper shows title, abbreviated authors, year and macro theme. This chapter supplies no paper-click action, map-only drag/zoom controls, or filter panel. [Chapter 1 client](https://whatisstrategy.org/_next/static/chunks/b180a0a1cd321c16.js) · [Methods](https://whatisstrategy.org/about)

### Research Themes: Individual Trajectories · 7 steps

| Step | Narrative | Highlight or transition |
| --- | --- | --- |
| 1 · `sm-overview` | Read a theme's annual share against all displayed strategy papers for that year. | All ten trend cards are evenly visible. |
| 2 · `sm-decline` | Resource-based research receded from a dominant position to a small recent share. | Highlights Resource-Based View and dims the other cards. |
| 3 · `sm-explosive` | Innovation research rose from a small early share to a large recent one. | Highlights Innovation & Technology. |
| 4 · `sm-steady` | Human-capital research gained share across the period. | Highlights Strategic Human Capital. |
| 5 · `sm-arrivals` | CSR was rare in early years, then grew after 2000. | Highlights Corporate Social Responsibility. |
| 6 · `sm-foundation` | Organizational design and knowledge research has a substantial, persistent presence. | Highlights Organizational Design & Knowledge. |
| 7 · `sm-shift` | Recent CSR and human-capital shares exceed the resource-based share. | Highlights Corporate Social Responsibility, Strategic Human Capital and Resource-Based View together. |

The section changes visual form from particles to trend charts. Ten independent line/area charts use a common scale, sort by total papers and show a peak dot. Desktop cards show the total, trend marker and peak annotation, respond to hover at card level, and offer a global share/count toggle. The compact mobile renderer uses ten miniatures in a 2-by-5 grid, with shortened labels and no equivalent toggle in the audited component. Selecting a step highlights a card or group and fades the others in place. There is no linked map update. [Chapter 1](https://whatisstrategy.org/chapters/what-is-strategy) · [Chapter 1 client](https://whatisstrategy.org/_next/static/chunks/b180a0a1cd321c16.js)

## Chapter 2 · The decline of grand theory

The hero presents the author's shift-to-phenomena argument and a recent value of about 65% phenomenon-oriented. The hero's hard-coded count is 6,550 classified. The first section's note and classification file use 6,928. Named theory mentions use a separate preparation with 9,957 abstracts and a research sample of 6,925 in its metadata. The third section covers 50 sub-areas, with up to ten large movers shown on each side. The three quantities answer different questions: primary orientation, explicit theory mention, and change in topic share. The chapter contains three charts and no semantic-map or particle state. [Chapter 2](https://whatisstrategy.org/chapters/big-theories) · [Chapter 2 client](https://whatisstrategy.org/_next/static/chunks/96b3ffb6e827f9ed.js) · [Classification data](https://whatisstrategy.org/data/theory_phenomenon_llm.json) · [Theory mentions data](https://whatisstrategy.org/data/fragmentation_comprehensive.json) · [Sub-area shifts data](https://whatisstrategy.org/data/phenomena_vs_theory_shifts.json)

### Theory vs. Phenomenon · 4 steps

| Step | Narrative | Highlight or transition |
| --- | --- | --- |
| 1 · `tvp-method` | GPT-4o-mini assigned a primary orientation from each abstract. The chart smooths annual label shares over three years. | Both shaded trend lines are visible. |
| 2 · `tvp-peak` | The author describes an early-2000s peak of roughly 52% for theory-oriented work. | Amber theory series stays prominent, blue is dimmed, and a dashed 2002 marker and animated year appear. |
| 3 · `tvp-shift` | The phenomenon-oriented share has reached roughly two-thirds. | Blue phenomenon series is emphasized. Amber dims and the year marker is cleared. |
| 4 · `tvp-meaning` | The chapter interprets the shift as proceeding more often from empirical settings, illustrated by platforms, CEO succession and CSR. | Both series are restored for comparison. |

The chart uses a centered rolling mean over available adjacent annual percentages, with a shorter window at dataset edges. A hover tooltip reports both series for the selected year. The plot includes a 50% guide and has no year slider. The smoothed theory series peaks at 52.3% in 2002, alongside an unsmoothed 2003 source observation of 59.5%. The smoothed phenomenon share averages 65.4% across 2020–2025 and reaches 69.7% at the 2025 endpoint. [Chapter 2 client](https://whatisstrategy.org/_next/static/chunks/96b3ffb6e827f9ed.js) · [Classification data](https://whatisstrategy.org/data/theory_phenomenon_llm.json)

### Theory Trajectories · 7 steps

| Step | Narrative | Highlight or transition |
| --- | --- | --- |
| 1 · `tt-intro` | The chapter asks which major frameworks previously organized the research. | All six colored theory series appear. |
| 2 · `tt-method` | Explicit named-theory mentions in abstracts are counted and displayed with a five-year smoothing window. | All series remain in view. |
| 3 · `tt-tce` | Transaction Cost Economics treats the boundary of the firm as a question of whether to make or buy. | Highlights Transaction Cost Economics. |
| 4 · `tt-rbv` | The Resource-Based View explains differences among firms through valuable, scarce and hard-to-copy resources. | Highlights RBV. |
| 5 · `tt-dc` | Dynamic Capabilities asks how firms renew and rearrange those resources. | Highlights Dynamic Capabilities. |
| 6 · `tt-peak` | The three frameworks together mattered substantially in the 1990s and early 2000s. | Highlights all three featured series and marks 2002. |
| 7 · `tt-decline` | Their prevalence diminished, with no new framework reaching a comparable position in the author's account. | Restores all six series and marks the 2025 endpoint. |

The six stacked area series are RBV, Dynamic Capabilities, Transaction Cost Economics, Agency Theory, Institutional Theory and Absorptive Capacity. The hover tooltip formats smoothed prevalence or approximate paper counts according to the `% / #` toggle. The count presentation derives counts from the mention rates and the client’s annual corpus counts before smoothing. A paper can contribute to several named series. Indicators for 2002 and 2025 are step states. A reader does not scrub calendar years with a range input. [Chapter 2 client](https://whatisstrategy.org/_next/static/chunks/96b3ffb6e827f9ed.js) · [Theory mentions data](https://whatisstrategy.org/data/fragmentation_comprehensive.json)

### Growing vs. Declining Sub-Areas · 4 steps

| Step | Narrative | Highlight or transition |
| --- | --- | --- |
| 1 · `ps-intro` | Compares each topic's share in 2008–2013 and 2020–2025 across a 50-topic analysis. | Diverging horizontal bars show the ten strongest eligible declines and ten strongest eligible gains. |
| 2 · `ps-declining` | The text calls attention to theory-linked declines such as Dynamic Capabilities, Transaction Cost Economics and Resource-Based themes. | Emphasizes all negative bars and dims all positive bars, regardless of orientation. |
| 3 · `ps-growing` | The text calls attention to growth in entrepreneurship, platforms, CSR, gender and governance, and nonmarket strategy. | Emphasizes all positive bars and dims all negative bars. |
| 4 · `ps-punchline` | The chapter treats the comparison as suggestive evidence of a broader change in research orientation. | Restores both sides to compare direction and orientation together. |

Bar length and side encode percentage-point change. Color encodes theory-driven, phenomenon-driven or mixed orientation. A bar's hover detail includes period shares, change, orientation and available key topics. The provided summary has 11 growing and 11 declining topics, with 28 stable. In the source categories, nine growing topics are phenomenon-oriented and two mixed. Among declining topics, three are theory-oriented, four phenomenon-oriented and four mixed. The highlighted theory examples do not describe every decreasing topic. [Chapter 2 client](https://whatisstrategy.org/_next/static/chunks/96b3ffb6e827f9ed.js) · [Sub-area shifts data](https://whatisstrategy.org/data/phenomena_vs_theory_shifts.json)

## Chapter 3 · Diversity without fragmentation

The hero raises a question about communication across a more varied field, displays 6,374 titled map records, and computes a 52% cross-area citation figure. The first section loads a separate fragmentation asset documenting a sample of 6,925 and plots four of its metrics. The second uses an aggregate citation network. The circular graphic is a theme-level network, with no paper coordinates or particle chronology. [Chapter 3](https://whatisstrategy.org/chapters/fracturing) · [Chapter 3 client](https://whatisstrategy.org/_next/static/chunks/f96017a6129c288b.js) · [Fragmentation data](https://whatisstrategy.org/data/fragmentation_metrics.json) · [Citation data](https://whatisstrategy.org/data/combined_citation_network.json)

### Measuring Fragmentation · 6 steps

| Step | Narrative | Highlight or transition |
| --- | --- | --- |
| 1 · `frag-method` | If strategy became more topically varied, did its research groups become isolated? The study tracks the distribution across 50 clusters. | Four annual metric charts appear at equal prominence. |
| 2 · `frag-paradigms` | The inverse concentration measure grew from about 7 effective clusters in 1980 to just over 40 by 2013. | Highlights Effective Paradigms and dims the other three cards. |
| 3 · `frag-coherence` | Semantic similarity within publication years weakened during expansion, then stabilized. | Highlights Semantic Coherence. |
| 4 · `frag-hhi` | Topic concentration fell. The narration illustrates it with a reported decline in the top five topics' combined share, from 63% in the early 1980s to 24% in the 2020s. | Highlights Concentration (HHI). HHI is the sum of squared topic shares, a different statistic from the narration's top-five share. |
| 5 · `frag-dispersion` | The field spread out in the 1980s. The author characterizes later dispersion as broadly stable. | Highlights Semantic Dispersion. The chart's methodology identifies it as mean Euclidean distance to each year's centroid in three-dimensional UMAP space. |
| 6 · `frag-verdict` | Topical variety and intellectual isolation are separate claims. The chapter summarizes the evidence for topical variety with relatively stable coherence. | Restores the four metrics to equal prominence. |

Each card uses its own y-axis, showing an observed series and dashed linear trend when available. Effective Paradigms equals `1 / HHI`, so those two cards express the same concentration signal in different units. The compact chapter version omits the standalone component's expandable methodology panel. The metric charts have no verified manual hover selection or scrubber. The recorded effective-cluster series reaches 40.1 in 2013 and 20.5 in 2025. A rise to the 2013 observation is compatible with a later fall. The supplied annual metrics expose the largest single cluster's share. The top-five percentages in step 4 are attributed to the narrative and cannot be recreated from that metric file alone. [Chapter 3 client](https://whatisstrategy.org/_next/static/chunks/f96017a6129c288b.js) · [Fragmentation data](https://whatisstrategy.org/data/fragmentation_metrics.json)

### Citation Flow Between Research Areas · 5 steps

| Step | Narrative | Highlight or transition |
| --- | --- | --- |
| 1 · `cf-method` | OpenAlex links are aggregated from fine clusters to ten thematic groups. Chords connect themes, and inner arcs represent within-theme citations. | Shows the whole network. |
| 2 · `cf-cross` | The share crossing theme boundaries is used to discuss whether ideas move between groups. | No theme is forced. The aggregate percentage balance appears at the center when no theme is hovered. |
| 3 · `cf-rbv` | RBV has the highest share of outgoing citations that stay within its theme, about 55%. The narration also presents it as especially influential. | Highlights the RBV arc and connected chords and dims unrelated marks. Center labels show the selected theme's outgoing and incoming links and within-theme percentage. |
| 4 · `cf-innovation` | Innovation & Technology exchanges citations with most other themes and has fairly similar inflows and outflows. | Applies the same isolation to Innovation & Technology. |
| 5 · `cf-spread` | The author places the themes' outgoing within-area shares between 36% and 55% and interprets them as evidence of external exchange. | Clears the prescribed focus for a whole-network view. |

Outer arcs represent each theme's outgoing volume, and inner arcs represent its within-theme volume. Chord width reflects the count of inter-theme citations. On the compact canvas a pointer over a theme's perimeter highlights its connections and updates center figures, unless a scroll step already prescribes one of the two themes. Moving away clears the pointer focus. The chapter uses the compact canvas without the standalone renderer’s sidebar. Pointer hover and scroll emphasis are its only interaction modes. The citation aggregation spans the source network throughout the sequence. [Chapter 3 client](https://whatisstrategy.org/_next/static/chunks/f96017a6129c288b.js)

Recomputing from the delivered cluster flows and cluster-to-theme lookup yields 7,070 cross-theme and 6,526 within-theme links among the 13,596 eligible displayed edges. The computed majority is cross-theme, even though the note beside it calls within-theme citations a majority. The RBV within-theme share of 55% holds. The claim that RBV attracts the most cross-theme citations is unsupported by the displayed edges, where Strategic Alliances & Networks has 1,148 incoming cross-theme citations and RBV has 881. Innovation & Technology has 646 outgoing and 733 incoming cross-theme citations. Within-area means papers share a theme, with no assumption about shared authors. The supplied citation file reports 23,534 internal citations in a broader network, and ships 500 aggregate cluster-flow rows. These totals describe different stages of data selection. [Chapter 3 client](https://whatisstrategy.org/_next/static/chunks/f96017a6129c288b.js) · [Citation data](https://whatisstrategy.org/data/combined_citation_network.json) · [Cluster-to-theme lookup source](https://whatisstrategy.org/data/combined_strategy_field_map.json)

## Implications for the public administration build

- Use a shared step controller with two distinct contracts. A map step changes the cumulative time window or emphasis on precomputed points. A chart step changes the series, card, year marker or network relationships brought forward. The chapter transitions work because the graphic directly answers the note beside it.
- Use one public-data version to drive every chapter hero and visual where feasible. Attach sample size and denominator to the graphic whenever eligibility, availability or citation matching changes the input. Validate every narrated value against the data shipped to that route.
- Give the map explicit cumulative-year wording and use annual shares or period-specific filters for comparisons of thematic attention. Give playback a pause state and provide step links and an accessible paper list. Numbers about PA topics, research orientation or citation connectivity require their own verified evidence.
