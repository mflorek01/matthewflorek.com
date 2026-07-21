/*
 * maxcut4.c - Tabu search solver for Max-Cut (G-set style instances).
 * Extends maxcut3.c with one additional algorithm:
 *   - tsa: "ts" plus age-based tie-breaking among tied max-gain candidates
 *          (selects the least-recently-flipped vertex among ties, instead
 *          of breaking ties uniformly at random).
 *
 * Build:
 *   gcc -O2 -march=native -Wall -Wextra -std=c11 -o maxcut4 maxcut4.c -lm
 *
 * Usage:
 *   ./maxcut4 <instance_path> --algo {ts|ts2|tsf|icm|tsa} --seed <int> --time <seconds> --init {random|spectral}
 *   ./maxcut4 --selftest
 *
 * On successful completion of a normal run, prints one JSON line to stdout:
 *   {"instance": "G1", "algo": "ts", "seed": 1, "n": 800, "m": 19176,
 *    "best": 11624, "time_to_best": 3.21, "total_time": 10.0,
 *    "iters": 12345678, "verified": true, ...}
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <time.h>
#include <math.h>
#include <errno.h>

/* ------------------------------------------------------------------ */
/* RNG: splitmix64 for seeding, xorshift64* for fast generation.       */
/* ------------------------------------------------------------------ */

