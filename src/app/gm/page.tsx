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
      <div className="min-h-screen flex items-center justify-center font-mono-tech text-xs uppercase tracking-widest text-[#57534E]">
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
    <div className="min-h-screen pb-16">
      {/* Minimal Dossier Header */}
      <header className="bg-[#FAF7F0] border-b-2 border-[#121211] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex flex-wrap items-center justify-between gap-4 font-mono-tech text-xs uppercase">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-2.5 py-1 border border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] font-bold transition"
            >
              ← Player View
            </Link>
            <span className="font-bold text-sm">Host Dashboard</span>
            <span className="stamp-badge text-[#121211]">
              {totalPlayers} Players
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm px-3 py-1 border border-[#121211] bg-[#F2EDE2]">
              {formatTimer(state.timerSecondsRemaining)}
            </span>
            {!state.timerRunning ? (
              <button
                type="button"
                onClick={() =>
                  postAction({ action: "gm_timer_control", command: "start" })
                }
                className="px-3 py-1.5 border border-[#121211] bg-[#166534] text-[#FAF7F0] font-bold uppercase cursor-pointer"
              >
                Start
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  postAction({ action: "gm_timer_control", command: "pause" })
                }
                className="px-3 py-1.5 border border-[#121211] bg-[#C8322B] text-[#FAF7F0] font-bold uppercase cursor-pointer"
              >
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                postAction({ action: "gm_timer_control", command: "reset" })
              }
              className="px-2.5 py-1.5 border border-[#121211] bg-[#F2EDE2] hover:bg-white uppercase cursor-pointer"
            >
              Reset
            </button>
            <Link
              href="/admin"
              className="ml-2 px-3 py-1.5 border border-[#121211] bg-[#121211] text-[#FAF7F0] font-bold"
            >
              Admin View →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Phase Bar & Quick Host Actions */}
        <div className="dossier-sheet p-4 flex flex-wrap items-center justify-between gap-4 font-mono-tech text-xs">
          <div className="inline-flex flex-wrap border-2 border-[#121211] divide-x-2 divide-[#121211] bg-[#F2EDE2]">
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
                  className={`px-3.5 py-2 uppercase font-bold transition cursor-pointer ${
                    active
                      ? "bg-[#121211] text-[#FAF7F0]"
                      : "text-[#121211] hover:bg-white"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction({ action: "gm_auto_assign_roles" })}
              className="px-3 py-2 border border-[#121211] bg-[#F2EDE2] hover:bg-white uppercase font-bold cursor-pointer"
            >
              Assign Roles
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction({ action: "gm_seed_demo" })}
              className="px-3 py-2 border border-[#121211] bg-[#F2EDE2] hover:bg-white uppercase font-bold cursor-pointer"
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
                  className="px-3 py-2 border border-[#121211] bg-[#F2EDE2] hover:bg-white uppercase font-bold cursor-pointer"
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
                  className="px-3 py-2 border border-[#121211] bg-[#166534] text-[#FAF7F0] uppercase font-bold cursor-pointer"
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
              className="px-3 py-2 border border-[#C8322B] text-[#C8322B] hover:bg-[#C8322B] hover:text-[#FAF7F0] uppercase font-bold cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Two Lab Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="dossier-sheet p-5 flex items-center justify-between">
            <div>
              <span className="font-mono-tech text-xs font-bold uppercase text-[#1846C7]">
                Odd Tables (1, 3, 5, 7, 9)
              </span>
              <h2 className="text-2xl font-bold uppercase mt-0.5">Aegis AI</h2>
            </div>
            <div className="font-mono-tech text-3xl font-extrabold text-[#1846C7]">
              {aegisAggregate}
            </div>
          </div>

          <div className="dossier-sheet p-5 flex items-center justify-between">
            <div>
              <span className="font-mono-tech text-xs font-bold uppercase text-[#C84B15]">
                Even Tables (2, 4, 6, 8, 10)
              </span>
              <h2 className="text-2xl font-bold uppercase mt-0.5">
                Vanguard AI
              </h2>
            </div>
            <div className="font-mono-tech text-3xl font-extrabold text-[#C84B15]">
              {vanguardAggregate}
            </div>
          </div>
        </div>

        {/* 5 Arena Dossier Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((arenaNum) => {
            const [oddT, evenT] = getArenaTables(arenaNum);
            const tA = computedTables[oddT];
            const tB = computedTables[evenT];
            const pkg = arenaDebriefs[`${arenaNum}-${currentActNumber}`];

            return (
              <div key={arenaNum} className="dossier-sheet p-4 space-y-3">
                <div className="flex items-center justify-between font-mono-tech text-xs border-b border-[#121211] pb-2">
                  <span className="font-bold uppercase">Arena {arenaNum}</span>
                  <span
                    className={`uppercase font-bold text-[10px] ${
                      pkg?.unlocked
                        ? "text-[#166534]"
                        : pkg?.bothTeamsSubmitted
                        ? "text-[#C8322B]"
                        : "text-[#57534E]"
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
                      className="p-3 border border-[#121211] bg-[#F2EDE2] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs uppercase">
                          Table {t.tableNumber}{" "}
                          <span
                            className={
                              isAegis ? "text-[#1846C7]" : "text-[#C84B15]"
                            }
                          >
                            ({isAegis ? "Aegis" : "Vanguard"})
                          </span>
                        </div>
                        <div className="font-mono-tech text-[10px] text-[#57534E] uppercase mt-0.5">
                          {t.players.length}/5 • {done ? "Submitted" : "Open"}
                        </div>
                      </div>
                      <div className="font-mono-tech text-lg font-bold">
                        {t.totalScore}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Collapsible Detailed 10-Table Scoreboard */}
        <details className="dossier-sheet p-4 font-mono-tech text-xs">
          <summary className="cursor-pointer font-bold uppercase">
            + View Detailed 10-Table Breakdown
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
                <tr className="border-b border-[#121211] uppercase text-[#57534E]">
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
              <tbody className="divide-y divide-[#121211]">
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
                      <th className="py-2.5 px-3 font-bold uppercase">
                        Table {tNum} ({t.players.length}/5)
                      </th>
                      <td className="py-2.5 px-3 uppercase">
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
                      <td className="py-2.5 px-3 uppercase">
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
