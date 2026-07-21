# Research Notebook — Novel Heuristics for Max-Cut

**Started:** 2026-07-21
**Goal:** Discover experimentally validated improvements over strong Max-Cut heuristics on standard benchmarks (G-set), or produce rigorous negative results.

---

## 1. Problem & state of the art (brief survey)

**Problem.** Given weighted graph G=(V,E,w), partition V into two sets maximizing total
weight of crossing edges. NP-hard; best poly-time approximation is Goemans–Williamson
SDP rounding (0.878), optimal under UGC. In practice, metaheuristics dominate on
benchmarks.

**Best practical algorithms (literature):**
- **Tabu search on UBQP/Max-Cut** (Glover; Kochenberger et al.): flip moves with
  incremental gains, tabu tenure, aspiration. Backbone of most top methods.
- **Breakout Local Search (BLS)** (Benlic & Hao 2013): local optima + adaptive
  perturbation (directed/random jumps sized by stagnation).
- **MOH / multiple operator heuristics** (Ma & Hao 2017): flip + swap operators, pool.
- **TSHEA / hybrid evolutionary** (Wu, Wang, Lü): crossover + tabu search; among
  best-known-value setters on G-set.
- **Physics-inspired**: simulated bifurcation, discrete Ising machines; strong on
  dense instances, typically need GPUs.

**Benchmarks:** G-set (G1–G81, n=800–20000; random / toroidal / almost-planar
families, weights ±1 or 1). Best-known values stable for a decade; matching them
at all is respectable, beating time-to-target of tabu search is a realistic win.

**Known weaknesses of SOTA (attack surface):**
1. Plateau navigation on ±1 toroidal graphs (G11, G32…): huge gain-tie degeneracy;
   tie-breaking is essentially random in published methods.
2. Perturbation size in BLS is adapted from stagnation counters only — ignores
   structure of *which* vertices are unstable.
3. All methods restart/perturb blind to consensus structure across elite solutions
   (backbone-style info is used in SAT, rarely in Max-Cut local search).
4. Initialization is random in all top local-search codes; spectral information is
   cheap and unused.

## 2. Hypotheses (to be tested)

- **H1 (calibration, not a hypothesis):** Our C tabu search baseline reaches
  within ~0.1–0.3% of best-known values on midsize G-set in ≤60 s/instance.
  Prereq for everything else.
- **H2 (spectral init):** Initializing from sign pattern of leading eigenvector
  of a signed/shifted adjacency improves mean cut under fixed small budgets vs
  random init; effect shrinks as budget grows.
- **H3 (second-order tie-breaking):** On tie-degenerate instances (toroidal ±1),
  breaking gain ties by a cheap 1-step lookahead score (sum of positive neighbor
  gains after the flip) beats random tie-breaking at equal wall-clock.
- **H4 (consensus freezing / self-kernelization):** Freezing vertices that agree
  across recent elite local optima (and rarely flip) shrinks the effective
  neighborhood; periodic unfreezing preserves correctness of search. Expect wins
  on large sparse instances (G55, G63).
- **H5 (penalty-based diversification):** Per-vertex adaptive penalties (SAPS-like,
  from SAT) as replacement for tabu tenure.

## 3. Experimental protocol

- Solvers in C (single file per family), -O2, single-thread per run; harness runs
  4 parallel single-thread runs (4 cores).
- Each comparison: ≥10 seeds per (instance, algo), fixed wall-clock budget,
  metrics = best cut, mean cut, time-to-target. Paired per-seed comparisons;
  Wilcoxon signed-rank when in doubt.
- Every solver self-verifies its incremental cut against recomputation
  (`verified: true` in output) — no unverified numbers enter this notebook.
- Results in `research/results/*.jsonl`, raw and append-only.

## 4. Experiment log

### EXP-001: Baseline tabu search calibration
- **Status:** running
- **Setup:** ts on 19 instances (incl. toroidals G12,G13,G33,G34), 5 seeds × 30 s,
  4 parallel jobs. Output: results/exp001_calibration.jsonl.
- **Hypothesis:** H1.
- **Implementation notes:** baseline verified by coding agent: selftest PASS
  (10k flips, incremental vs recomputed cut agree; gains brute-force checked);
  G1 seed1/10s → 11624 (= best-known); G11 seed1/5s → 560/564.
  Throughput ~580K iters/s (G11, deg≈4), ~430K iters/s (G1, deg≈48).
