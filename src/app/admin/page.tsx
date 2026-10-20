"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export default function RoamingAdminConsolePage() {
  const [data, setData] = useState<SimApiPayload | null>(null);
  const [adminIdentity, setAdminIdentity] = useState(
    "FIELD ADMIN 01 (ARENAS 01–02)"
  );
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
      <div className="min-h-screen dossier-surface flex items-center justify-center p-6">
        <div className="dossier-sheet px-8 py-6 font-mono-tech text-xs uppercase tracking-widest">
          [ LOADING FIELD ADJUDICATION CLIPBOARD... ]
        </div>
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
    <div className="min-h-screen dossier-surface text-[#121211] pb-16">
      {/* Top Field Adjudicator Masthead */}
      <header className="border-b-2 border-[#121211] bg-[#FAF7F0] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="px-3 py-1.5 border-2 border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] font-mono-tech text-xs uppercase font-bold transition"
            >
              ← Table View
            </Link>
            <div>
              <div className="font-mono-tech text-[10px] uppercase tracking-widest text-[#C8322B] font-bold">
                3-FACILITATOR FIELD CLIPBOARD // ADJUDICATION &amp; VERBAL DEBRIEF
              </div>
              <h1 className="text-lg sm:text-xl font-bold uppercase tracking-tight">
                Arena Read-Aloud Script &amp; Release Control
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap font-mono-tech text-xs">
            <select
              aria-label="Select Field Admin Callsign"
              value={adminIdentity}
              onChange={(e) => setAdminIdentity(e.target.value)}
              className="px-3 py-2 border-2 border-[#121211] bg-[#F2EDE2] font-bold uppercase text-xs"
            >
              <option value="FIELD ADMIN 01 (ARENAS 01–02)">
                FIELD ADMIN 01 (ARENAS 01–02)
              </option>
              <option value="FIELD ADMIN 02 (ARENAS 03–04)">
                FIELD ADMIN 02 (ARENAS 03–04)
              </option>
              <option value="FIELD ADMIN 03 (ARENA 05 & FLOATING)">
                FIELD ADMIN 03 (ARENA 05 &amp; FLOATING)
              </option>
            </select>

            <Link
              href="/gm"
              className="px-3 py-2 border-2 border-[#121211] bg-[#121211] text-[#FAF7F0] uppercase font-bold"
            >
              War Room Board
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Arena & Act Selector Matrix */}
        <div className="dossier-sheet">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-[#121211]">
            <div className="lg:col-span-8 p-5">
              <div className="font-mono-tech text-xs uppercase font-bold mb-3">
                § 1. Select Arena Station (Tables 01–10)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 border-2 border-[#121211] divide-y sm:divide-y-0 sm:divide-x divide-[#121211]">
                {[1, 2, 3, 4, 5].map((arenaNum) => {
                  const [tA, tB] = getArenaTables(arenaNum);
                  const pkg = data.arenaDebriefs[`${arenaNum}-${selectedAct}`];
                  const isSelected = selectedArena === arenaNum;
                  return (
                    <button
                      key={arenaNum}
                      type="button"
                      onClick={() => setSelectedArena(arenaNum)}
                      className={`p-3 text-left font-mono-tech transition cursor-pointer ${
                        isSelected
                          ? "bg-[#121211] text-[#FAF7F0]"
                          : "bg-[#FAF7F0] hover:bg-[#F2EDE2] text-[#121211]"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase">
                        ARENA {pad2(arenaNum)}
                      </div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? "text-[#D6D0C4]" : "text-[#57534E]"
                        }`}
                      >
                        T{pad2(tA)} vs T{pad2(tB)}
                      </div>
                      <div className="mt-2 text-[10px] uppercase font-bold">
                        {pkg.unlocked ? (
                          <span
                            className={
                              isSelected ? "text-[#86EFAC]" : "text-[#166534]"
                            }
                          >
                            [DECLASSIFIED]
                          </span>
                        ) : pkg.bothTeamsSubmitted ? (
                          <span
                            className={
                              isSelected ? "text-[#FDE047]" : "text-[#C8322B]"
                            }
                          >
                            [READY TO READ]
                          </span>
                        ) : (
                          <span className="opacity-60">[DELIBERATING]</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 p-5 bg-[#F2EDE2]">
              <div className="font-mono-tech text-xs uppercase font-bold mb-3">
                § 2. Select Crisis Act (01–03)
              </div>
              <div className="grid grid-cols-3 border-2 border-[#121211] divide-x divide-[#121211]">
                {([1, 2, 3] as const).map((actNum) => {
                  const active = selectedAct === actNum;
                  return (
                    <button
                      key={actNum}
                      type="button"
                      onClick={() => setSelectedAct(actNum)}
                      className={`p-3 text-center font-mono-tech transition cursor-pointer ${
                        active
                          ? "bg-[#C8322B] text-[#FAF7F0] font-bold"
                          : "bg-[#FAF7F0] hover:bg-white text-[#121211]"
                      }`}
                    >
                      <div className="text-xs font-bold">ACT 0{actNum}</div>
                      <div className="text-[10px] mt-1 uppercase">
                        {actNum === 1
                          ? "Hub"
                          : actNum === 2
                          ? "Swarm"
                          : "Launch"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-Step Release Control Bar */}
        <div
          className={`dossier-sheet p-6 flex flex-wrap items-center justify-between gap-4 ${
            debriefPkg.unlocked ? "bg-[#F2EDE2]" : "bg-[#FAF7F0]"
          }`}
        >
          <div className="space-y-1">
            <div className="font-mono-tech text-xs uppercase font-bold">
              {debriefPkg.unlocked ? (
                <span className="text-[#166534]">
                  ● STATUS: DECLASSIFIED — STUDENTS AT TABLES {pad2(oddTableNum)}{" "}
                  &amp; {pad2(evenTableNum)} CAN NOW VIEW THIS REPORT
                </span>
              ) : (
                <span className="text-[#C8322B]">
                  ● STATUS: SEALED — READ CUE SHEET BELOW ALOUD, THEN CLICK DECLASSIFY
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold uppercase tracking-tight">
              Arena {pad2(selectedArena)}: Table {pad2(oddTableNum)} (Aegis AI) vs.
              Table {pad2(evenTableNum)} (Vanguard AI)
            </h2>
            <p className="font-mono-tech text-xs text-[#57534E] uppercase">
              {actDef.title}
            </p>
          </div>

          <div>
            {!debriefPkg.unlocked ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleUnlockArena(true)}
                className="px-6 py-4 border-2 border-[#121211] bg-[#166534] hover:bg-[#14532d] text-[#FAF7F0] font-mono-tech text-xs uppercase tracking-widest font-bold shadow-[4px_4px_0px_#121211] transition cursor-pointer"
              >
                [Declassify &amp; Unlock Arena {pad2(selectedArena)} Results] →
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggleUnlockArena(false)}
                className="px-5 py-3 border-2 border-[#121211] bg-[#FAF7F0] hover:bg-[#121211] hover:text-[#FAF7F0] font-mono-tech text-xs uppercase font-bold transition cursor-pointer"
              >
                [Re-Seal Results]
              </button>
            )}
          </div>
        </div>

        {/* VERBAL READ-ALOUD CUE SHEET */}
        <div className="dossier-sheet">
          <div className="border-b-2 border-[#121211] bg-[#121211] text-[#FAF7F0] px-6 py-3 flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs uppercase">
            <span>
              VERBAL DEBRIEF CUE SHEET // READ ALOUD TO TABLES {pad2(oddTableNum)}{" "}
              &amp; {pad2(evenTableNum)}
            </span>
            <span>AUTO-COMPILED FROM TABLE BALLOTS</span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-l-4 border-[#121211] pl-4 py-1">
              <div className="font-mono-tech text-[11px] uppercase text-[#57534E] font-bold">
                CUE 01 // ATTENTION CALL
              </div>
              <p className="font-editorial text-xl text-[#121211] mt-1">
                &ldquo;{debriefPkg.readAloudScript.openingHook}&rdquo;
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-2 border-[#121211] bg-[#F2EDE2] p-5 space-y-2">
                <div className="font-mono-tech text-xs uppercase font-bold text-[#1846C7]">
                  CUE 02 // TABLE {pad2(oddTableNum)} (AEGIS AI) OUTCOME
                </div>
                <p className="font-editorial text-lg leading-relaxed text-[#121211]">
                  &ldquo;{debriefPkg.readAloudScript.aegisSummary}&rdquo;
                </p>
              </div>

              <div className="border-2 border-[#121211] bg-[#F2EDE2] p-5 space-y-2">
                <div className="font-mono-tech text-xs uppercase font-bold text-[#C84B15]">
                  CUE 03 // TABLE {pad2(evenTableNum)} (VANGUARD AI) OUTCOME
                </div>
                <p className="font-editorial text-lg leading-relaxed text-[#121211]">
                  &ldquo;{debriefPkg.readAloudScript.vanguardSummary}&rdquo;
                </p>
              </div>
            </div>

            <div className="border-2 border-[#121211] bg-[#FAF7F0] p-5 space-y-2">
              <div className="font-mono-tech text-xs uppercase font-bold text-[#C8322B]">
                CUE 04 // CROSS-ARENA COLLISION &amp; CONSEQUENCES
              </div>
              <p className="font-editorial text-xl leading-relaxed text-[#121211]">
                &ldquo;{debriefPkg.readAloudScript.crossArenaCollision}&rdquo;
              </p>
            </div>

            <div className="border-2 border-[#121211] bg-[#E6DFD1] p-5 space-y-2">
              <div className="font-mono-tech text-xs uppercase font-bold text-[#166534]">
                CUE 05 // APPLICABLE SOC &amp; AI SECURITY LESSON
              </div>
              <p className="text-sm leading-relaxed text-[#121211] font-medium">
                &ldquo;{debriefPkg.readAloudScript.socTakeaway}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* SIDE-BY-SIDE TABLE AUDIT & ADJUDICATION BONUS STAMPS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[aegisTable, vanguardTable].map((tbl) => {
            const isAegis = tbl.labId === "aegis";
            const res = tbl.actResolutions[actKey];
            const currentBonus = tbl.adminBonusByAct[actKey] || 0;

            return (
              <div key={tbl.tableNumber} className="dossier-sheet">
                <div className="border-b-2 border-[#121211] bg-[#E6DFD1] px-5 py-3 flex items-center justify-between font-mono-tech text-xs uppercase">
                  <span
                    className={`font-bold ${
                      isAegis ? "text-[#1846C7]" : "text-[#C84B15]"
                    }`}
                  >
                    TABLE {pad2(tbl.tableNumber)} // {tbl.shortName}
                  </span>
                  <span className="font-bold">
                    COMPOSITE: {tbl.totalScore} PTS
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  {/* Admin Discussion Bonus Stamp Bar */}
                  <div className="border-2 border-[#121211] bg-[#F2EDE2] p-3.5 flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
                    <div>
                      <div className="text-[10px] text-[#57534E] uppercase">
                        VERBAL TABLEWORK MERIT ADJUSTMENT
                      </div>
                      <div className="font-bold">
                        ACT 0{selectedAct} BONUS:{" "}
                        {currentBonus >= 0 ? `+${currentBonus}` : currentBonus}{" "}
                        PTS
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdjustBonus(tbl.tableNumber, -5)}
                        className="px-2.5 py-1.5 border border-[#121211] bg-[#FAF7F0] hover:bg-[#C8322B] hover:text-[#FAF7F0] font-bold cursor-pointer"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdjustBonus(tbl.tableNumber, 5)}
                        className="px-2.5 py-1.5 border border-[#121211] bg-[#FAF7F0] hover:bg-[#166534] hover:text-[#FAF7F0] font-bold cursor-pointer"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdjustBonus(tbl.tableNumber, 10)}
                        className="px-2.5 py-1.5 border border-[#121211] bg-[#121211] text-[#FAF7F0] hover:bg-[#166534] font-bold cursor-pointer"
                      >
                        +10
                      </button>
                    </div>
                  </div>

                  <div className="border border-[#121211] p-3.5 bg-[#FAF7F0] font-mono-tech text-xs space-y-1">
                    <div className="text-[10px] text-[#57534E] uppercase">
                      RATIFIED TABLE RESOLUTION:
                    </div>
                    <div className="font-bold text-sm uppercase">
                      {res.teamDecisionTitle}
                    </div>
                    <div className="pt-1 text-[11px] text-[#44403C]">
                      NET ACT DELTA: SEC{" "}
                      {res.totalDelta.security >= 0
                        ? `+${res.totalDelta.security}`
                        : res.totalDelta.security}{" "}
                      | CAP{" "}
                      {res.totalDelta.capability >= 0
                        ? `+${res.totalDelta.capability}`
                        : res.totalDelta.capability}{" "}
                      | TRU{" "}
                      {res.totalDelta.trust >= 0
                        ? `+${res.totalDelta.trust}`
                        : res.totalDelta.trust}{" "}
                      | GRO{" "}
                      {res.totalDelta.growth >= 0
                        ? `+${res.totalDelta.growth}`
                        : res.totalDelta.growth}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-mono-tech text-[11px] uppercase font-bold text-[#57534E]">
                      Specialist Directives Filed:
                    </div>
                    <div className="divide-y divide-[#121211] border border-[#121211]">
                      {res.departmentBreakdown.map((dept) => (
                        <div
                          key={dept.roleId}
                          className="p-3 bg-[#FAF7F0] font-mono-tech text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold uppercase">
                              {dept.roleTitle}{" "}
                              {dept.playerNames.length > 0 &&
                                `(${dept.playerNames.join(", ")})`}
                            </span>
                            <span className="uppercase text-[10px] px-1.5 py-0.5 border border-[#121211]">
                              {dept.evaluation}
                            </span>
                          </div>
                          <div className="text-[#44403C] text-[11px]">
                            {dept.optionLabel}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
