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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
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
      <div className="min-h-screen bg-[#0E0E0D] text-[#F2EDE2] flex items-center justify-center font-mono-tech text-xs uppercase tracking-widest">
        [ SYNCHRONIZING WAR-ROOM SITUATION BOARD... ]
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
    <div className="min-h-screen bg-[#0E0E0D] text-[#F2EDE2] pb-16">
      {/* Top Situation Room Header Grid */}
      <header className="border-b-2 border-[#2E2D2A] bg-[#141412] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-5 py-3.5 lg:pr-6 lg:border-r border-[#2E2D2A] flex items-center justify-between">
              <div>
                <div className="font-mono-tech text-[10px] uppercase tracking-widest text-[#A8A29E]">
                  CENTRAL COMMAND // WAR-ROOM PROJECTOR DISPLAY
                </div>
                <h1 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-[#FAF7F0]">
                  AI Lab &amp; SOC Exercise Control Board
                </h1>
              </div>
              <span className="font-mono-tech text-xs px-2.5 py-1 border border-[#3F3E3A] bg-[#1C1C19] text-[#F2EDE2]">
                {pad2(totalPlayers)} OPERATIVES
              </span>
            </div>

            {/* Mechanical Phase Clock Controls */}
            <div className="lg:col-span-4 py-3 lg:px-6 border-t lg:border-t-0 lg:border-r border-[#2E2D2A] flex items-center justify-between gap-3 font-mono-tech">
              <div>
                <div className="text-[10px] uppercase text-[#A8A29E]">
                  ROUND CLOCK
                </div>
                <div
                  className={`text-2xl font-bold leading-none mt-0.5 ${
                    state.timerRunning ? "text-[#C8322B]" : "text-[#FAF7F0]"
                  }`}
                >
                  {formatTimer(state.timerSecondsRemaining)}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {!state.timerRunning ? (
                  <button
                    type="button"
                    onClick={() =>
                      postAction({
                        action: "gm_timer_control",
                        command: "start",
                      })
                    }
                    className="px-3 py-1.5 border border-[#3F3E3A] bg-[#166534] text-[#FAF7F0] uppercase font-bold cursor-pointer"
                  >
                    Start
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      postAction({
                        action: "gm_timer_control",
                        command: "pause",
                      })
                    }
                    className="px-3 py-1.5 border border-[#3F3E3A] bg-[#C8322B] text-[#FAF7F0] uppercase font-bold cursor-pointer"
                  >
                    Pause
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
                  className="px-2.5 py-1.5 border border-[#3F3E3A] bg-[#1C1C19] hover:bg-[#2E2D2A] uppercase cursor-pointer"
                >
                  +2M
                </button>
                <button
                  type="button"
                  onClick={() =>
                    postAction({ action: "gm_timer_control", command: "reset" })
                  }
                  className="px-2.5 py-1.5 border border-[#3F3E3A] bg-[#1C1C19] hover:bg-[#2E2D2A] uppercase cursor-pointer"
                >
                  12:00
                </button>
              </div>
            </div>

            {/* Navigation Switcher */}
            <div className="lg:col-span-3 py-3 lg:pl-6 border-t lg:border-t-0 border-[#2E2D2A] flex items-center justify-end gap-2 font-mono-tech text-xs uppercase">
              <Link
                href="/"
                className="px-3 py-1.5 border border-[#3F3E3A] bg-[#1C1C19] hover:bg-[#2E2D2A] text-[#F2EDE2]"
              >
                Table View
              </Link>
              <Link
                href="/admin"
                className="px-3 py-1.5 border border-[#F2EDE2] bg-[#F2EDE2] text-[#121211] font-bold"
              >
                Field Admin [3]
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Global Exercise Phase & Operator Controls */}
        <div className="border-2 border-[#2E2D2A] bg-[#141412]">
          <div className="px-5 py-3 border-b border-[#2E2D2A] flex flex-wrap items-center justify-between gap-3 font-mono-tech text-xs">
            <span className="uppercase tracking-wider text-[#A8A29E] font-bold">
              § 1. MASTER PHASE SEQUENCER &amp; EXERCISE INITIALIZATION
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => postAction({ action: "gm_auto_assign_roles" })}
                className="px-3 py-1.5 border border-[#F2EDE2] bg-[#F2EDE2] text-[#121211] font-bold uppercase cursor-pointer"
              >
                [Auto-Assign 5 Roles Per Table]
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => postAction({ action: "gm_seed_demo" })}
                className="px-3 py-1.5 border border-[#3F3E3A] bg-[#1C1C19] hover:bg-[#2E2D2A] text-[#F2EDE2] uppercase cursor-pointer"
              >
                [Seed 50 Demo Students]
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
                    className="px-3 py-1.5 border border-[#3F3E3A] bg-[#1C1C19] hover:bg-[#2E2D2A] text-[#F2EDE2] uppercase cursor-pointer"
                  >
                    [Auto-Fill Act 0{currentActNumber} Ballots]
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
                    className="px-3 py-1.5 border border-[#166534] bg-[#166534] text-[#FAF7F0] font-bold uppercase cursor-pointer"
                  >
                    [Declassify All 5 Arenas]
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Reset all 10 tables and clear current exercise data?"
                    )
                  ) {
                    void postAction({ action: "gm_reset_all" });
                  }
                }}
                className="px-3 py-1.5 border border-[#C8322B] text-[#C8322B] hover:bg-[#C8322B] hover:text-[#FAF7F0] uppercase font-bold cursor-pointer"
              >
                [Reset Exercise]
              </button>
            </div>
          </div>

          {/* 5 Architectural Phase Blocks */}
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#2E2D2A]">
            {(
              [
                {
                  id: "lobby",
                  code: "STAGE 00",
                  label: "Lobby & Briefing",
                  sub: "Seat & Role Assignment",
                },
                {
                  id: "act1",
                  code: "ACT 01",
                  label: "Model Hub Breach",
                  sub: "Tokens & Pickle RCE",
                },
                {
                  id: "act2",
                  code: "ACT 02",
                  label: "Agent Breakout",
                  sub: "Docker Socket & Egress",
                },
                {
                  id: "act3",
                  code: "ACT 03",
                  label: "Weight Extortion",
                  sub: "NetFlow Proof & Launch",
                },
                {
                  id: "debrief",
                  code: "STAGE 04",
                  label: "Final Debrief",
                  sub: "Declassified Standings",
                },
              ] as { id: PhaseId; code: string; label: string; sub: string }[]
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
                  className={`p-4 text-left transition cursor-pointer ${
                    active
                      ? "bg-[#F2EDE2] text-[#121211]"
                      : "bg-[#141412] hover:bg-[#1C1C19] text-[#F2EDE2]"
                  }`}
                >
                  <div
                    className={`font-mono-tech text-[10px] uppercase font-bold ${
                      active ? "text-[#C8322B]" : "text-[#A8A29E]"
                    }`}
                  >
                    {p.code} {active ? "// ACTIVE" : ""}
                  </div>
                  <div className="font-bold text-sm uppercase mt-1">
                    {p.label}
                  </div>
                  <div
                    className={`font-mono-tech text-[11px] mt-1 ${
                      active ? "text-[#44403C]" : "text-[#78716C]"
                    }`}
                  >
                    {p.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Aggregate Lab Tally Bar: Aegis Frontier Labs vs. Vanguard Omni AI */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-2 border-[#2E2D2A] divide-y-2 md:divide-y-0 md:divide-x-2 divide-[#2E2D2A]">
          <div className="p-6 bg-[#1846C7] text-[#FAF7F0] flex items-center justify-between">
            <div>
              <div className="font-mono-tech text-xs uppercase tracking-widest opacity-80">
                ODD TABLES (01, 03, 05, 07, 09) // NATIONAL DEFENSE &amp; ALIGNMENT
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight mt-1">
                Aegis Frontier Labs
              </h2>
            </div>
            <div className="text-right font-mono-tech">
              <div className="text-[10px] uppercase opacity-80">
                AGGREGATE LAB SCORE
              </div>
              <div className="text-4xl font-bold">{aegisAggregate}</div>
            </div>
          </div>

          <div className="p-6 bg-[#C84B15] text-[#FAF7F0] flex items-center justify-between">
            <div>
              <div className="font-mono-tech text-xs uppercase tracking-widest opacity-80">
                EVEN TABLES (02, 04, 06, 08, 10) // HYPER-SCALE OPEN &amp; COMMERCIAL
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight mt-1">
                Vanguard Omni AI
              </h2>
            </div>
            <div className="text-right font-mono-tech">
              <div className="text-[10px] uppercase opacity-80">
                AGGREGATE LAB SCORE
              </div>
              <div className="text-4xl font-bold">{vanguardAggregate}</div>
            </div>
          </div>
        </div>

        {/* 5 Parallel Arenas Architectural Grid */}
        <div className="border-2 border-[#2E2D2A] bg-[#141412]">
          <div className="px-5 py-3 border-b border-[#2E2D2A] flex items-center justify-between font-mono-tech text-xs uppercase">
            <span className="font-bold text-[#A8A29E]">
              § 2. LIVE ARENA MATCHUPS (ARENAS 01–05 // 5V5 HEAD-TO-HEAD)
            </span>
            <span>ACT 0{currentActNumber} TELEMETRY</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[#2E2D2A]">
            {[1, 2, 3, 4, 5].map((arenaNum) => {
              const [oddT, evenT] = getArenaTables(arenaNum);
              const tA = computedTables[oddT];
              const tB = computedTables[evenT];
              const pkg = arenaDebriefs[`${arenaNum}-${currentActNumber}`];

              return (
                <div key={arenaNum} className="p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#2E2D2A] pb-2 font-mono-tech text-xs">
                    <span className="font-bold uppercase">
                      ARENA {pad2(arenaNum)}
                    </span>
                    {pkg?.unlocked ? (
                      <span className="text-[#4ADE80] font-bold">
                        [DECLASSIFIED]
                      </span>
                    ) : pkg?.bothTeamsSubmitted ? (
                      <span className="text-[#FACC15] font-bold">
                        [AWAITING ADMIN]
                      </span>
                    ) : (
                      <span className="text-[#A8A29E]">[IN SESSION]</span>
                    )}
                  </div>

                  {[tA, tB].map((t) => {
                    const isAegis = t.labId === "aegis";
                    const locked = Boolean(
                      t.teamDecisions[String(currentActNumber)]
                    );
                    return (
                      <div
                        key={t.tableNumber}
                        className="p-3.5 border border-[#2E2D2A] bg-[#0E0E0D] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono-tech text-xs font-bold uppercase flex items-center gap-1.5">
                            <span
                              className={`inline-block w-2 h-2 ${
                                isAegis ? "bg-[#1846C7]" : "bg-[#C84B15]"
                              }`}
                            />
                            <span>
                              T{pad2(t.tableNumber)} //{" "}
                              {isAegis ? "AEGIS" : "VANGUARD"}
                            </span>
                          </div>
                          <div className="font-mono-tech text-[11px] text-[#A8A29E] mt-1">
                            {t.players.length}/5 SEATED •{" "}
                            {locked ? "BALLOT FILED" : "OPEN"}
                          </div>
                        </div>
                        <div className="font-mono-tech text-2xl font-bold">
                          {t.totalScore}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modern Web Guidance: Responsive 10-Table Scoreboard + Live Wire Ticker */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="arena-scoreboard-caption"
              className="table-wrapper bg-[#121211]"
            >
              <table className="responsive-sim-table text-left font-mono-tech text-xs">
                <caption
                  id="arena-scoreboard-caption"
                  className="p-4 text-left font-bold uppercase tracking-wider text-[#FAF7F0] border-b border-[#2E2D2A] bg-[#161614]"
                >
                  § 3. All 10 Tables — Live Posture Indices &amp; Composite Standings
                </caption>
                <thead>
                  <tr className="border-b border-[#2E2D2A] text-[11px] uppercase text-[#A8A29E]">
                    <th className="py-3 px-4">Station</th>
                    <th className="py-3 px-4">Arena &amp; Lab</th>
                    <th className="py-3 px-4">SEC</th>
                    <th className="py-3 px-4">CAP</th>
                    <th className="py-3 px-4">TRU</th>
                    <th className="py-3 px-4">GRO</th>
                    <th className="py-3 px-4">Act 0{currentActNumber}</th>
                    <th className="py-3 px-4 text-right">Composite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E2D2A]">
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
                        className="hover:bg-[#1C1C19] transition"
                      >
                        <th className="py-3 px-4 font-bold text-[#FAF7F0]">
                          TABLE {pad2(tNum)} ({t.players.length}/5)
                        </th>
                        <td className="py-3 px-4">
                          <span className="text-[#A8A29E] mr-2">
                            ARENA {pad2(t.arenaNumber)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              isAegis
                                ? "bg-[#1846C7] text-[#FAF7F0]"
                                : "bg-[#C84B15] text-[#FAF7F0]"
                            }`}
                          >
                            {t.shortName}
                          </span>
                        </td>
                        <td className="py-3 px-4">{t.currentMetrics.security}</td>
                        <td className="py-3 px-4">
                          {t.currentMetrics.capability}
                        </td>
                        <td className="py-3 px-4">{t.currentMetrics.trust}</td>
                        <td className="py-3 px-4">{t.currentMetrics.growth}</td>
                        <td className="py-3 px-4 uppercase">
                          {actUnlocked ? (
                            <span className="text-[#4ADE80] font-bold">
                              [DECLASSIFIED]
                            </span>
                          ) : actLocked ? (
                            <span className="text-[#FACC15] font-bold">
                              [BALLOT FILED]
                            </span>
                          ) : (
                            <span className="text-[#78716C]">[OPEN]</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-sm text-[#FAF7F0]">
                          {t.totalScore}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Wire-Service Audit Log */}
          <div className="lg:col-span-4 border-2 border-[#2E2D2A] bg-[#121211] flex flex-col h-[500px]">
            <div className="px-4 py-3 border-b border-[#2E2D2A] bg-[#161614] font-mono-tech text-xs uppercase font-bold text-[#A8A29E] flex items-center justify-between">
              <span>§ 4. LIVE SITREP WIRE FEED</span>
              <span>REAL-TIME</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3 font-mono-tech text-xs divide-y divide-[#2E2D2A]">
              {state.auditLogs.map((log) => (
                <div key={log.id} className="pt-2.5 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[#A8A29E] uppercase">
                    <span className="font-bold text-[#F2EDE2]">
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
                  <div className="text-[#D6D0C4] leading-relaxed">
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
