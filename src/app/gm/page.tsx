"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Play,
  Pause,
  RotateCcw,
  Users,
  Wand2,
  Unlock,
  Lock,
  Clock,
  Terminal,
  Trophy,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-[#070b14] text-slate-300 font-mono text-sm">
        Initializing Game Master Command Deck...
      </div>
    );
  }

  const { state, computedTables, arenaDebriefs } = data;
  const totalPlayers = Object.keys(state.players).length;
  const currentActNumber: 1 | 2 | 3 =
    state.phase === "act2" ? 2 : state.phase === "act3" ? 3 : 1;

  // Compute aggregate Aegis vs Vanguard scores across all 5 Arenas
  const allTablesList = Object.values(computedTables);
  const aegisAggregate = allTablesList
    .filter((t) => t.labId === "aegis")
    .reduce((sum, t) => sum + t.totalScore, 0);
  const vanguardAggregate = allTablesList
    .filter((t) => t.labId === "vanguard")
    .reduce((sum, t) => sum + t.totalScore, 0);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pb-16">
      {/* Top Projector Command Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0b1120]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="Back to Student View"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight">
                  GAME MASTER COMMAND & PROJECTOR VIEW
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {totalPlayers} Active Players
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Synchronizes all 10 physical tables (5 Arenas) and the 3 Roaming Admins
              </p>
            </div>
          </div>

          {/* Live Timer Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-lg font-extrabold text-amber-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{formatTimer(state.timerSecondsRemaining)}</span>
            </div>
            {!state.timerRunning ? (
              <button
                type="button"
                onClick={() =>
                  postAction({ action: "gm_timer_control", command: "start" })
                }
                className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 cursor-pointer"
                title="Start Timer"
              >
                <Play className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  postAction({ action: "gm_timer_control", command: "pause" })
                }
                className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 cursor-pointer"
                title="Pause Timer"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                postAction({
                  action: "gm_timer_control",
                  command: "set",
                  seconds: state.timerSecondsRemaining + 120,
                })
              }
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700 cursor-pointer"
            >
              +2m
            </button>
            <button
              type="button"
              onClick={() =>
                postAction({ action: "gm_timer_control", command: "reset" })
              }
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
              title="Reset Timer (12:00)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold"
            >
              Open 3-Admin Console
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Phase Progression & Quick Setup Deck */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono uppercase text-cyan-400">
                1-Hour Simulation Phase Controller
              </div>
              <h2 className="text-lg font-bold text-white">
                Advance All 10 Tables Simultaneously
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => postAction({ action: "gm_auto_assign_roles" })}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                <span>Auto-Assign Roles (Tables 1–10)</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => postAction({ action: "gm_seed_demo" })}
                className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Seed 50 Demo Students</span>
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
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Auto-Fill Act {currentActNumber} Choices</span>
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
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Unlock All Arenas (Act {currentActNumber})</span>
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Reset the entire simulation back to a clean Lobby?"
                    )
                  ) {
                    void postAction({ action: "gm_reset_all" });
                  }
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer"
              >
                Reset All
              </button>
            </div>
          </div>

          {/* 5 Phase Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                {
                  id: "lobby",
                  label: "0. Lobby & Onboarding",
                  sub: "Join Tables & Assign Roles",
                },
                {
                  id: "act1",
                  label: "Act I: Hub Breach",
                  sub: "Tokens & Pickle RCE",
                },
                {
                  id: "act2",
                  label: "Act II: Agent Breakout",
                  sub: "Docker Socket & Egress",
                },
                {
                  id: "act3",
                  label: "Act III: Extortion",
                  sub: "NetFlow Proof & Launch",
                },
                {
                  id: "debrief",
                  label: "4. Final Debrief",
                  sub: "Global Winner & Takeaways",
                },
              ] as { id: PhaseId; label: string; sub: string }[]
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
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    active
                      ? "bg-cyan-500 text-slate-950 border-cyan-300 font-bold shadow-lg shadow-cyan-500/20"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="text-sm font-bold">{p.label}</div>
                  <div
                    className={`text-[11px] mt-1 ${
                      active ? "text-slate-900 font-medium" : "text-slate-400"
                    }`}
                  >
                    {p.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Lab Aggregate Banner (Aegis AI vs Vanguard AI) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-r from-sky-950/40 to-slate-900 p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase text-sky-400">
                Odd Tables (1, 3, 5, 7, 9)
              </span>
              <h3 className="text-xl font-bold text-white">
                Aegis Frontier Labs
              </h3>
              <p className="text-xs text-slate-400">
                Safety-First & National Defense AI Lab
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-slate-400">
                COMBINED SCORE
              </div>
              <div className="text-3xl font-extrabold text-sky-400">
                {aegisAggregate}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 to-slate-900 p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase text-amber-400">
                Even Tables (2, 4, 6, 8, 10)
              </span>
              <h3 className="text-xl font-bold text-white">
                Vanguard Omni AI
              </h3>
              <p className="text-xs text-slate-400">
                Hyper-Scale Open & Commercial AI Lab
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-slate-400">
                COMBINED SCORE
              </div>
              <div className="text-3xl font-extrabold text-amber-400">
                {vanguardAggregate}
              </div>
            </div>
          </div>
        </div>

        {/* 5-Arena Live Matchup Grid */}
        <div>
          <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>5 Parallel Arenas (5v5 Head-to-Head Matchups)</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((arenaNum) => {
              const [oddT, evenT] = getArenaTables(arenaNum);
              const tA = computedTables[oddT];
              const tB = computedTables[evenT];
              const pkg = arenaDebriefs[`${arenaNum}-${currentActNumber}`];

              return (
                <div
                  key={arenaNum}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-sm text-white">
                      Arena {arenaNum}
                    </span>
                    {pkg?.unlocked ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                        <Unlock className="w-3 h-3" /> Unlocked
                      </span>
                    ) : pkg?.bothTeamsSubmitted ? (
                      <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready for Admin
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> In Progress
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-slate-950 border border-sky-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-sky-300">
                          Table {oddT} (Aegis)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {tA.players.length} players •{" "}
                          {tA.teamDecisions[String(currentActNumber)]
                            ? "Strategy Locked"
                            : "Deciding..."}
                        </div>
                      </div>
                      <div className="text-lg font-extrabold text-white">
                        {tA.totalScore}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-amber-300">
                          Table {evenT} (Vanguard)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {tB.players.length} players •{" "}
                          {tB.teamDecisions[String(currentActNumber)]
                            ? "Strategy Locked"
                            : "Deciding..."}
                        </div>
                      </div>
                      <div className="text-lg font-extrabold text-white">
                        {tB.totalScore}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modern Web Guidance: Responsive 10-Table Scoreboard & Telemetry Table + Live SOC Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="arena-scoreboard-caption"
              className="table-wrapper bg-slate-900/70"
            >
              <table className="responsive-sim-table text-left text-xs sm:text-sm">
                <caption
                  id="arena-scoreboard-caption"
                  className="p-4 text-left font-bold text-white border-b border-slate-800 bg-slate-900"
                >
                  All 10 Tables — Live Telemetry & Crisis Scoreboard
                </caption>
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-mono uppercase text-slate-400">
                    <th className="py-3 px-4">Table</th>
                    <th className="py-3 px-4">Arena & Lab</th>
                    <th className="py-3 px-4">Security</th>
                    <th className="py-3 px-4">Capability</th>
                    <th className="py-3 px-4">Trust</th>
                    <th className="py-3 px-4">Growth</th>
                    <th className="py-3 px-4">Act {currentActNumber} Status</th>
                    <th className="py-3 px-4 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((tNum) => {
                    const t = computedTables[tNum];
                    const isAegis = t.labId === "aegis";
                    const actLocked = Boolean(
                      t.teamDecisions[String(currentActNumber)]
                    );
                    const actUnlocked = Boolean(
                      t.unlockedActs[String(currentActNumber)]
                    );

                    return (
                      <tr
                        key={tNum}
                        className="hover:bg-slate-800/40 transition"
                      >
                        <th className="py-3 px-4 font-bold text-white">
                          Table {tNum}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            ({t.players.length}p)
                          </span>
                        </th>
                        <td className="py-3 px-4">
                          <span className="text-slate-400 mr-1.5">
                            Arena {t.arenaNumber} •
                          </span>
                          <span
                            className={
                              isAegis
                                ? "text-sky-400 font-semibold"
                                : "text-amber-400 font-semibold"
                            }
                          >
                            {t.shortName}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-300">
                          {t.currentMetrics.security}
                        </td>
                        <td className="py-3 px-4 font-mono text-purple-300">
                          {t.currentMetrics.capability}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-300">
                          {t.currentMetrics.trust}
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-300">
                          {t.currentMetrics.growth}
                        </td>
                        <td className="py-3 px-4">
                          {actUnlocked ? (
                            <span className="text-xs font-mono text-emerald-400">
                              Debriefed
                            </span>
                          ) : actLocked ? (
                            <span className="text-xs font-mono text-amber-300">
                              Awaiting Admin
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-slate-500">
                              In Progress
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-white">
                          {t.totalScore}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live SOC Audit & Event Log Feed */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col h-[480px]">
            <div className="flex items-center gap-2 text-xs font-mono uppercase text-cyan-400 pb-3 border-b border-slate-800">
              <Terminal className="w-4 h-4" />
              <span>Live SOC Event & Action Feed</span>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
              {state.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="text-cyan-300 font-semibold">
                      {log.actor}
                    </span>
                    <span>
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-slate-200 leading-relaxed">
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