static uint64_t splitmix64_next(uint64_t *state) {
    uint64_t z = (*state += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}

typedef struct {
    uint64_t s;
} Rng;

static void rng_seed(Rng *r, uint64_t seed) {
    uint64_t sm = seed;
    r->s = splitmix64_next(&sm);
    if (r->s == 0) r->s = 0x853C49E6748FEA9BULL; /* xorshift needs nonzero state */
}

static inline uint64_t rng_next(Rng *r) {
    uint64_t x = r->s;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    r->s = x;
    return x * 0x2545F4914F6CDD1DULL;
}

/* uniform integer in [0, n) */
static inline uint64_t rng_below(Rng *r, uint64_t n) {
    /* Lemire-style rejection-free-ish; fine for our small n and non-crypto use. */
    return rng_next(r) % n;
}

static inline int rng_bit(Rng *r) {
    return (int)(rng_next(r) & 1u);
}

/* ------------------------------------------------------------------ */
/* Graph: CSR adjacency, each undirected edge stored both directions.  */
/* ------------------------------------------------------------------ */

typedef struct {
    int n;
    int m;          /* number of edges (as read from file, undirected) */
    int *xadj;       /* size n+1 */
    int *adj_v;       /* size 2*m */
    int *adj_w;       /* size 2*m, int weights */
} Graph;

static void graph_free(Graph *g) {
    free(g->xadj);
    free(g->adj_v);
    free(g->adj_w);
    memset(g, 0, sizeof(*g));
}

/* Returns 0 on success, -1 on failure. */
static int graph_read(const char *path, Graph *g) {
    FILE *f = fopen(path, "r");
    if (!f) {
        fprintf(stderr, "error: cannot open '%s': %s\n", path, strerror(errno));
        return -1;
    }
    int n, m;
    if (fscanf(f, "%d %d", &n, &m) != 2) {
        fprintf(stderr, "error: cannot parse header of '%s'\n", path);
        fclose(f);
        return -1;
    }
    if (n <= 0 || m < 0) {
        fprintf(stderr, "error: invalid n=%d m=%d in '%s'\n", n, m, path);
        fclose(f);
        return -1;
    }

    int *eu = malloc((size_t)m * sizeof(int));
    int *ev = malloc((size_t)m * sizeof(int));
    int *ew = malloc((size_t)m * sizeof(int));
    if (!eu || !ev || !ew) {
        fprintf(stderr, "error: out of memory reading '%s'\n", path);
        free(eu); free(ev); free(ew);
        fclose(f);
        return -1;
    }

    int deg_count = 0;
    for (int i = 0; i < m; i++) {
        int u, v, w;
        if (fscanf(f, "%d %d %d", &u, &v, &w) != 3) {
            fprintf(stderr, "error: cannot parse edge %d in '%s'\n", i, path);
            free(eu); free(ev); free(ew);
            fclose(f);
            return -1;
        }
        if (u < 1 || u > n || v < 1 || v > n) {
            fprintf(stderr, "error: edge %d (%d,%d) out of range in '%s'\n", i, u, v, path);
            free(eu); free(ev); free(ew);
            fclose(f);
            return -1;
        }
        eu[i] = u - 1;
        ev[i] = v - 1;
        ew[i] = w;
        deg_count += 2;
    }
    fclose(f);

    g->n = n;
    g->m = m;
    g->xadj = calloc((size_t)n + 1, sizeof(int));
    g->adj_v = malloc((size_t)deg_count * sizeof(int));
    g->adj_w = malloc((size_t)deg_count * sizeof(int));
    if (!g->xadj || (deg_count > 0 && (!g->adj_v || !g->adj_w))) {
        fprintf(stderr, "error: out of memory building CSR for '%s'\n", path);
        free(eu); free(ev); free(ew);
        graph_free(g);
        return -1;
    }

    /* degree count */
    for (int i = 0; i < m; i++) {
        g->xadj[eu[i] + 1]++;
        g->xadj[ev[i] + 1]++;
    }
    for (int i = 0; i < n; i++) g->xadj[i + 1] += g->xadj[i];

    int *cursor = malloc((size_t)n * sizeof(int));
    memcpy(cursor, g->xadj, (size_t)n * sizeof(int));
    for (int i = 0; i < m; i++) {
        int u = eu[i], v = ev[i], w = ew[i];
        g->adj_v[cursor[u]] = v;
        g->adj_w[cursor[u]] = w;
        cursor[u]++;
        g->adj_v[cursor[v]] = u;
        g->adj_w[cursor[v]] = w;
        cursor[v]++;
    }
    free(cursor);
    free(eu); free(ev); free(ew);
    return 0;
}

/* ------------------------------------------------------------------ */
/* Core Max-Cut primitives                                             */
/* ------------------------------------------------------------------ */

static int64_t compute_cut(const Graph *g, const uint8_t *side) {
    int64_t cut = 0;
    for (int u = 0; u < g->n; u++) {
        for (int k = g->xadj[u]; k < g->xadj[u + 1]; k++) {
            int v = g->adj_v[k];
            if (v > u) { /* count each undirected edge once */
                if (side[u] != side[v]) cut += g->adj_w[k];
            }
        }
    }
    return cut;
}

static void compute_gain_all(const Graph *g, const uint8_t *side, int64_t *gain) {
    for (int u = 0; u < g->n; u++) {
        int64_t gu = 0;
        for (int k = g->xadj[u]; k < g->xadj[u + 1]; k++) {
            int v = g->adj_v[k];
            int w = g->adj_w[k];
            if (side[u] == side[v]) gu += w;
            else gu -= w;
        }
        gain[u] = gu;
    }
}

/* Flip vertex v: updates side[v], gain[] for v and its neighbors, and
 * returns the delta applied to the cut value (== the pre-flip gain[v]). */
static inline int64_t flip_vertex(const Graph *g, uint8_t *side, int64_t *gain, int v) {
    int64_t delta = gain[v];
    side[v] ^= 1;
    gain[v] = -gain[v];
    for (int k = g->xadj[v]; k < g->xadj[v + 1]; k++) {
        int u = g->adj_v[k];
        int w = g->adj_w[k];
        if (side[u] == side[v]) gain[u] += 2 * (int64_t)w;
        else gain[u] -= 2 * (int64_t)w;
    }
    return delta;
}

static void random_solution(uint8_t *side, int n, Rng *r) {
    for (int i = 0; i < n; i++) side[i] = (uint8_t)rng_bit(r);
}

/* Draw a uniform double in [0,1) from the RNG (53 bits of precision). */
static inline double rng_uniform01(Rng *r) {
    return (double)(rng_next(r) >> 11) * (1.0 / 9007199254740992.0);
}

/* ------------------------------------------------------------------ */
/* Spectral initialization: approximate eigenvector of the most-        */
/* negative eigenvalue of the weighted adjacency matrix W, via power    */
/* iteration on the shifted matrix M = c*I - W, c = 1 + max_i sum|w_ij|.*/
/* side[i] = (x_i >= 0) ? 1 : 0.                                        */
/* ------------------------------------------------------------------ */

#define SPECTRAL_ITERS 300

static void spectral_solution(const Graph *g, uint8_t *side, Rng *r) {
    int n = g->n;
    double *x = malloc((size_t)n * sizeof(double));
    double *y = malloc((size_t)n * sizeof(double));

    double c = 0.0;
    for (int u = 0; u < n; u++) {
        double s = 0.0;
        for (int k = g->xadj[u]; k < g->xadj[u + 1]; k++) {
            s += fabs((double)g->adj_w[k]);
        }
        if (s > c) c = s;
    }
    c += 1.0;

    double norm = 0.0;
    for (int i = 0; i < n; i++) {
        double val = rng_uniform01(r) * 2.0 - 1.0; /* uniform in [-1,1) */
        x[i] = val;
        norm += val * val;
    }
    norm = sqrt(norm);
    if (norm < 1e-300) norm = 1.0;
    for (int i = 0; i < n; i++) x[i] /= norm;

    for (int iter = 0; iter < SPECTRAL_ITERS; iter++) {
        for (int u = 0; u < n; u++) {
            double s = 0.0;
            for (int k = g->xadj[u]; k < g->xadj[u + 1]; k++) {
                int v = g->adj_v[k];
                int w = g->adj_w[k];
                s += (double)w * x[v];
            }
            y[u] = c * x[u] - s;
        }
        double nrm = 0.0;
        for (int i = 0; i < n; i++) nrm += y[i] * y[i];
        nrm = sqrt(nrm);
        if (nrm < 1e-300) nrm = 1.0;
        for (int i = 0; i < n; i++) x[i] = y[i] / nrm;
    }

    for (int i = 0; i < n; i++) side[i] = (x[i] >= 0.0) ? (uint8_t)1 : (uint8_t)0;

    free(x);
    free(y);
}

/* ------------------------------------------------------------------ */
/* Timing helper                                                       */
/* ------------------------------------------------------------------ */

static double now_sec(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec + (double)ts.tv_nsec * 1e-9;
}

/* ------------------------------------------------------------------ */
/* Tabu search                                                         */
/* ------------------------------------------------------------------ */

typedef struct {
    int64_t best_cut;
    double time_to_best;
    double total_time;
    uint64_t iters;
    int64_t init_cut;       /* cut value of the initial solution, before search */
    uint64_t tie_iters;     /* ts2 only: iterations with >1 tied argmax candidate */
    uint64_t score2_evals;  /* ts2 only: number of score2() evaluations performed */
    uint64_t events;        /* tsf only: number of stagnation events */
    uint64_t frozen_final;  /* tsf only: frozen vertex count at end of run */
    uint64_t cluster_moves;    /* icm only: number of cluster moves executed */
    uint64_t cluster_size_sum; /* icm only: sum of |C| over all cluster moves */
    uint8_t *best_side; /* caller-owned buffer, size n */
} TsResult;

typedef enum { INIT_RANDOM = 0, INIT_SPECTRAL = 1 } InitMode;

#define RESTART_PATIENCE 300000
#define TABU_BASE 20
#define TABU_RANGE 50
#define TIME_CHECK_INTERVAL 512
#define TS2_TIE_CAP 32
#define SPECTRAL_PERTURB_DENOM 10 /* 1/10 = 0.1 flip probability on restart */

static void run_tabu_search(const Graph *g, uint64_t seed, double time_limit,
                             const char *algo, InitMode init_mode, TsResult *out) {
    int n = g->n;
    uint8_t *side = malloc((size_t)n);
    int64_t *gain = malloc((size_t)n * sizeof(int64_t));
    int64_t *tabu_until = calloc((size_t)n, sizeof(int64_t)); /* iter after which allowed */

    Rng rng;
    rng_seed(&rng, seed);

    bool is_ts2 = (strcmp(algo, "ts2") == 0);
    bool is_tsa = (strcmp(algo, "tsa") == 0);

    /* tsa only: iteration at which each vertex was last flipped (0 initially,
     * reset to 0 on restart). Used to break gain ties in favor of the
     * least-recently-flipped (oldest) candidate. */
    uint64_t *last_flip = is_tsa ? calloc((size_t)n, sizeof(uint64_t)) : NULL;

    uint8_t *spectral_side = NULL;
    if (init_mode == INIT_SPECTRAL) {
        spectral_side = malloc((size_t)n);
        spectral_solution(g, spectral_side, &rng);
        memcpy(side, spectral_side, (size_t)n);
    } else {
        random_solution(side, n, &rng);
    }

    int64_t cur_cut = compute_cut(g, side);
    compute_gain_all(g, side, gain);
    int64_t init_cut = cur_cut;

    int64_t best_cut = cur_cut;
    memcpy(out->best_side, side, (size_t)n);
    double t_start = now_sec();
    double time_to_best = 0.0;

    uint64_t iter = 0;
    uint64_t last_improve_iter = 0;
    double elapsed = 0.0;
    uint64_t tie_iters = 0;
    uint64_t score2_evals = 0;

    int tied[TS2_TIE_CAP];

    while (1) {
        if ((iter & (TIME_CHECK_INTERVAL - 1)) == 0) {
            elapsed = now_sec() - t_start;
            if (elapsed >= time_limit) break;
        }
        iter++;

        int64_t best_gain = INT64_MIN;
        int best_v = -1;
        int reservoir_count = 0;   /* ts: reservoir sample size over ties */
        int tie_seen = 0;          /* ts2: number of candidates seen at best_gain */
        int fallback_v = -1;      /* best gain ignoring tabu, safety net */
        int64_t fallback_gain = INT64_MIN;
        int fallback_count = 0;

        for (int v = 0; v < n; v++) {
            int64_t gv = gain[v];

            /* track absolute-best-ignoring-tabu as a fallback in case the
             * eligible set is ever empty (shouldn't normally happen). */
            if (gv > fallback_gain) {
                fallback_gain = gv; fallback_v = v; fallback_count = 1;
            } else if (gv == fallback_gain) {
                fallback_count++;
                if ((uint64_t)rng_below(&rng, (uint64_t)fallback_count) == 0) fallback_v = v;
            }

            bool is_tabu = (int64_t)iter < tabu_until[v];
            bool aspires = (cur_cut + gv > best_cut);
            if (is_tabu && !aspires) continue;

            if (is_ts2) {
                if (gv > best_gain) {
                    best_gain = gv;
                    tie_seen = 1;
                    tied[0] = v;
                } else if (gv == best_gain) {
                    tie_seen++;
                    if (tie_seen <= TS2_TIE_CAP) {
                        tied[tie_seen - 1] = v;
                    } else {
                        uint64_t j = rng_below(&rng, (uint64_t)tie_seen);
                        if (j < (uint64_t)TS2_TIE_CAP) tied[j] = v;
                    }
                }
            } else {
                if (gv > best_gain) {
                    best_gain = gv;
                    best_v = v;
                    reservoir_count = 1;
                } else if (gv == best_gain) {
                    reservoir_count++;
                    if ((uint64_t)rng_below(&rng, (uint64_t)reservoir_count) == 0) best_v = v;
                }
            }
        }

        if (is_ts2) {
            int buf_n = tie_seen < TS2_TIE_CAP ? tie_seen : TS2_TIE_CAP;
            if (buf_n == 1) {
                best_v = tied[0];
            } else if (buf_n > 1) {
                tie_iters++;
                int64_t best_score2 = INT64_MIN;
                int best_v2 = -1;
                int score2_tie_count = 0;
                for (int i = 0; i < buf_n; i++) {
                    int v = tied[i];
                    uint8_t sv = side[v];
                    int64_t s2 = 0;
                    for (int k = g->xadj[v]; k < g->xadj[v + 1]; k++) {
                        int u = g->adj_v[k];
                        int w = g->adj_w[k];
                        int64_t ga; /* gain[u] as it would be AFTER v flips */
                        if (side[u] == sv) ga = gain[u] - 2 * (int64_t)w;
                        else ga = gain[u] + 2 * (int64_t)w;
                        if (ga > 0) s2 += ga;
                    }
                    score2_evals++;
                    if (s2 > best_score2) {
                        best_score2 = s2; best_v2 = v; score2_tie_count = 1;
                    } else if (s2 == best_score2) {
                        score2_tie_count++;
                        if ((uint64_t)rng_below(&rng, (uint64_t)score2_tie_count) == 0) best_v2 = v;
                    }
                }
                best_v = best_v2;
            }
            /* buf_n == 0: no eligible candidate at all; best_v stays -1
             * and the fallback path below handles it, same as "ts". */
        }

        if (best_v < 0) {
            /* no eligible vertex (all tabu, none aspiring): fall back */
            best_v = fallback_v;
        }

        int64_t delta = flip_vertex(g, side, gain, best_v);
        cur_cut += delta;
        uint64_t tenure = TABU_BASE + rng_below(&rng, TABU_RANGE);
        tabu_until[best_v] = (int64_t)iter + (int64_t)tenure;

        if (cur_cut > best_cut) {
            best_cut = cur_cut;
            memcpy(out->best_side, side, (size_t)n);
            last_improve_iter = iter;
            time_to_best = now_sec() - t_start;
        }

        if (iter - last_improve_iter >= RESTART_PATIENCE) {
            if (init_mode == INIT_SPECTRAL) {
                memcpy(side, spectral_side, (size_t)n);
                for (int i = 0; i < n; i++) {
                    if (rng_below(&rng, SPECTRAL_PERTURB_DENOM) == 0) side[i] ^= 1;
                }
            } else {
                random_solution(side, n, &rng);
            }
            cur_cut = compute_cut(g, side);
            compute_gain_all(g, side, gain);
            memset(tabu_until, 0, (size_t)n * sizeof(int64_t));
            last_improve_iter = iter;
        }
    }

    double total_time = now_sec() - t_start;

    out->best_cut = best_cut;
    out->time_to_best = time_to_best;
    out->total_time = total_time;
    out->iters = iter;
    out->init_cut = init_cut;
    out->tie_iters = tie_iters;
    out->score2_evals = score2_evals;

    free(side);
    free(gain);
    free(tabu_until);
    free(spectral_side);
}

/* ------------------------------------------------------------------ */
/* "tsf": tabu search with elite-consensus freezing.                   */
/*                                                                      */
/* Identical move selection to "ts", except that on a stagnation event  */
/* (no best-ever improvement for RESTART_PATIENCE iterations) the       */
/* current best-ever solution is pushed into a small elite pool (FIFO,  */
/* capacity ELITE_K). Once at least ELITE_MIN_FOR_FREEZE elites have    */
/* been collected, the search restarts from the newest elite with the   */
/* vertices all elites agree on (after aligning for Max-Cut's global    */
/* flip symmetry) frozen -- excluded from move selection -- while the   */
/* rest are randomly perturbed. Every 3rd stagnation event instead does */
/* a plain random restart with the frozen set cleared, so the search    */
/* can escape a bad consensus.                                          */
/* ------------------------------------------------------------------ */

#define ELITE_K 8
#define ELITE_MIN_FOR_FREEZE 4
#define ELITE_FLIP_DENOM 4        /* 1/4 = 0.25 flip probability for non-frozen vertices */
#define ELITE_UNFREEZE_DENOM 10   /* unfreeze ~10% of the frozen set if the safety cap trips */
#define ELITE_SAFETY_THRESHOLD 0.95

static void run_tsf(const Graph *g, uint64_t seed, double time_limit,
                     InitMode init_mode, TsResult *out) {
    int n = g->n;
    uint8_t *side = malloc((size_t)n);
    int64_t *gain = malloc((size_t)n * sizeof(int64_t));
    int64_t *tabu_until = calloc((size_t)n, sizeof(int64_t));
    bool *frozen = calloc((size_t)n, sizeof(bool));

    /* Elite pool: up to ELITE_K solutions (bit arrays). Once elite_count
     * reaches ELITE_K, slots are overwritten in circular (FIFO) order. */
    uint8_t *elite[ELITE_K];
    for (int i = 0; i < ELITE_K; i++) elite[i] = malloc((size_t)n);
    int elite_count = 0;
    int elite_next = 0;

    bool *complement = malloc((size_t)ELITE_K * sizeof(bool));
    int *idx_buf = malloc((size_t)n * sizeof(int));

    Rng rng;
    rng_seed(&rng, seed);

    uint8_t *spectral_side = NULL;
    if (init_mode == INIT_SPECTRAL) {
        spectral_side = malloc((size_t)n);
        spectral_solution(g, spectral_side, &rng);
        memcpy(side, spectral_side, (size_t)n);
    } else {
        random_solution(side, n, &rng);
    }

    int64_t cur_cut = compute_cut(g, side);
    compute_gain_all(g, side, gain);
    int64_t init_cut = cur_cut;

    int64_t best_cut = cur_cut;
    memcpy(out->best_side, side, (size_t)n);
    double t_start = now_sec();
    double time_to_best = 0.0;

    uint64_t iter = 0;
    uint64_t last_improve_iter = 0;
    double elapsed = 0.0;
    uint64_t events = 0;
    uint64_t frozen_count = 0;

    while (1) {
        if ((iter & (TIME_CHECK_INTERVAL - 1)) == 0) {
            elapsed = now_sec() - t_start;
            if (elapsed >= time_limit) break;
        }
        iter++;

        int64_t best_gain = INT64_MIN;
        int best_v = -1;
        int reservoir_count = 0;
        int fallback_v = -1;
        int64_t fallback_gain = INT64_MIN;
        int fallback_count = 0;

        for (int v = 0; v < n; v++) {
            if (frozen[v]) continue; /* frozen vertices are never selected */
            int64_t gv = gain[v];

            if (gv > fallback_gain) {
                fallback_gain = gv; fallback_v = v; fallback_count = 1;
            } else if (gv == fallback_gain) {
                fallback_count++;
                if ((uint64_t)rng_below(&rng, (uint64_t)fallback_count) == 0) fallback_v = v;
            }

            bool is_tabu = (int64_t)iter < tabu_until[v];
            bool aspires = (cur_cut + gv > best_cut);
            if (is_tabu && !aspires) continue;

            if (gv > best_gain) {
                best_gain = gv;
                best_v = v;
                reservoir_count = 1;
            } else if (gv == best_gain) {
                reservoir_count++;
                if ((uint64_t)rng_below(&rng, (uint64_t)reservoir_count) == 0) best_v = v;
            }
        }

        if (best_v < 0) best_v = fallback_v;

        if (best_v < 0) {
            /* Every vertex is frozen; shouldn't happen given the 0.95n
             * safety cap below, but guard against a stall regardless. */
            memset(frozen, 0, (size_t)n * sizeof(bool));
            frozen_count = 0;
            continue;
        }

        int64_t delta = flip_vertex(g, side, gain, best_v);
        cur_cut += delta;
        uint64_t tenure = TABU_BASE + rng_below(&rng, TABU_RANGE);
        tabu_until[best_v] = (int64_t)iter + (int64_t)tenure;

        if (cur_cut > best_cut) {
            best_cut = cur_cut;
            memcpy(out->best_side, side, (size_t)n);
            last_improve_iter = iter;
            time_to_best = now_sec() - t_start;
        }

        if (iter - last_improve_iter >= RESTART_PATIENCE) {
            events++;

            /* Capture the best solution found since the last stagnation
             * event. Since best_cut only ever increases, out->best_side is
             * exactly that solution (it may equal the previous elite if
             * nothing improved during this window). */
            memcpy(elite[elite_next], out->best_side, (size_t)n);
            int newest_idx = elite_next;
            elite_next = (elite_next + 1) % ELITE_K;
            if (elite_count < ELITE_K) elite_count++;

            bool clear_event = (events % 3 == 0);

            if (clear_event || elite_count < ELITE_MIN_FOR_FREEZE) {
                memset(frozen, 0, (size_t)n * sizeof(bool));
                frozen_count = 0;
                if (init_mode == INIT_SPECTRAL) {
                    memcpy(side, spectral_side, (size_t)n);
                    for (int i = 0; i < n; i++) {
                        if (rng_below(&rng, SPECTRAL_PERTURB_DENOM) == 0) side[i] ^= 1;
                    }
                } else {
                    random_solution(side, n, &rng);
                }
            } else {
                uint8_t *ref = elite[newest_idx];

                /* Align every elite to ref under Max-Cut's global flip
                 * symmetry: complement it if it disagrees with ref on more
                 * than half the vertices. */
                for (int i = 0; i < elite_count; i++) {
                    uint8_t *e = elite[i];
                    int64_t d = 0;
                    for (int v = 0; v < n; v++) if (e[v] != ref[v]) d++;
                    complement[i] = (d > n / 2);
                }

                frozen_count = 0;
                for (int v = 0; v < n; v++) {
                    uint8_t e0 = elite[0][v];
                    if (complement[0]) e0 ^= 1;
                    bool agree = true;
                    for (int i = 1; i < elite_count; i++) {
                        uint8_t ei = elite[i][v];
                        if (complement[i]) ei ^= 1;
                        if (ei != e0) { agree = false; break; }
                    }
                    frozen[v] = agree;
                    if (agree) frozen_count++;
                }

                /* Safety valve: never let the frozen set nearly cover the
                 * whole graph -- unfreeze a random 10% if it does. */
                if ((double)frozen_count > ELITE_SAFETY_THRESHOLD * (double)n) {
                    int nf = 0;
                    for (int v = 0; v < n; v++) if (frozen[v]) idx_buf[nf++] = v;
                    int to_unfreeze = nf / ELITE_UNFREEZE_DENOM;
                    for (int i = 0; i < to_unfreeze && nf > 0; i++) {
                        int j = (int)rng_below(&rng, (uint64_t)nf);
                        int v = idx_buf[j];
                        frozen[v] = false;
                        frozen_count--;
                        idx_buf[j] = idx_buf[nf - 1];
                        nf--;
                    }
                }

                memcpy(side, ref, (size_t)n);
                for (int v = 0; v < n; v++) {
                    if (!frozen[v]) {
                        if (rng_below(&rng, ELITE_FLIP_DENOM) == 0) side[v] ^= 1;
                    }
                }
            }

            cur_cut = compute_cut(g, side);
            compute_gain_all(g, side, gain);
            memset(tabu_until, 0, (size_t)n * sizeof(int64_t));
            last_improve_iter = iter;
        }
    }

    double total_time = now_sec() - t_start;

    out->best_cut = best_cut;
    out->time_to_best = time_to_best;
    out->total_time = total_time;
    out->iters = iter;
    out->init_cut = init_cut;
    out->events = events;
    out->frozen_final = frozen_count;

    free(side);
    free(gain);
    free(tabu_until);
    free(frozen);
    for (int i = 0; i < ELITE_K; i++) free(elite[i]);
    free(complement);
    free(idx_buf);
    free(spectral_side);
}

/* ------------------------------------------------------------------ */
/* "icm": two interleaved tabu-search replicas plus isoenergetic        */
/* cluster moves.                                                       */
/*                                                                      */
/* Each replica runs independent "ts" logic (own side/gain/tabu state   */
/* and RNG stream). Every ICM_CLUSTER_INTERVAL iterations (per replica) */
/* the replicas are aligned (global flip symmetry) and a random         */
/* connected component of their vertex-disagreement set is flipped in   */
/* both replicas simultaneously -- a move that preserves cut1+cut2.     */
/* ------------------------------------------------------------------ */

#define ICM_BATCH 1000
#define ICM_CLUSTER_INTERVAL 20000

typedef struct {
    uint8_t *side;
    int64_t *gain;
    int64_t *tabu_until;
    uint8_t *best_side;
    uint8_t *spectral_side; /* NULL unless INIT_SPECTRAL */
    Rng rng;
    uint64_t iter;
    uint64_t last_improve;
    int64_t cur_cut;
    int64_t best_cut;
    double time_to_best;
} Replica;

static void replica_init(Replica *rep, const Graph *g, int n, uint64_t seed, InitMode init_mode) {
    rep->side = malloc((size_t)n);
    rep->gain = malloc((size_t)n * sizeof(int64_t));
    rep->tabu_until = calloc((size_t)n, sizeof(int64_t));
    rep->best_side = malloc((size_t)n);
    rep->spectral_side = NULL;
    rng_seed(&rep->rng, seed);
    if (init_mode == INIT_SPECTRAL) {
        rep->spectral_side = malloc((size_t)n);
        spectral_solution(g, rep->spectral_side, &rep->rng);
        memcpy(rep->side, rep->spectral_side, (size_t)n);
    } else {
        random_solution(rep->side, n, &rep->rng);
    }
    rep->cur_cut = compute_cut(g, rep->side);
    compute_gain_all(g, rep->side, rep->gain);
    rep->best_cut = rep->cur_cut;
    memcpy(rep->best_side, rep->side, (size_t)n);
    rep->iter = 0;
    rep->last_improve = 0;
    rep->time_to_best = 0.0;
}

static void replica_free(Replica *rep) {
    free(rep->side);
    free(rep->gain);
    free(rep->tabu_until);
    free(rep->best_side);
    free(rep->spectral_side);
}

/* One "ts"-style tabu iteration (selection + flip + tabu update) plus the
 * stagnation-restart check, for a single replica. */
static void replica_step(Replica *rep, const Graph *g, int n, double t_start, InitMode init_mode) {
    rep->iter++;
    uint64_t iter = rep->iter;
    uint8_t *side = rep->side;
    int64_t *gain = rep->gain;
    int64_t *tabu_until = rep->tabu_until;
    Rng *rng = &rep->rng;
    int64_t cur_cut = rep->cur_cut;
    int64_t best_cut = rep->best_cut;

    int64_t best_gain = INT64_MIN;
    int best_v = -1;
    int reservoir_count = 0;
    int fallback_v = -1;
    int64_t fallback_gain = INT64_MIN;
    int fallback_count = 0;

    for (int v = 0; v < n; v++) {
        int64_t gv = gain[v];
        if (gv > fallback_gain) {
            fallback_gain = gv; fallback_v = v; fallback_count = 1;
        } else if (gv == fallback_gain) {
            fallback_count++;
            if ((uint64_t)rng_below(rng, (uint64_t)fallback_count) == 0) fallback_v = v;
        }

        bool is_tabu = (int64_t)iter < tabu_until[v];
        bool aspires = (cur_cut + gv > best_cut);
        if (is_tabu && !aspires) continue;

        if (gv > best_gain) {
            best_gain = gv; best_v = v; reservoir_count = 1;
        } else if (gv == best_gain) {
            reservoir_count++;
            if ((uint64_t)rng_below(rng, (uint64_t)reservoir_count) == 0) best_v = v;
        }
    }
    if (best_v < 0) best_v = fallback_v;

    int64_t delta = flip_vertex(g, side, gain, best_v);
    cur_cut += delta;
    uint64_t tenure = TABU_BASE + rng_below(rng, TABU_RANGE);
    tabu_until[best_v] = (int64_t)iter + (int64_t)tenure;

    if (cur_cut > best_cut) {
        best_cut = cur_cut;
        memcpy(rep->best_side, side, (size_t)n);
        rep->last_improve = iter;
        rep->time_to_best = now_sec() - t_start;
    }

    rep->cur_cut = cur_cut;
    rep->best_cut = best_cut;

    if (iter - rep->last_improve >= RESTART_PATIENCE) {
        if (init_mode == INIT_SPECTRAL) {
            memcpy(side, rep->spectral_side, (size_t)n);
            for (int i = 0; i < n; i++) {
                if (rng_below(rng, SPECTRAL_PERTURB_DENOM) == 0) side[i] ^= 1;
            }
        } else {
            random_solution(side, n, rng);
        }
        rep->cur_cut = compute_cut(g, side);
        compute_gain_all(g, side, gain);
        memset(tabu_until, 0, (size_t)n * sizeof(int64_t));
        rep->last_improve = iter;
    }
}

static void run_icm(const Graph *g, uint64_t seed, double time_limit,
                     InitMode init_mode, TsResult *out) {
    int n = g->n;

    Replica rep1, rep2;
    replica_init(&rep1, g, n, seed, init_mode);
    replica_init(&rep2, g, n, seed ^ 0x9E3779B97F4A7C15ULL, init_mode);

    int64_t init_cut = rep1.cur_cut;

    int64_t best_cut = rep1.best_cut > rep2.best_cut ? rep1.best_cut : rep2.best_cut;
    memcpy(out->best_side, (rep1.best_cut >= rep2.best_cut) ? rep1.best_side : rep2.best_side, (size_t)n);
    double t_start = now_sec();
    double time_to_best = 0.0;

    uint64_t last_cluster_check1 = 0;
    uint64_t cluster_moves = 0;
    uint64_t cluster_size_sum = 0;

    bool *in_d = calloc((size_t)n, sizeof(bool));
    int *d_list = malloc((size_t)n * sizeof(int));
    bool *visited = calloc((size_t)n, sizeof(bool));
    int *queue_buf = malloc((size_t)n * sizeof(int));
    int *comp = malloc((size_t)n * sizeof(int));

    while (1) {
        double elapsed = now_sec() - t_start;
        if (elapsed >= time_limit) break;

        for (int b = 0; b < ICM_BATCH; b++) replica_step(&rep1, g, n, t_start, init_mode);
        for (int b = 0; b < ICM_BATCH; b++) replica_step(&rep2, g, n, t_start, init_mode);

        if (rep1.best_cut > best_cut) {
            best_cut = rep1.best_cut;
            memcpy(out->best_side, rep1.best_side, (size_t)n);
            time_to_best = rep1.time_to_best;
        }
        if (rep2.best_cut > best_cut) {
            best_cut = rep2.best_cut;
            memcpy(out->best_side, rep2.best_side, (size_t)n);
            time_to_best = rep2.time_to_best;
        }

        if (rep1.iter - last_cluster_check1 >= ICM_CLUSTER_INTERVAL) {
            last_cluster_check1 = rep1.iter;

            /* Align replica2 to replica1 under global flip symmetry; this
             * leaves replica2's cut value unchanged. */
            int64_t dist = 0;
            for (int v = 0; v < n; v++) if (rep1.side[v] != rep2.side[v]) dist++;
            if (dist > n / 2) {
                for (int v = 0; v < n; v++) rep2.side[v] ^= 1;
            }

            int d_count = 0;
            for (int v = 0; v < n; v++) {
                bool d = (rep1.side[v] != rep2.side[v]);
                in_d[v] = d;
                if (d) d_list[d_count++] = v;
            }

            if (d_count > 0 && d_count < n) {
                int start_v = d_list[(int)rng_below(&rep1.rng, (uint64_t)d_count)];
                memset(visited, 0, (size_t)n * sizeof(bool));
                int qh = 0, qt = 0, csize = 0;
                queue_buf[qt++] = start_v;
                visited[start_v] = true;
                comp[csize++] = start_v;
                while (qh < qt) {
                    int u = queue_buf[qh++];
                    for (int k = g->xadj[u]; k < g->xadj[u + 1]; k++) {
                        int w = g->adj_v[k];
                        if (in_d[w] && !visited[w]) {
                            visited[w] = true;
                            queue_buf[qt++] = w;
                            comp[csize++] = w;
                        }
                    }
                }

                bool check_sum = (cluster_moves < 10);
                int64_t sum_before = rep1.cur_cut + rep2.cur_cut;

                for (int i = 0; i < csize; i++) {
                    int v = comp[i];
                    rep1.cur_cut += flip_vertex(g, rep1.side, rep1.gain, v);
                    rep2.cur_cut += flip_vertex(g, rep2.side, rep2.gain, v);
                    rep1.tabu_until[v] = 0;
                    rep2.tabu_until[v] = 0;
                }

                cluster_moves++;
                cluster_size_sum += (uint64_t)csize;

                if (check_sum) {
                    /* Extra, one-time-per-move-only recompute check (first
                     * 10 cluster moves) that the isoenergetic property
                     * (cut1+cut2 preserved) actually holds for our D /
                     * component construction, on top of the always-on
                     * incremental-vs-recompute check done for best_side at
                     * the end of main(). */
                    int64_t recompute1 = compute_cut(g, rep1.side);
                    int64_t recompute2 = compute_cut(g, rep2.side);
                    int64_t sum_after_incr = rep1.cur_cut + rep2.cur_cut;
                    int64_t sum_after_recompute = recompute1 + recompute2;
                    if (sum_after_incr != sum_before || sum_after_recompute != sum_before) {
                        fprintf(stderr,
                            "WARNING: cluster move #%llu sum mismatch: before=%lld incr_after=%lld recompute_after=%lld (|C|=%d)\n",
                            (unsigned long long)cluster_moves, (long long)sum_before,
                            (long long)sum_after_incr, (long long)sum_after_recompute, csize);
                    }
                }

                if (rep1.cur_cut > rep1.best_cut) {
                    rep1.best_cut = rep1.cur_cut;
                    memcpy(rep1.best_side, rep1.side, (size_t)n);
                    rep1.time_to_best = now_sec() - t_start;
                }
                if (rep2.cur_cut > rep2.best_cut) {
                    rep2.best_cut = rep2.cur_cut;
                    memcpy(rep2.best_side, rep2.side, (size_t)n);
                    rep2.time_to_best = now_sec() - t_start;
                }
                if (rep1.best_cut > best_cut) {
                    best_cut = rep1.best_cut;
                    memcpy(out->best_side, rep1.best_side, (size_t)n);
                    time_to_best = rep1.time_to_best;
                }
                if (rep2.best_cut > best_cut) {
                    best_cut = rep2.best_cut;
                    memcpy(out->best_side, rep2.best_side, (size_t)n);
                    time_to_best = rep2.time_to_best;
                }
            }
        }
    }

    double total_time = now_sec() - t_start;

    out->best_cut = best_cut;
    out->time_to_best = time_to_best;
    out->total_time = total_time;
    out->iters = rep1.iter + rep2.iter;
    out->init_cut = init_cut;
    out->cluster_moves = cluster_moves;
    out->cluster_size_sum = cluster_size_sum;

    replica_free(&rep1);
    replica_free(&rep2);
    free(in_d);
    free(d_list);
    free(visited);
    free(queue_buf);
    free(comp);
}

/* ------------------------------------------------------------------ */
/* Self test                                                           */
/* ------------------------------------------------------------------ */

static int selftest(void) {
    printf("running selftest...\n");
    const int n = 50;
    Rng rng;
    rng_seed(&rng, 0xC0FFEEULL);

    /* Build a random graph: ~ n*4 random edges with +-weights in [-9,9]\{0} */
    int target_edges = n * 4;
    int *eu = malloc((size_t)target_edges * sizeof(int));
    int *ev = malloc((size_t)target_edges * sizeof(int));
    int *ew = malloc((size_t)target_edges * sizeof(int));
    int m = 0;
    /* avoid self loops and duplicate edges (duplicates are fine for CSR/gain
     * math, but we skip self loops since they don't affect cut/gain and
     * would just be dead weight in this test) */
    for (int i = 0; i < target_edges; i++) {
        int u = (int)rng_below(&rng, (uint64_t)n);
        int v = (int)rng_below(&rng, (uint64_t)n);
        if (u == v) continue;
        int w = (int)(rng_below(&rng, 19)) - 9; /* [-9,9] */
        if (w == 0) w = 1;
        eu[m] = u; ev[m] = v; ew[m] = w;
        m++;
    }

    Graph g;
    g.n = n;
    g.m = m;
    g.xadj = calloc((size_t)n + 1, sizeof(int));
    g.adj_v = malloc((size_t)(2 * m) * sizeof(int));
    g.adj_w = malloc((size_t)(2 * m) * sizeof(int));
    for (int i = 0; i < m; i++) {
        g.xadj[eu[i] + 1]++;
        g.xadj[ev[i] + 1]++;
    }
    for (int i = 0; i < n; i++) g.xadj[i + 1] += g.xadj[i];
    int *cursor = malloc((size_t)n * sizeof(int));
    memcpy(cursor, g.xadj, (size_t)n * sizeof(int));
    for (int i = 0; i < m; i++) {
        int u = eu[i], v = ev[i], w = ew[i];
        g.adj_v[cursor[u]] = v; g.adj_w[cursor[u]] = w; cursor[u]++;
        g.adj_v[cursor[v]] = u; g.adj_w[cursor[v]] = w; cursor[v]++;
    }
    free(cursor); free(eu); free(ev); free(ew);

    uint8_t *side = malloc((size_t)n);
    int64_t *gain = malloc((size_t)n * sizeof(int64_t));
    random_solution(side, n, &rng);
    int64_t cur_cut = compute_cut(&g, side);
    compute_gain_all(&g, side, gain);

    int64_t *gain_brute = malloc((size_t)n * sizeof(int64_t));

    bool ok = true;
    const int NFLIPS = 10000;
    for (int step = 1; step <= NFLIPS && ok; step++) {
        int v = (int)rng_below(&rng, (uint64_t)n);
        int64_t delta = flip_vertex(&g, side, gain, v);
        cur_cut += delta;

        int64_t recomputed = compute_cut(&g, side);
        if (recomputed != cur_cut) {
            fprintf(stderr, "FAIL: cut mismatch at step %d: incremental=%lld recomputed=%lld\n",
                    step, (long long)cur_cut, (long long)recomputed);
            ok = false;
            break;
        }

        if (step % 1000 == 0) {
            compute_gain_all(&g, side, gain_brute);
            for (int i = 0; i < n; i++) {
                if (gain[i] != gain_brute[i]) {
                    fprintf(stderr, "FAIL: gain mismatch at step %d vertex %d: incremental=%lld brute=%lld\n",
                            step, i, (long long)gain[i], (long long)gain_brute[i]);
                    ok = false;
                    break;
                }
            }
        }
    }

    if (ok) {
        printf("PASS: %d flips, cut consistency and gain spot-checks all agree.\n", NFLIPS);
    } else {
        printf("FAIL\n");
    }

    free(side); free(gain); free(gain_brute);
    graph_free(&g);
    return ok ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */

static const char *basename_ptr(const char *path) {
    const char *slash = strrchr(path, '/');
    return slash ? slash + 1 : path;
}

int main(int argc, char **argv) {
    const char *instance_path = NULL;
    const char *algo = "ts";
    const char *init_str = "random";
    long seed = 1;
    double time_limit = 10.0;
    bool do_selftest = false;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--selftest") == 0) {
            do_selftest = true;
        } else if (strcmp(argv[i], "--algo") == 0 && i + 1 < argc) {
            algo = argv[++i];
        } else if (strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
            seed = strtol(argv[++i], NULL, 10);
        } else if (strcmp(argv[i], "--time") == 0 && i + 1 < argc) {
            time_limit = strtod(argv[++i], NULL);
        } else if (strcmp(argv[i], "--init") == 0 && i + 1 < argc) {
            init_str = argv[++i];
        } else if (argv[i][0] != '-' && instance_path == NULL) {
            instance_path = argv[i];
        } else {
            fprintf(stderr, "warning: unrecognized argument '%s'\n", argv[i]);
        }
    }

    if (do_selftest) {
        return selftest();
    }

    if (!instance_path) {
        fprintf(stderr, "usage: %s <instance_path> --algo {ts|ts2|tsf|icm} --seed <int> --time <seconds> --init {random|spectral}\n", argv[0]);
        fprintf(stderr, "       %s --selftest\n", argv[0]);
        return 2;
    }

    if (strcmp(algo, "ts") != 0 && strcmp(algo, "ts2") != 0 &&
        strcmp(algo, "tsf") != 0 && strcmp(algo, "icm") != 0) {
        fprintf(stderr, "error: unsupported algo '%s' (supported: ts, ts2, tsf, icm)\n", algo);
        return 2;
    }

    InitMode init_mode;
    if (strcmp(init_str, "random") == 0) {
        init_mode = INIT_RANDOM;
    } else if (strcmp(init_str, "spectral") == 0) {
        init_mode = INIT_SPECTRAL;
    } else {
        fprintf(stderr, "error: unsupported --init '%s' (only 'random' and 'spectral' are implemented)\n", init_str);
        return 2;
    }

    Graph g;
    if (graph_read(instance_path, &g) != 0) {
        return 1;
    }

    TsResult res;
    memset(&res, 0, sizeof(res));
    res.best_side = malloc((size_t)g.n);

    if (strcmp(algo, "tsf") == 0) {
        run_tsf(&g, (uint64_t)seed, time_limit, init_mode, &res);
    } else if (strcmp(algo, "icm") == 0) {
        run_icm(&g, (uint64_t)seed, time_limit, init_mode, &res);
    } else {
        run_tabu_search(&g, (uint64_t)seed, time_limit, algo, init_mode, &res);
    }

    int64_t verify_cut = compute_cut(&g, res.best_side);
    bool verified = (verify_cut == res.best_cut);

    double avg_cluster_size = (res.cluster_moves > 0)
        ? (double)res.cluster_size_sum / (double)res.cluster_moves
        : 0.0;

    printf("{\"instance\": \"%s\", \"algo\": \"%s\", \"seed\": %ld, \"init\": \"%s\", \"n\": %d, \"m\": %d, "
           "\"best\": %lld, \"init_cut\": %lld, \"time_to_best\": %.3f, \"total_time\": %.3f, \"iters\": %llu, "
           "\"tie_iters\": %llu, \"score2_evals\": %llu, \"events\": %llu, \"frozen_final\": %llu, "
           "\"cluster_moves\": %llu, \"avg_cluster_size\": %.3f, \"verified\": %s}\n",
           basename_ptr(instance_path), algo, seed, init_str, g.n, g.m,
           (long long)res.best_cut, (long long)res.init_cut, res.time_to_best, res.total_time,
           (unsigned long long)res.iters,
           (unsigned long long)res.tie_iters, (unsigned long long)res.score2_evals,
           (unsigned long long)res.events, (unsigned long long)res.frozen_final,
           (unsigned long long)res.cluster_moves, avg_cluster_size,
           verified ? "true" : "false");

    free(res.best_side);
    graph_free(&g);
    return 0;
}
