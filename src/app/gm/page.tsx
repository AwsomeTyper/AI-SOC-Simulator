"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getArenaTables, PhaseId } from "@/lib/scenario";
import type {
  ArenaDebriefPackage,
  ComputedTableView,
  SimulationState,
} from "@/lib/sim-engine";

interface SimApiPayload {
  state: SimulationState;
  computedTables: Record<number, ComputedTableView>;
  arenaDebriefs: Record<string, ArenaDebriefPackage>;
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function GameMasterProjectorPage() {
  const [data, setData] = useState<SimApiPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchSim = useCallback(async () => {
    try {
      const res = await fetch("/api/sim", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as SimApiPayload;
      setData(json);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchSim();
    const interval = setInterval(fetchSim, 1500);
    return () => clearInterval(interval);
  }, [fetchSim]);

  async function postAction(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  const { state, computedTables, arenaDebriefs } = data;
  const totalPlayers = Object.keys(state.players).length;
  const currentActNumber: 1 | 2 | 3 =
    state.phase === "act2" ? 2 : state.phase === "act3" ? 3 : 1;

  const allTablesList = Object.values(computedTables);
  const aegisAggregate = allTablesList
    .filter((t) => t.labId === "aegis")
    .reduce((sum, t) => sum + t.totalScore, 0);
  const vanguardAggregate = allTablesList
    .filter((t) => t.labId === "vanguard")
    .reduce((sum, t) => sum + t.totalScore, 0);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 pb-16">
      {/* Minimal Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              ← Player View
            </Link>
            <span className="text-neutral-300">|</span>
            <span className="font-semibold text-sm">Host Dashboard</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {totalPlayers} players
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-sm px-3 py-1 rounded-lg bg-neutral-100">
              {formatTimer(state.timerSecondsRemaining)}
            </span>
            {!state.timerRunning ? (
              <button
                type="button"
                onClick={() =>
                  postAction({ action: "gm_timer_control", command: "start" })
                }
                className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white font-medium cursor-pointer"
              >
                Start Timer
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  postAction({ action: "gm_timer_control", command: "pause" })
                }
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium cursor-pointer"
              >
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                postAction({ action: "gm_timer_control", command: "reset" })
              }
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
            >
              Reset
            </button>
            <Link
              href="/admin"
              className="ml-2 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 font-medium"
            >
              Admin View →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Phase Bar & Quick Host Actions */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex flex-wrap p-1 rounded-xl bg-neutral-100 text-xs font-medium gap-1">
            {(
              [
                { id: "lobby", label: "Lobby" },
                { id: "act1", label: "Act 1: Hub Breach" },
                { id: "act2", label: "Act 2: Agent Breakout" },
                { id: "act3", label: "Act 3: Ransom Bluff" },
                { id: "debrief", label: "Final Results" },
              ] as { id: PhaseId; label: string }[]
            ).map((p) => {
              const active = state.phase === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    postAction({ action: "gm_set_phase", phase: p.id })
                  }
                  className={`px-3.5 py-2 rounded-lg transition cursor-pointer ${
                    active
                      ? "bg-neutral-900 text-white font-semibold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction({ action: "gm_auto_assign_roles" })}
              className="px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 font-medium cursor-pointer"
            >
              Assign Roles
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction({ action: "gm_seed_demo" })}
              className="px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 font-medium cursor-pointer"
            >
              Load 50 Demo Players
            </button>
            {(state.phase === "act1" ||
              state.phase === "act2" ||
              state.phase === "act3") && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    postAction({
                      action: "gm_autofill_act_choices",
                      actNumber: currentActNumber,
                    })
                  }
                  className="px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 font-medium cursor-pointer"
                >
                  Auto-Fill Choices
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    postAction({
                      action: "admin_unlock_all_arenas_act",
                      actNumber: currentActNumber,
                      unlocked: true,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                >
                  Unlock All Arenas
                </button>
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Reset simulation?")) {
                  void postAction({ action: "gm_reset_all" });
                }
              }}
              className="px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 font-medium cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Two Lab Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-blue-600">
                Odd Tables (1, 3, 5, 7, 9)
              </span>
              <h2 className="text-xl font-bold mt-0.5">Aegis AI</h2>
            </div>
            <div className="text-3xl font-extrabold text-blue-600">
              {aegisAggregate}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-orange-600">
                Even Tables (2, 4, 6, 8, 10)
              </span>
              <h2 className="text-xl font-bold mt-0.5">Vanguard AI</h2>
            </div>
            <div className="text-3xl font-extrabold text-orange-600">
              {vanguardAggregate}
            </div>
          </div>
        </div>

        {/* 5 Arena Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((arenaNum) => {
            const [oddT, evenT] = getArenaTables(arenaNum);
            const tA = computedTables[oddT];
            const tB = computedTables[evenT];
            const pkg = arenaDebriefs[`${arenaNum}-${currentActNumber}`];

            return (
              <div
                key={arenaNum}
                className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sm">Arena {arenaNum}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      pkg?.unlocked
                        ? "bg-emerald-50 text-emerald-700"
                        : pkg?.bothTeamsSubmitted
                        ? "bg-amber-50 text-amber-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {pkg?.unlocked
                      ? "Unlocked"
                      : pkg?.bothTeamsSubmitted
                      ? "Ready"
                      : "Working"}
                  </span>
                </div>

                {[tA, tB].map((t) => {
                  const isAegis = t.labId === "aegis";
                  const done = Boolean(
                    t.teamDecisions[String(currentActNumber)]
                  );
                  return (
                    <div
                      key={t.tableNumber}
                      className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-semibold">
                          Table {t.tableNumber}{" "}
                          <span
                            className={
                              isAegis ? "text-blue-600" : "text-orange-600"
                            }
                          >
                            ({isAegis ? "Aegis" : "Vanguard"})
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {t.players.length}/5 • {done ? "Submitted" : "Open"}
                        </div>
                      </div>
                      <div className="text-lg font-bold">{t.totalScore}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Collapsible Detailed 10-Table Scoreboard */}
        <details className="bg-white rounded-2xl border border-neutral-200 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-neutral-600">
            View Detailed 10-Table Breakdown
          </summary>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="arena-scoreboard-caption"
            className="table-wrapper mt-4"
          >
            <table className="responsive-sim-table text-left text-xs">
              <caption id="arena-scoreboard-caption" className="sr-only">
                All 10 Tables Scoreboard
              </caption>
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Arena &amp; Lab</th>
                  <th className="py-2.5 px-3">Security</th>
                  <th className="py-2.5 px-3">Capability</th>
                  <th className="py-2.5 px-3">Trust</th>
                  <th className="py-2.5 px-3">Growth</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((tNum) => {
                  const t = computedTables[tNum];
                  const actLocked = Boolean(
                    t.teamDecisions[String(currentActNumber)]
                  );
                  const actUnlocked = Boolean(
                    t.unlockedActs[String(currentActNumber)]
                  );
                  return (
                    <tr key={tNum}>
                      <th className="py-2.5 px-3 font-semibold">
                        Table {tNum} ({t.players.length}/5)
                      </th>
                      <td className="py-2.5 px-3">
                        Arena {t.arenaNumber} • {t.shortName}
                      </td>
                      <td className="py-2.5 px-3">
                        {t.currentMetrics.security}
                      </td>
                      <td className="py-2.5 px-3">
                        {t.currentMetrics.capability}
                      </td>
                      <td className="py-2.5 px-3">{t.currentMetrics.trust}</td>
                      <td className="py-2.5 px-3">{t.currentMetrics.growth}</td>
                      <td className="py-2.5 px-3">
                        {actUnlocked
                          ? "Unlocked"
                          : actLocked
                          ? "Submitted"
                          : "Open"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        {t.totalScore}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </main>
    </div>
  );
}