- **Results:** PASS. All 95 runs verified:true. 30 s × 5 seeds:
  best-known MATCHED on G1, G6, G11, G18, G43, G47, G50 (8/19). Gaps:
  toroidal n=800 ≤0.7%; toroidal n=2000 (G32/33/34) 1.0–1.4%; G36 1.6%;
  **G39 5.6% (outlier)**; G55 3.1%; G63 1.8%; dense random all 0%.
- **Conclusions:** Baseline is publication-credible for A/B work. Weakness
  concentrated on (a) tie-degenerate toroidal graphs, (b) large sparse
  graphs, (c) G39-type almost-planar ±1 — restarts appear too destructive
  there (hypothesis: best-quality basins need longer convergence than the
  300k-iteration stagnation window allows). These are the target instances
  for H3/H4/H6.

### EXP-004: ts vs ts2 head-to-head (H3)
- **Status:** DONE — **H3 FALSIFIED (useful negative result)**
- **Setup:** maxcut2 binary, 13 instances, 10 seeds, 60 s, paired by seed.
  260/260 runs verified.
- **Results:** No instance shows a significant ts2 win (all Wilcoxon p≥0.09).
  Trend NEGATIVE on toroidal n=2000: G32 mean −3.8 (p=0.11), G33 −1.4
  (p=0.09). Flat elsewhere (G43 all-ties at 6660; G63 +8.2 p=0.26 n.s.).
- **Conclusions:** Even though >99.9% of moves are gain-tied on toroidal
  graphs, greedy 1-step-lookahead tie-breaking does NOT help and trends
  harmful: it biases plateau walks and cuts throughput ~19%. Random
  tie-breaking is doing genuine diversification work. → New hypothesis
  **H3b**: age-based (least-recently-flipped) tie-breaking, the SAT
  novelty-style mechanism, near-zero overhead ("tsa", EXP-007).

### EXP-005: spectral init at 5 s budget (H2)
- **Status:** DONE — **H2 CONFIRMED, effect much larger than hypothesized**
- **Setup:** ts vs ts@spectral, 7 instances, 10 seeds, 5 s. 140/140 verified.
- **Results (mean over 10 seeds):**
  G55 10080 vs 9926 (+154); G63 26576 vs 26496 (+80); G39 2282 vs 2218
  (+63); G36 7552 vs 7535 (+17); G27 +11; G22 +6; G14 −1.
  **Spectral@5s beats random@60s** (EXP-004 ts means) on G55 (10080>9957),
  G63 (26576>26549), G39 (2282>2264): a >12× wall-clock equivalent.
- **Conclusions:** On large sparse (G55,G63) and almost-planar ±1 (G36,G39)
  instances, tabu search's weakness is dominated by the initial basin, not
  by search dynamics: power iteration (~ms) drops the search into a far
  better basin than 60 s of restarts finds. Explains the G39 calibration
  outlier. No effect on dense random / small toroidal (search-limited, not
  init-limited). Follow-up in EXP-006: does the advantage persist at 60 s,
  and does it compose with icm?

### EXP-006: ts vs ts@spectral vs tsf vs icm vs icm@spectral, 60 s (H2/H4/H6)
- **Status:** running (~100 min)
- **Setup:** maxcut3 binary, {G11,G22,G32,G33,G36,G39,G55,G63}, 10 seeds,
  60 s, 4 jobs → 400 runs.
- **Results:** (pending)

### EXP-007: tsa age tie-breaking (H3b) — implementation
- **Status:** delegated (maxcut4.c)
- **Results:** (pending)

### EXP-002: ts2 (H3 tie-breaking) + spectral init (H2) — implementation
- **Status:** implemented & verified (maxcut2.c). Benchmark pending.
- ts2 = identical to ts except gain-ties broken by score2 = Σ max(0, post-flip
  neighbor gain); spectral init = power iteration on cI−W, sign rounding,
  10% random flips at restarts. New JSON fields: tie_iters, score2_evals,
  init_cut.
