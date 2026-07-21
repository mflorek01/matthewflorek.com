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
- **Status:** running (implementation delegated to coding agent)
- **Setup:** ts on {G1,G6,G11,G14,G18,G22,G27,G32,G36,G39,G43,G47,G50,G55,G63},
  10 seeds × 60 s planned; first smoke: fewer seeds/shorter.
- **Hypothesis:** H1.
- **Results:** (pending)

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
