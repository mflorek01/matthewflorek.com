#!/usr/bin/env python3
"""
run_bench.py - benchmark harness for the maxcut C solver.

Runs the compiled ./maxcut binary over a grid of (instance, algo, seed)
combinations using a process pool, streams each JSON result line to an
output file as it completes, and prints a summary table at the end.

Usage:
    python3 run_bench.py --instances G1,G11 --algos ts --seeds 1,2,3 \
        --time 10 --out ../results/run1.jsonl --jobs 4
"""

import argparse
import concurrent.futures
import json
import os
import subprocess
import sys
import threading
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_INSTANCES_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "instances"))
DEFAULT_BINARY = os.path.join(SCRIPT_DIR, "maxcut")


def parse_args():
    p = argparse.ArgumentParser(description="Benchmark harness for the maxcut solver.")
    p.add_argument("--instances", required=True,
                    help="Comma-separated instance names (files under ../instances/), e.g. G1,G11")
    p.add_argument("--algos", required=True,
                    help="Comma-separated algo names, e.g. ts")
    p.add_argument("--seeds", required=True,
                    help="Comma-separated integer seeds, e.g. 1,2,3")
    p.add_argument("--time", type=float, required=True,
                    help="Time limit per run, in seconds")
    p.add_argument("--out", required=True,
                    help="Path to output JSONL file (appended to as results complete)")
    p.add_argument("--jobs", type=int, default=4,
                    help="Number of parallel worker processes (default: 4)")
    p.add_argument("--binary", default=DEFAULT_BINARY,
                    help="Path to the compiled maxcut binary (default: ./maxcut next to this script)")
    p.add_argument("--instances-dir", default=DEFAULT_INSTANCES_DIR,
                    help="Directory containing instance files (default: ../instances relative to this script)")
    return p.parse_args()


def run_one(binary, instances_dir, instance, algo, seed, time_limit):
    """Run a single (instance, algo, seed) combo. Returns a dict result."""
    path = os.path.join(instances_dir, instance)
    # algo spec "name@init" maps to --algo name --init init (e.g. ts@spectral)
    algo_name, _, init_mode = algo.partition("@")
    cmd = [binary, path, "--algo", algo_name, "--seed", str(seed), "--time", str(time_limit)]
    if init_mode:
        cmd += ["--init", init_mode]
    t0 = time.time()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=time_limit + 60)
    except subprocess.TimeoutExpired:
        return {"ok": False, "instance": instance, "algo": algo, "seed": seed,
                "error": "timeout", "wall": time.time() - t0}

    if proc.returncode != 0:
        return {"ok": False, "instance": instance, "algo": algo, "seed": seed,
                "error": f"exit={proc.returncode} stderr={proc.stderr.strip()[:500]}",
                "wall": time.time() - t0}

    # The binary may print warnings to stdout before the JSON line in
    # unexpected cases; find the last line that parses as JSON.
    line = None
    for candidate in reversed(proc.stdout.strip().splitlines()):
        candidate = candidate.strip()
        if not candidate:
            continue
        try:
            json.loads(candidate)
            line = candidate
            break
        except json.JSONDecodeError:
            continue

    if line is None:
        return {"ok": False, "instance": instance, "algo": algo, "seed": seed,
                "error": f"no JSON output; stdout={proc.stdout.strip()[:500]} stderr={proc.stderr.strip()[:500]}",
                "wall": time.time() - t0}

    record = json.loads(line)
    if init_mode:  # keep ts and ts@spectral distinct in grouping/summary
        record["algo"] = algo
        line = json.dumps(record)
    return {"ok": True, "line": line, "record": record}