- **Implementation findings:** ts path in maxcut2 bit-identical to baseline
  (G1 seed7: 11606 == 11606). On G11, 99.98% of iterations have >1 gain-tied
  candidate — tie degeneracy on toroidal ±1 graphs is near-total, so
  tie-breaking policy is effectively THE move-selection policy there. ts2
  overhead ~19% iters/s. Spectral init_cut on G14: 2668 vs 2410 random (+11%);
  on G11 init_cut 502 (best-known 564). Correct post-flip sign rule: neighbor u
  same side as v pre-flip → gain[u] −= 2w after v flips; opposite → += 2w.
- **Results:** (pending benchmark)

### EXP-003: tsf (H4 consensus freezing) + icm (H6 cluster moves) — implementation
- **Status:** implementation delegated (maxcut3.c)
- tsf: elite pool K=8 at stagnation events, flip-symmetry alignment, freeze
  unanimous vertices, restart from newest elite + 25% flips of non-frozen;
  every 3rd event full unfreeze+random restart. icm: 2 interleaved ts replicas,
  every 20k iters flip a random connected component of the aligned difference
  set in both replicas (preserves cut sum); tabu reset on moved vertices.
- **Results:** implemented & verified (maxcut3.c). Selftest PASS; isoenergetic
  sum-preservation held empirically on recomputed cuts for first 10 cluster
  moves. Smoke (10 s, G11, under CPU contention): tsf 562 (25 events, 57% of
  vertices frozen); **icm 564 = best-known**, ~143 cluster moves, avg cluster
  size ≈ 91 vertices — moves are strongly non-local. Anecdotal; EXP-006 will
  benchmark properly.

## 5. Calibration data: best-known values (literature)

From published tables (Benlic & Hao 2013 BLS; Ma & Hao 2017 MOH; TSHEA):

| inst | n | best-known |
|------|-----|-------|
| G1 | 800 | 11624 |
| G6 | 800 | 2178 |
| G11 | 800 | 564 |
| G14 | 800 | 3064 |
| G18 | 800 | 992 |
| G22 | 2000 | 13359 |
| G27 | 2000 | 3341 |
| G32 | 2000 | 1410 |
| G36 | 2000 | 7678 |
| G39 | 2000 | 2408 |
| G43 | 1000 | 6660 |
| G47 | 1000 | 6657 |
| G50 | 3000 | 5880 |
| G55 | 5000 | 10294 |
| G63 | 7000 | 27045 |

Verified 2026-07-21: G63 best-known improved to **27047** (arXiv:2510.21105,
Population Annealing MC on RTX A6000, 8–24 h runs; previous 27045 stood since
~2015). Other values match the BLS/MOH era tables. Values used only for external
sanity, not for A/B decisions.

## 6. Design details for variants

### H3: second-order tie-breaking ("ts2")
During best-gain scan, collect tied argmax candidates (cap 32, reservoir-sample
beyond). For each tied v, score2(v) = Σ_{u∈N(v)} max(0, gain'_u) where
gain'_u = gain[u] + (side[u]==side[v] ? +2w : −2w) is u's gain after v flips
(O(deg) per candidate). Pick max score2; random among score2 ties. Hypothesis
target: tie-degenerate toroidal ±1 instances (G11, G32, G50).

### H4: consensus freezing ("tsf")
Elite pool = last K=8 local optima captured at stagnation events, each aligned
to the incumbent best by global-flip symmetry (choose orientation with smaller
Hamming distance) before voting. Freeze v if all K elites agree on v AND v's
flip count in last window is 0. Frozen vertices excluded from move selection
(gain bookkeeping unchanged). Unfreeze all on restart; refreeze after
reconvergence. Expected win: large sparse (G55, G63) via smaller scan + focus.

### H2: spectral init ("ts --init spectral")
Max-Cut = const − ¼ sᵀWs (s∈{±1}ⁿ) → round eigenvector of most-negative
eigenvalue of W: power iteration on (cI − W), c = 1 + max_i Σ_j |w_ij|,
~200 iters × O(m), then s = sign(x). Compare vs random init at 1 s / 10 s /
60 s budgets.

### H6: isoenergetic cluster moves ("icm")
Physics-inspired (Houdayer / ICM, Zhu–Ochoa–Katzgraber): run 2 tabu replicas;
periodically, take difference set D = {v : s¹_v ≠ s²_v} (after alignment),
pick random connected component C of G[D], flip C in both replicas (sum of
cuts preserved). Rarely used inside tabu frameworks on G-set — test whether
it beats independent restarts at equal wall-clock.
