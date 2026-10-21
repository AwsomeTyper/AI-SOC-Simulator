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
      <div className="min-h-screen flex items-center justify-center font-mono-tech text-xs uppercase tracking-widest text-[#57534E]">
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
    <div className="min-h-screen pb-16">
      {/* Minimal Dossier Header */}
      <header className="bg-[#FAF7F0] border-b-2 border-[#121211] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between font-mono-tech text-xs uppercase">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-2.5 py-1 border border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] font-bold transition"
            >
              ← Player View
            </Link>
            <span className="font-bold text-sm">Admin Debrief</span>
          </div>

          <Link
            href="/gm"
            className="px-2.5 py-1 border border-[#121211] bg-[#121211] text-[#FAF7F0] font-bold"
          >
            Host Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Arena & Act Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono-tech text-xs">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((arenaNum) => {
              const pkg = data.arenaDebriefs[`${arenaNum}-${selectedAct}`];
              const isSelected = selectedArena === arenaNum;
              return (
                <button
                  key={arenaNum}
                  type="button"
                  onClick={() => setSelectedArena(arenaNum)}
                  className={`px-3.5 py-2 border-2 border-[#121211] uppercase font-bold transition flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-[#121211] text-[#FAF7F0]"
                      : "bg-[#FAF7F0] text-[#121211] hover:bg-[#E6DFD1]"
                  }`}
                >
                  <span>Arena {arenaNum}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      pkg.unlocked
                        ? "bg-[#4ADE80]"
                        : pkg.bothTeamsSubmitted
                        ? "bg-[#FACC15]"
                        : "bg-[#A8A29E]"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="inline-flex border-2 border-[#121211] divide-x-2 divide-[#121211] bg-[#FAF7F0]">
            {([1, 2, 3] as const).map((actNum) => (
              <button
                key={actNum}
                type="button"
                onClick={() => setSelectedAct(actNum)}
                className={`px-3.5 py-2 uppercase font-bold transition cursor-pointer ${
                  selectedAct === actNum
                    ? "bg-[#C8322B] text-[#FAF7F0]"
                    : "text-[#121211] hover:bg-[#E6DFD1]"
                }`}
              >
                Act {actNum}
              </button>
            ))}
          </div>
        </div>

        {/* Main Debrief Dossier Sheet */}
        <div className="dossier-sheet p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#121211] pb-4">
            <div>
              <span className="stamp-badge text-[#121211]">
                Arena {selectedArena} • Act {selectedAct}
              </span>
              <h1 className="text-xl font-bold uppercase mt-2">
                Table {oddTableNum} (Aegis) vs. Table {evenTableNum} (Vanguard)
              </h1>
            </div>

            {!debriefPkg.unlocked ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleUnlockArena(true)}
                className="px-5 py-3 border-2 border-[#121211] bg-[#166534] hover:bg-[#14532d] text-[#FAF7F0] font-mono-tech text-xs uppercase font-bold shadow-[3px_3px_0px_#121211] transition cursor-pointer"
              >
                Unlock Results for Arena {selectedArena} →
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleUnlockArena(false)}
                className="px-4 py-2 border-2 border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] font-mono-tech text-xs uppercase font-bold transition cursor-pointer"
              >
                Unlocked (Tap to Re-lock)
              </button>
            )}
          </div>

          {/* 3-Bullet Read-Aloud Summary */}
          <div className="space-y-3">
            <div className="font-mono-tech text-xs font-bold uppercase text-[#57534E]">
              Read Aloud to Tables {oddTableNum} &amp; {evenTableNum}:
            </div>
            <ul className="space-y-3 font-editorial text-lg leading-relaxed">
              <li className="p-4 border-2 border-[#121211] bg-[#F2EDE2]">
                <strong className="font-mono-tech text-xs uppercase text-[#1846C7] block mb-1">
                  Table {oddTableNum} (Aegis AI):
                </strong>
                {debriefPkg.readAloudScript.aegisSummary}
              </li>
              <li className="p-4 border-2 border-[#121211] bg-[#F2EDE2]">
                <strong className="font-mono-tech text-xs uppercase text-[#C84B15] block mb-1">
                  Table {evenTableNum} (Vanguard AI):
                </strong>
                {debriefPkg.readAloudScript.vanguardSummary}
              </li>
              <li className="p-4 border-2 border-[#121211] bg-[#FAF7F0]">
                <strong className="font-mono-tech text-xs uppercase text-[#166534] block mb-1">
                  Takeaway:
                </strong>
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
                className="dossier-sheet p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`font-mono-tech text-xs uppercase font-bold ${
                        isAegis ? "text-[#1846C7]" : "text-[#C84B15]"
                      }`}
                    >
                      {tbl.shortName}
                    </span>
                    <h2 className="text-lg font-bold uppercase">
                      Table {tbl.tableNumber} ({tbl.totalScore} pts)
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono-tech text-xs">
                    <span className="text-[#57534E] mr-1">
                      Bonus:{" "}
                      {currentBonus >= 0 ? `+${currentBonus}` : currentBonus}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAdjustBonus(tbl.tableNumber, -5)}
                      className="px-2.5 py-1 border border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] font-bold cursor-pointer"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAdjustBonus(tbl.tableNumber, 5)}
                      className="px-2.5 py-1 border border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] font-bold cursor-pointer"
                    >
                      +5
                    </button>
                  </div>
                </div>

                <div className="p-3 border border-[#121211] bg-[#F2EDE2] font-mono-tech text-xs">
                  <div className="text-[#57534E] uppercase text-[10px]">
                    Team Choice:
                  </div>
                  <div className="font-bold uppercase mt-0.5">
                    {res.teamDecisionTitle}
                  </div>
                </div>

                <details className="font-mono-tech text-xs">
                  <summary className="cursor-pointer font-bold uppercase text-[#57534E]">
                    + View 5 individual role moves
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {res.departmentBreakdown.map((dept) => (
                      <div
                        key={dept.roleId}
                        className="p-2.5 border border-[#121211] bg-[#F2EDE2] flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold uppercase">
                            {dept.roleTitle}:
                          </span>{" "}
                          <span>{dept.optionLabel}</span>
                        </div>
                        <span className="uppercase text-[10px] font-bold shrink-0">
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
