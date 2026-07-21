/*
 * maxcut.c - Tabu search baseline solver for Max-Cut (G-set style instances).
 *
 * Build:
 *   gcc -O2 -march=native -Wall -Wextra -o maxcut maxcut.c -lm
 *
 * Usage:
 *   ./maxcut <instance_path> --algo ts --seed <int> --time <seconds>
 *   ./maxcut --selftest
 *
 * On successful completion of a normal run, prints one JSON line to stdout:
 *   {"instance": "G1", "algo": "ts", "seed": 1, "n": 800, "m": 19176,
 *    "best": 11624, "time_to_best": 3.21, "total_time": 10.0,
 *    "iters": 12345678, "verified": true}
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
    uint8_t *best_side; /* caller-owned buffer, size n */
} TsResult;

#define RESTART_PATIENCE 300000
#define TABU_BASE 20
#define TABU_RANGE 50
#define TIME_CHECK_INTERVAL 512

static void run_tabu_search(const Graph *g, uint64_t seed, double time_limit, TsResult *out) {
    int n = g->n;
    uint8_t *side = malloc((size_t)n);
    int64_t *gain = malloc((size_t)n * sizeof(int64_t));
    int64_t *tabu_until = calloc((size_t)n, sizeof(int64_t)); /* iter after which allowed */

    Rng rng;
    rng_seed(&rng, seed);

    random_solution(side, n, &rng);
    int64_t cur_cut = compute_cut(g, side);
    compute_gain_all(g, side, gain);

    int64_t best_cut = cur_cut;
    memcpy(out->best_side, side, (size_t)n);
    double t_start = now_sec();
    double time_to_best = 0.0;

    uint64_t iter = 0;
    uint64_t last_improve_iter = 0;
    double elapsed = 0.0;

    while (1) {
        if ((iter & (TIME_CHECK_INTERVAL - 1)) == 0) {
            elapsed = now_sec() - t_start;
            if (elapsed >= time_limit) break;
        }
        iter++;

        int64_t best_gain = INT64_MIN;
        int best_v = -1;
        int reservoir_count = 0;
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

            if (gv > best_gain) {
                best_gain = gv;
                best_v = v;
                reservoir_count = 1;
            } else if (gv == best_gain) {
                reservoir_count++;
                if ((uint64_t)rng_below(&rng, (uint64_t)reservoir_count) == 0) best_v = v;
            }
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
            random_solution(side, n, &rng);
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

    free(side);
    free(gain);
    free(tabu_until);
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
        fprintf(stderr, "usage: %s <instance_path> --algo ts --seed <int> --time <seconds>\n", argv[0]);
        fprintf(stderr, "       %s --selftest\n", argv[0]);
        return 2;
    }

    if (strcmp(algo, "ts") != 0) {
        fprintf(stderr, "error: unsupported algo '%s' (only 'ts' is implemented)\n", algo);
        return 2;
    }

    Graph g;
    if (graph_read(instance_path, &g) != 0) {
        return 1;
    }

    TsResult res;
    res.best_side = malloc((size_t)g.n);
    run_tabu_search(&g, (uint64_t)seed, time_limit, &res);

    int64_t verify_cut = compute_cut(&g, res.best_side);
    bool verified = (verify_cut == res.best_cut);

    printf("{\"instance\": \"%s\", \"algo\": \"%s\", \"seed\": %ld, \"n\": %d, \"m\": %d, "
           "\"best\": %lld, \"time_to_best\": %.3f, \"total_time\": %.3f, \"iters\": %llu, "
           "\"verified\": %s}\n",
           basename_ptr(instance_path), algo, seed, g.n, g.m,
           (long long)res.best_cut, res.time_to_best, res.total_time,
           (unsigned long long)res.iters, verified ? "true" : "false");

    free(res.best_side);
    graph_free(&g);
    return 0;
}