def main():
    args = parse_args()

    instances = [s.strip() for s in args.instances.split(",") if s.strip()]
    algos = [s.strip() for s in args.algos.split(",") if s.strip()]
    seeds = [int(s.strip()) for s in args.seeds.split(",") if s.strip()]

    if not instances or not algos or not seeds:
        print("error: --instances, --algos, and --seeds must each be non-empty", file=sys.stderr)
        sys.exit(2)

    if not os.path.isfile(args.binary):
        print(f"error: binary not found at '{args.binary}'", file=sys.stderr)
        sys.exit(2)

    out_dir = os.path.dirname(os.path.abspath(args.out))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    jobs = []
    for instance in instances:
        inst_path = os.path.join(args.instances_dir, instance)
        if not os.path.isfile(inst_path):
            print(f"warning: instance file not found, skipping: {inst_path}", file=sys.stderr)
            continue
        for algo in algos:
            for seed in seeds:
                jobs.append((instance, algo, seed))

    if not jobs:
        print("error: no valid (instance, algo, seed) jobs to run", file=sys.stderr)
        sys.exit(2)

    total = len(jobs)
    completed = 0
    failed = 0
    results = []  # list of parsed records (successful only)
    write_lock = threading.Lock()

    print(f"[run_bench] {total} jobs ({len(instances)} instances x {len(algos)} algos x "
          f"{len(seeds)} seeds), {args.jobs} workers, time={args.time}s each", file=sys.stderr)

    t_start = time.time()

    with open(args.out, "a", buffering=1) as out_f:
        with concurrent.futures.ProcessPoolExecutor(max_workers=args.jobs) as pool:
            future_to_job = {
                pool.submit(run_one, args.binary, args.instances_dir, inst, algo, seed, args.time): (inst, algo, seed)
                for (inst, algo, seed) in jobs
            }
            for future in concurrent.futures.as_completed(future_to_job):
                inst, algo, seed = future_to_job[future]
                completed += 1
                try:
                    result = future.result()
                except Exception as e:  # pragma: no cover - defensive
                    result = {"ok": False, "instance": inst, "algo": algo, "seed": seed, "error": str(e)}

                if result["ok"]:
                    with write_lock:
                        out_f.write(result["line"] + "\n")
                        out_f.flush()
                    results.append(result["record"])
                    rec = result["record"]
                    print(f"[run_bench] ({completed}/{total}) OK  {inst:12s} {algo:6s} seed={seed:<4d} "
                          f"best={rec.get('best')} time_to_best={rec.get('time_to_best'):.2f}s "
                          f"iters={rec.get('iters')}", file=sys.stderr)
                else:
                    failed += 1
                    print(f"[run_bench] ({completed}/{total}) FAIL {inst:12s} {algo:6s} seed={seed:<4d} "
                          f"error={result.get('error')}", file=sys.stderr)

    elapsed = time.time() - t_start
    print(f"[run_bench] done: {completed - failed}/{total} succeeded, {failed} failed, "
          f"{elapsed:.1f}s wall", file=sys.stderr)

    print_summary(results)


def print_summary(results):
    """Print a per-instance, per-algo summary table to stdout."""
    if not results:
        print("No successful results to summarize.")
        return

    # group by (instance, algo)
    groups = {}
    for r in results:
        key = (r["instance"], r["algo"])
        groups.setdefault(key, []).append(r)

    header = f'{"instance":12s} {"algo":6s} {"n_seeds":>7s} {"best_of":>10s} {"mean":>12s} {"mean_ttb":>10s} {"verified":>9s}'
    print(header)
    print("-" * len(header))

    for (instance, algo) in sorted(groups.keys()):
        rows = groups[(instance, algo)]
        bests = [r["best"] for r in rows]
        ttbs = [r["time_to_best"] for r in rows]
        n_verified = sum(1 for r in rows if r.get("verified"))
        best_of = max(bests)
        mean_best = sum(bests) / len(bests)
        mean_ttb = sum(ttbs) / len(ttbs)
        print(f"{instance:12s} {algo:6s} {len(rows):7d} {best_of:10d} {mean_best:12.2f} "
              f"{mean_ttb:10.2f} {n_verified:5d}/{len(rows):<3d}")


if __name__ == "__main__":
    main()
