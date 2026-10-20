"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Unlock,
  Lock,
  Mic,
  CheckCircle2,
  Clock,
  Plus,
  Minus,
  Users,
  BookOpen,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { ACTS, getArenaTables } from "@/lib/scenario";
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

export default function RoamingAdminConsolePage() {
  const [data, setData] = useState<SimApiPayload | null>(null);
  const [adminIdentity, setAdminIdentity] = useState("Admin 1 (Arenas 1–2)");
  const [selectedArena, setSelectedArena] = useState<number>(1);
  const [selectedAct, setSelectedAct] = useState<1 | 2 | 3>(1);
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
    const interval = setInterval(fetchSim, 2000);
    return () => clearInterval(interval);
  }, [fetchSim]);

  // Sync selectedAct when global phase advances
  useEffect(() => {
    if (!data) return;
    if (data.state.phase === "act1") setSelectedAct(1);
    else if (data.state.phase === "act2") setSelectedAct(2);
    else if (data.state.phase === "act3") setSelectedAct(3);
  }, [data?.state.phase]);

  async function handleToggleUnlockArena(unlock: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin_unlock_arena_act",
          arenaNumber: selectedArena,
          actNumber: selectedAct,
          unlocked: unlock,
          adminName: adminIdentity,
        }),
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAdjustBonus(tableNumber: number, delta: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin_adjust_bonus",
          tableNumber,
          actNumber: selectedAct,
          delta,
          adminName: adminIdentity,
        }),
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
        Loading Roaming Admin Console...
      </div>
    );
  }

  const debriefPkg = data.arenaDebriefs[`${selectedArena}-${selectedAct}`];
  const [oddTableNum, evenTableNum] = getArenaTables(selectedArena);
  const aegisTable = data.computedTables[oddTableNum];
  const vanguardTable = data.computedTables[evenTableNum];
  const actKey = String(selectedAct);
  const actDef = ACTS[selectedAct];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pb-16">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0b1120]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="Back to Student View"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">
                  ROAMING ADMIN DEBRIEF CONSOLE
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  3-Admin Field Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Walk up to your Arena, read the Act outcome summary out loud, then tap Unlock Results.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              aria-label="Select Roaming Admin Identity"
              value={adminIdentity}
              onChange={(e) => setAdminIdentity(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-medium"
            >
              <option value="Admin 1 (Arenas 1–2)">Admin 1 (Arenas 1–2)</option>
              <option value="Admin 2 (Arenas 3–4)">Admin 2 (Arenas 3–4)</option>
              <option value="Admin 3 (Arena 5 & Floating)">
                Admin 3 (Arena 5 & Floating)
              </option>
            </select>

            <Link
              href="/gm"
              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium"
            >
              GM Projector View
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Arena & Act Switcher Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs font-mono uppercase text-slate-400 mb-2.5">
              1. Select Physical Arena (Tables 1–10)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((arenaNum) => {
                const [tA, tB] = getArenaTables(arenaNum);
                const pkg = data.arenaDebriefs[`${arenaNum}-${selectedAct}`];
                const isSelected = selectedArena === arenaNum;
                return (
                  <button
                    key={arenaNum}
                    type="button"
                    onClick={() => setSelectedArena(arenaNum)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-indigo-500/20 border-indigo-400 ring-2 ring-indigo-400/30"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">
                        Arena {arenaNum}
                      </span>
                      {pkg.unlocked ? (
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      ) : pkg.bothTeamsSubmitted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                      T{tA} vs T{tB}
                    </div>
                    <div className="mt-1.5 text-[10px] font-mono">
                      {pkg.unlocked ? (
                        <span className="text-emerald-400">Unlocked</span>
                      ) : pkg.bothTeamsSubmitted ? (
                        <span className="text-amber-300 font-semibold">
                          Ready to Read!
                        </span>
                      ) : (
                        <span className="text-slate-500">Deciding...</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs font-mono uppercase text-slate-400 mb-2.5">
              2. Select Crisis Act (1–3)
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((actNum) => (
                <button
                  key={actNum}
                  type="button"
                  onClick={() => setSelectedAct(actNum)}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    selectedAct === actNum
                      ? "bg-cyan-500/20 border-cyan-400 text-white font-bold"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="text-sm font-bold">Act {actNum}</div>
                  <div className="text-[10px] font-mono mt-1">
                    {actNum === 1
                      ? "Hub Breach"
                      : actNum === 2
                      ? "Agent Swarm"
                      : "Extortion"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PRIMARY ADMIN ACTION BANNER: READ SCRIPT & UNLOCK */}
        <div
          className={`rounded-2xl border p-6 flex flex-wrap items-center justify-between gap-4 ${
            debriefPkg.unlocked
              ? "bg-emerald-950/30 border-emerald-500/40"
              : "bg-indigo-950/30 border-indigo-500/40"
          }`}
        >
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-mono uppercase">
              {debriefPkg.unlocked ? (
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <Unlock className="w-4 h-4" /> Arena {selectedArena} • Act{" "}
                  {selectedAct} Results Are Live on Student Screens
                </span>
              ) : (
                <span className="text-amber-300 flex items-center gap-1 font-semibold">
                  <Lock className="w-4 h-4" /> Step 1: Read Summary Below to Tables{" "}
                  {oddTableNum} & {evenTableNum} → Step 2: Tap Unlock
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Arena {selectedArena} Debrief: Table {oddTableNum} (Aegis AI) vs. Table{" "}
              {evenTableNum} (Vanguard AI)
            </h1>
            <p className="text-xs text-slate-300">{actDef.title}</p>
          </div>

          <div className="flex items-center gap-3">
            {!debriefPkg.unlocked ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleUnlockArena(true)}
                className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
              >
                <Unlock className="w-5 h-5" />
                <span>
                  Unlock Act {selectedAct} Results for Arena {selectedArena}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleUnlockArena(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Re-Lock Results</span>
              </button>
            )}
          </div>
        </div>

        {/* WORD-FOR-WORD READ-ALOUD SCRIPT FOR THE ROAMING ADMIN */}
        <div className="rounded-2xl border border-indigo-500/40 bg-slate-900/90 p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-indigo-300 font-mono text-xs uppercase font-bold">
              <Mic className="w-4 h-4 text-indigo-400" />
              <span>
                Admin Read-Aloud Debrief Script (Read to Tables {oddTableNum} &{" "}
                {evenTableNum})
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Auto-generated from both tables&apos; live choices
            </span>
          </div>

          <div className="space-y-4 text-sm sm:text-base leading-relaxed">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div className="text-xs font-mono uppercase text-slate-400 mb-1">
                1. Opening
              </div>
              &ldquo;{debriefPkg.readAloudScript.openingHook}&rdquo;
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-sky-950/25 border border-sky-500/30 text-slate-100">
                <div className="text-xs font-mono uppercase text-sky-400 mb-1 font-semibold">
                  2. Table {oddTableNum} (Aegis AI) Outcome
                </div>
                &ldquo;{debriefPkg.readAloudScript.aegisSummary}&rdquo;
              </div>

              <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/30 text-slate-100">
                <div className="text-xs font-mono uppercase text-amber-400 mb-1 font-semibold">
                  3. Table {evenTableNum} (Vanguard AI) Outcome
                </div>
                &ldquo;{debriefPkg.readAloudScript.vanguardSummary}&rdquo;
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-950/25 border border-purple-500/30 text-slate-100">
              <div className="text-xs font-mono uppercase text-purple-300 mb-1 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> 4. How the Two Tables&apos;
                Choices Collided
              </div>
              &ldquo;{debriefPkg.readAloudScript.crossArenaCollision}&rdquo;
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-slate-100">
              <div className="text-xs font-mono uppercase text-emerald-300 mb-1 font-semibold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> 5. Real-World AI/SOC
                Takeaway
              </div>
              &ldquo;{debriefPkg.readAloudScript.socTakeaway}&rdquo;
            </div>
          </div>
        </div>

        {/* SIDE-BY-SIDE TABLE DETAILS & DISCUSSION BONUS CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[aegisTable, vanguardTable].map((tbl) => {
            const isAegis = tbl.labId === "aegis";
            const res = tbl.actResolutions[actKey];
            const currentBonus = tbl.adminBonusByAct[actKey] || 0;

            return (
              <div
                key={tbl.tableNumber}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span
                      className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${
                        isAegis
                          ? "bg-sky-500/15 text-sky-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      Table {tbl.tableNumber} • {tbl.shortName}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">
                      Total Score: {tbl.totalScore} pts
                    </h3>
                  </div>

                  {/* Admin Verbal Discussion Bonus Buttons */}
                  <div className="text-right">
                    <div className="text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Admin Discussion Bonus ({currentBonus >= 0 ? `+${currentBonus}` : currentBonus})
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdjustBonus(tbl.tableNumber, -5)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" /> 5
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdjustBonus(tbl.tableNumber, 5)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> 5
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdjustBonus(tbl.tableNumber, 10)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> 10
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="text-slate-400 font-mono uppercase">
                    Official Table Strategy (Act {selectedAct}):
                  </div>
                  <div className="font-bold text-white text-sm">
                    {res.teamDecisionTitle}
                  </div>
                  <div className="text-cyan-300 font-mono">
                    Act {selectedAct} Net Delta: Security{" "}
                    {res.totalDelta.security >= 0
                      ? `+${res.totalDelta.security}`
                      : res.totalDelta.security}{" "}
                    | Capability{" "}
                    {res.totalDelta.capability >= 0
                      ? `+${res.totalDelta.capability}`
                      : res.totalDelta.capability}{" "}
                    | Trust{" "}
                    {res.totalDelta.trust >= 0
                      ? `+${res.totalDelta.trust}`
                      : res.totalDelta.trust}{" "}
                    | Growth{" "}
                    {res.totalDelta.growth >= 0
                      ? `+${res.totalDelta.growth}`
                      : res.totalDelta.growth}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Department Role Choices:
                  </div>
                  {res.departmentBreakdown.map((dept) => (
                    <div
                      key={dept.roleId}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          {dept.roleTitle}{" "}
                          {dept.playerNames.length > 0 && (
                            <span className="text-slate-400 font-normal">
                              ({dept.playerNames.join(", ")})
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                            dept.evaluation === "optimal"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : dept.evaluation === "risky"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {dept.evaluation}
                        </span>
                      </div>
                      <div className="text-slate-300">{dept.optionLabel}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
