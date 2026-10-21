"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getArenaTables } from "@/lib/scenario";
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
          adminName: "Admin",
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
          adminName: "Admin",
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
      <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  const debriefPkg = data.arenaDebriefs[`${selectedArena}-${selectedAct}`];
  const [oddTableNum, evenTableNum] = getArenaTables(selectedArena);
  const aegisTable = data.computedTables[oddTableNum];
  const vanguardTable = data.computedTables[evenTableNum];
  const actKey = String(selectedAct);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 pb-16">
      {/* Minimal Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              ← Player View
            </Link>
            <span className="text-neutral-300">|</span>
            <span className="font-semibold text-sm">Admin Debrief</span>
          </div>

          <Link
            href="/gm"
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            Host Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Arena & Act Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((arenaNum) => {
              const pkg = data.arenaDebriefs[`${arenaNum}-${selectedAct}`];
              const isSelected = selectedArena === arenaNum;
              return (
                <button
                  key={arenaNum}
                  type="button"
                  onClick={() => setSelectedArena(arenaNum)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  <span>Arena {arenaNum}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      pkg.unlocked
                        ? "bg-emerald-400"
                        : pkg.bothTeamsSubmitted
                        ? "bg-amber-400"
                        : "bg-neutral-300"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="inline-flex p-1 rounded-xl bg-neutral-200/70 text-xs font-medium">
            {([1, 2, 3] as const).map((actNum) => (
              <button
                key={actNum}
                type="button"
                onClick={() => setSelectedAct(actNum)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  selectedAct === actNum
                    ? "bg-white text-neutral-900 shadow-2xs font-semibold"
                    : "text-neutral-600"
                }`}
              >
                Act {actNum}
              </button>
            ))}
          </div>
        </div>

        {/* Main Debrief Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-4">
            <div>
              <span className="text-xs text-neutral-500">
                Arena {selectedArena} • Act {selectedAct}
              </span>
              <h1 className="text-xl font-bold mt-0.5">
                Table {oddTableNum} (Aegis) vs. Table {evenTableNum} (Vanguard)
              </h1>
            </div>

            {!debriefPkg.unlocked ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleUnlockArena(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                Unlock Results for Arena {selectedArena}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleUnlockArena(false)}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium transition cursor-pointer"
              >
                Unlocked (Tap to Re-lock)
              </button>
            )}
          </div>

          {/* 3-Bullet Read-Aloud Summary */}
          <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Read Out Loud to Tables {oddTableNum} &amp; {evenTableNum}:
            </div>
            <ul className="space-y-2.5">
              <li className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
                <strong className="text-blue-700">
                  Table {oddTableNum} (Aegis AI):
                </strong>{" "}
                {debriefPkg.readAloudScript.aegisSummary}
              </li>
              <li className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-100">
                <strong className="text-orange-700">
                  Table {evenTableNum} (Vanguard AI):
                </strong>{" "}
                {debriefPkg.readAloudScript.vanguardSummary}
              </li>
              <li className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                <strong className="text-neutral-900">Takeaway:</strong>{" "}
                {debriefPkg.readAloudScript.crossArenaCollision}
              </li>
            </ul>
          </div>
        </div>

        {/* Two Simple Table Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[aegisTable, vanguardTable].map((tbl) => {
            const isAegis = tbl.labId === "aegis";
            const res = tbl.actResolutions[actKey];
            const currentBonus = tbl.adminBonusByAct[actKey] || 0;

            return (
              <div
                key={tbl.tableNumber}
                className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-xs font-semibold ${
                        isAegis ? "text-blue-600" : "text-orange-600"
                      }`}
                    >
                      {tbl.shortName}
                    </span>
                    <h2 className="text-base font-bold">
                      Table {tbl.tableNumber} ({tbl.totalScore} pts)
                    </h2>
                  </div>

                  {/* Simple Bonus Buttons */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-neutral-400 mr-1">
                      Bonus: {currentBonus >= 0 ? `+${currentBonus}` : currentBonus}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAdjustBonus(tbl.tableNumber, -5)}
                      className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 font-medium cursor-pointer"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAdjustBonus(tbl.tableNumber, 5)}
                      className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 font-medium cursor-pointer"
                    >
                      +5
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                  <div className="text-neutral-400">Team Choice:</div>
                  <div className="font-semibold text-neutral-900 mt-0.5">
                    {res.teamDecisionTitle}
                  </div>
                </div>

                <details className="text-xs text-neutral-500">
                  <summary className="cursor-pointer font-medium text-neutral-600">
                    View 5 individual role moves
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {res.departmentBreakdown.map((dept) => (
                      <div
                        key={dept.roleId}
                        className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-semibold text-neutral-800">
                            {dept.roleTitle}:
                          </span>{" "}
                          <span>{dept.optionLabel}</span>
                        </div>
                        <span className="uppercase text-[10px] font-semibold text-neutral-400 shrink-0">
                          {dept.evaluation}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
