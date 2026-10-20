"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ACTS,
  getTableArenaNumber,
  getTableLabId,
  LAB_PROFILES,
  RoleId,
  ROLES,
} from "@/lib/scenario";
import type {
  ArenaDebriefPackage,
  ComputedTableView,
  PlayerRecord,
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

export default function StudentSimulatorPage() {
  const [data, setData] = useState<SimApiPayload | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [selectedTable, setSelectedTable] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"role" | "team" | "results">(
    "role"
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSimState = useCallback(async () => {
    try {
      const res = await fetch("/api/sim", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as SimApiPayload;
      setData(json);
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    const savedId = window.localStorage.getItem("ai_soc_player_id");
    if (savedId) setPlayerId(savedId);
    void fetchSimState();
    const interval = setInterval(fetchSimState, 2000);
    return () => clearInterval(interval);
  }, [fetchSimState]);

  const currentPlayer: PlayerRecord | null =
    data && playerId && data.state.players[playerId]
      ? data.state.players[playerId]
      : null;

  const currentActNumber: 1 | 2 | 3 =
    data?.state.phase === "act2"
      ? 2
      : data?.state.phase === "act3"
      ? 3
      : 1;

  const myTable: ComputedTableView | null =
    data && currentPlayer
      ? data.computedTables[currentPlayer.tableNumber]
      : null;

  const isCurrentActUnlocked = Boolean(
    myTable?.unlockedActs[String(currentActNumber)]
  );

  useEffect(() => {
    if (isCurrentActUnlocked) {
      setActiveTab("results");
    }
  }, [isCurrentActUnlocked, currentActNumber]);

  async function handleJoinTable(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join_table",
          name: joinName.trim(),
          tableNumber: selectedTable,
          playerId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to register seat.");
      } else {
        setData(json);
        if (json.joinedPlayer?.id) {
          setPlayerId(json.joinedPlayer.id);
          window.localStorage.setItem("ai_soc_player_id", json.joinedPlayer.id);
        }
      }
    } catch {
      setErrorMsg("Transmission error while registering seat.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(newRole: RoleId) {
    if (!currentPlayer) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_player_role",
          playerId: currentPlayer.id,
          roleId: newRole,
        }),
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectDepartmentAction(optionId: string) {
    if (!currentPlayer) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_department_action",
          playerId: currentPlayer.id,
          actNumber: currentActNumber,
          optionId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Could not record directive.");
      } else {
        setData(json);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectTeamDecision(decisionId: string) {
    if (!currentPlayer) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_team_decision",
          tableNumber: currentPlayer.tableNumber,
          actNumber: currentActNumber,
          decisionId,
          actorName: currentPlayer.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Could not ratify table resolution.");
      } else {
        setData(json);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleLeaveSession() {
    window.localStorage.removeItem("ai_soc_player_id");
    setPlayerId(null);
  }

  if (!data) {
    return (
      <div className="min-h-screen dossier-surface flex items-center justify-center p-6">
        <div className="dossier-sheet px-8 py-6 font-mono-tech text-xs uppercase tracking-widest">
          [ INITIALIZING TACTICAL DOSSIER TERMINAL // STAND BY... ]
        </div>
      </div>
    );
  }

  const { state, computedTables, arenaDebriefs } = data;
  const rivalTableNumber = currentPlayer
    ? currentPlayer.tableNumber % 2 === 1
      ? currentPlayer.tableNumber + 1
      : currentPlayer.tableNumber - 1
    : null;
  const rivalTable = rivalTableNumber ? computedTables[rivalTableNumber] : null;

  return (
    <div className="min-h-screen dossier-surface flex flex-col text-[#121211]">
      {/* Top Archival Classification Masthead */}
      <header className="border-b-2 border-[#121211] bg-[#FAF7F0] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Title & Document Control Number */}
            <div className="lg:col-span-5 py-3 lg:pr-6 lg:border-r border-[#121211] flex flex-col justify-center">
              <div className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-widest text-[#57534E]">
                <span>DOC // SITREP-2026-SOC</span>
                <span>•</span>
                <span className="text-[#C8322B] font-semibold">
                  {state.phase === "lobby"
                    ? "STAGE 00: BRIEFING"
                    : state.phase === "debrief"
                    ? "STAGE 04: DECLASSIFIED"
                    : `STAGE 0${currentActNumber}: ACTIVE INCIDENT`}
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold tracking-tight uppercase mt-0.5">
                AI Lab &amp; SOC Tabletop Crisis Exercise
              </div>
            </div>

            {/* Active Table & Operative Clearance Cell */}
            <div className="lg:col-span-4 py-2.5 lg:px-5 border-t lg:border-t-0 lg:border-r border-[#121211] flex items-center justify-between">
              {currentPlayer ? (
                <div className="w-full flex items-center justify-between gap-2">
                  <div className="font-mono-tech text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-[#57534E]">
                      ASSIGNED STATION // ARENA {pad2(currentPlayer.arenaNumber)}
                    </div>
                    <div className="font-bold text-sm">
                      TABLE {pad2(currentPlayer.tableNumber)} —{" "}
                      <span
                        className={
                          currentPlayer.labId === "aegis"
                            ? "text-[#1846C7]"
                            : "text-[#C84B15]"
                        }
                      >
                        {LAB_PROFILES[currentPlayer.labId].shortName.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#57534E]">
                      OPERATIVE: <strong className="text-[#121211]">{currentPlayer.name}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLeaveSession}
                    className="px-2.5 py-1 border border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] font-mono-tech text-[10px] uppercase tracking-wider transition cursor-pointer"
                  >
                    Reassign
                  </button>
                </div>
              ) : (
                <div className="font-mono-tech text-xs text-[#57534E] uppercase">
                  STATUS: UNASSIGNED PARTICIPANT // SELECT TABLE BELOW
                </div>
              )}
            </div>

            {/* Clock & Mode Links Cell */}
            <div className="lg:col-span-3 py-2.5 lg:pl-5 border-t lg:border-t-0 border-[#121211] flex items-center justify-between gap-3">
              <div className="font-mono-tech">
                <div className="text-[10px] uppercase tracking-wider text-[#57534E]">
                  PHASE CLOCK
                </div>
                <div
                  className={`text-lg font-bold leading-none mt-0.5 ${
                    state.timerRunning ? "text-[#C8322B]" : "text-[#121211]"
                  }`}
                >
                  {formatTimer(state.timerSecondsRemaining)}
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-mono-tech text-[11px] uppercase">
                <Link
                  href="/admin"
                  className="px-2.5 py-1.5 border border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] font-semibold transition"
                >
                  Admin [3]
                </Link>
                <Link
                  href="/gm"
                  className="px-2.5 py-1.5 border border-[#121211] bg-[#121211] text-[#FAF7F0] hover:bg-[#292826] font-semibold transition"
                >
                  War Room
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {errorMsg && (
          <div className="mb-6 p-4 border-2 border-[#C8322B] bg-[#FAF7F0] flex items-center justify-between font-mono-tech text-xs">
            <div>
              <strong className="text-[#C8322B] uppercase mr-2">
                [TRANSMISSION EXCEPTION]:
              </strong>
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="underline uppercase font-semibold cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* ===================================================================
            VIEW 1: PARTICIPANT SEAT & TABLE REGISTRATION LEDGER
           =================================================================== */}
        {!currentPlayer ? (
          <div className="dossier-sheet">
            {/* Top Dossier Classification Banner */}
            <div className="border-b-2 border-[#121211] bg-[#E6DFD1] px-6 py-3 flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs uppercase">
              <span>FORM 01-A // PARTICIPANT TABLE &amp; LAB ASSIGNMENT</span>
              <span>50 PARTICIPANTS • 10 TABLES • 5 ARENAS</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left Column: Editorial Exercise Briefing */}
              <div className="lg:col-span-5 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r-2 border-[#121211] flex flex-col justify-between bg-[#FAF7F0]">
                <div className="space-y-5">
                  <div>
                    <span className="stamp-badge text-[#C8322B]">
                      BRIEFING DOSSIER // FOR EXERCISE USE ONLY
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-tight leading-none mt-4">
                      Two Rival AI Labs. Three Live Cyber Crises.
                    </h1>
                  </div>

                  <p className="font-editorial text-lg leading-relaxed text-[#262523]">
                    You and the four colleagues seated at your physical table form the crisis command cell of a frontier Artificial Intelligence laboratory. Directly across your Arena sits your primary competitor.
                  </p>

                  <p className="text-sm leading-relaxed text-[#44403C]">
                    Over the next sixty minutes, both labs will navigate three escalating security incidents modeled on real-world frontier AI breaches: compromised model-hub tokens, malicious Python pickle checkpoints, autonomous coding-agent container escapes, and pre-launch weight extortion.
                  </p>

                  <div className="border-t-2 border-[#121211] pt-4 space-y-3">
                    <div className="font-mono-tech text-xs uppercase tracking-wider font-semibold">
                      Competing Laboratory Profiles
                    </div>

                    <div className="p-3.5 border border-[#121211] bg-[#F2EDE2]">
                      <div className="flex items-center justify-between font-mono-tech text-xs">
                        <strong className="text-[#1846C7] uppercase">
                          ODD TABLES (01, 03, 05, 07, 09) // AEGIS FRONTIER LABS
                        </strong>
                      </div>
                      <p className="text-xs text-[#44403C] mt-1 leading-relaxed">
                        Defense-integrated, safety-first architecture. Starts with higher Security Posture (55) &amp; Regulatory Trust (55), but trails in commercial deployment speed.
                      </p>
                    </div>

                    <div className="p-3.5 border border-[#121211] bg-[#F2EDE2]">
                      <div className="flex items-center justify-between font-mono-tech text-xs">
                        <strong className="text-[#C84B15] uppercase">
                          EVEN TABLES (02, 04, 06, 08, 10) // VANGUARD OMNI AI
                        </strong>
                      </div>
                      <p className="text-xs text-[#44403C] mt-1 leading-relaxed">
                        Hyper-scale open-weights &amp; commercial blitz lab. Starts with higher Model Capability (55) &amp; Market Velocity (55), but carries a wider attack surface.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-[#C8C0B0] font-mono-tech text-[11px] text-[#57534E] uppercase">
                  NO DICE OR RANDOM LUCK // OUTCOMES ARE DETERMINED STRICTLY BY YOUR TECHNICAL &amp; STRATEGIC DECISIONS.
                </div>
              </div>

              {/* Right Column: Physical Table Map & Registration Form */}
              <div className="lg:col-span-7 p-6 sm:p-8 bg-[#FAF7F0]">
                <form onSubmit={handleJoinTable} className="space-y-6">
                  <div>
                    <label
                      htmlFor="operative-name"
                      className="block font-mono-tech text-xs uppercase tracking-wider font-bold mb-2"
                    >
                      § 1.1 — Enter Operative Full Name
                    </label>
                    <input
                      id="operative-name"
                      type="text"
                      required
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      placeholder="e.g., Jordan Vance"
                      className="w-full px-4 py-3 border-2 border-[#121211] bg-[#F2EDE2] font-mono-tech text-sm text-[#121211] placeholder-[#78716C] focus:outline-none focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-mono-tech text-xs uppercase tracking-wider font-bold">
                        § 1.2 — Select Your Physical Table Assignment (Arenas 01–05)
                      </label>
                      <span className="font-mono-tech text-[11px] text-[#57534E]">
                        5 SEATS PER TABLE
                      </span>
                    </div>

                    {/* 5 Arenas Architecture Schematic */}
                    <div className="border-2 border-[#121211] divide-y-2 divide-[#121211]">
                      {[1, 2, 3, 4, 5].map((arenaNum) => {
                        const oddT = (arenaNum - 1) * 2 + 1;
                        const evenT = oddT + 1;

                        return (
                          <div
                            key={arenaNum}
                            className="grid grid-cols-1 sm:grid-cols-12 items-stretch"
                          >
                            <div className="sm:col-span-2 bg-[#E6DFD1] px-3 py-2 flex sm:flex-col items-center sm:items-start justify-between sm:justify-center border-b sm:border-b-0 sm:border-r-2 border-[#121211] font-mono-tech">
                              <span className="text-[10px] uppercase text-[#57534E]">
                                MATCHUP
                              </span>
                              <span className="text-xs font-bold uppercase">
                                ARENA {pad2(arenaNum)}
                              </span>
                            </div>

                            {[oddT, evenT].map((tNum) => {
                              const isAegis = getTableLabId(tNum) === "aegis";
                              const tView = computedTables[tNum];
                              const count = tView.players.length;
                              const isSelected = selectedTable === tNum;

                              return (
                                <button
                                  key={tNum}
                                  type="button"
                                  onClick={() => setSelectedTable(tNum)}
                                  className={`sm:col-span-5 p-3.5 text-left transition flex flex-col justify-between cursor-pointer ${
                                    tNum === oddT
                                      ? "border-b sm:border-b-0 sm:border-r border-[#121211]"
                                      : ""
                                  } ${
                                    isSelected
                                      ? "bg-[#121211] text-[#FAF7F0]"
                                      : "bg-[#FAF7F0] hover:bg-[#F2EDE2] text-[#121211]"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-sm uppercase tracking-tight">
                                      TABLE {pad2(tNum)}
                                    </span>
                                    <span
                                      className={`font-mono-tech text-[10px] uppercase px-1.5 py-0.5 border ${
                                        isSelected
                                          ? "border-[#FAF7F0] text-[#FAF7F0]"
                                          : isAegis
                                          ? "border-[#1846C7] text-[#1846C7]"
                                          : "border-[#C84B15] text-[#C84B15]"
                                      }`}
                                    >
                                      {isAegis ? "AEGIS AI" : "VANGUARD AI"}
                                    </span>
                                  </div>

                                  <div className="mt-2.5 flex items-center justify-between font-mono-tech text-[11px]">
                                    <span>
                                      [
                                      {Array.from({ length: 5 }, (_, s) =>
                                        s < count ? "■" : "·"
                                      ).join("")}
                                      ] {count}/5 SEATED
                                    </span>
                                    {isSelected && (
                                      <span className="uppercase font-bold underline">
                                        [SELECTED]
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-[#121211] flex flex-wrap items-center justify-between gap-4">
                    <div className="font-mono-tech text-xs">
                      REGISTERING FOR:{" "}
                      <strong>
                        TABLE {pad2(selectedTable)} (ARENA{" "}
                        {pad2(getTableArenaNumber(selectedTable))} //{" "}
                        {LAB_PROFILES[
                          getTableLabId(selectedTable)
                        ].name.toUpperCase()}
                        )
                      </strong>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || !joinName.trim()}
                      className="px-6 py-3.5 border-2 border-[#121211] bg-[#C8322B] hover:bg-[#a8251f] disabled:opacity-40 text-[#FAF7F0] font-mono-tech text-xs uppercase tracking-widest font-bold transition cursor-pointer shadow-[3px_3px_0px_#121211]"
                    >
                      Confirm Seat &amp; Open Dossier →
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : state.phase === "lobby" ? (
          /* ===================================================================
             VIEW 2: PRE-INCIDENT BRIEFING FOLDER & TABLE ROSTER
             =================================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Columns: Lab Intelligence File & Role Clearance */}
            <div className="lg:col-span-8 dossier-sheet">
              <div className="border-b-2 border-[#121211] bg-[#E6DFD1] px-6 py-3 flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs uppercase">
                <span>
                  LAB DOSSIER // TABLE {pad2(currentPlayer.tableNumber)} (ARENA{" "}
                  {pad2(currentPlayer.arenaNumber)})
                </span>
                <span>OPPOSING TABLE: TABLE {pad2(rivalTableNumber || 0)}</span>
              </div>

              <div className="p-6 sm:p-8 space-y-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`stamp-badge ${
                        currentPlayer.labId === "aegis"
                          ? "text-[#1846C7]"
                          : "text-[#C84B15]"
                      }`}
                    >
                      {LAB_PROFILES[currentPlayer.labId].name}
                    </span>
                    <span className="font-mono-tech text-xs text-[#57534E] uppercase">
                      // {LAB_PROFILES[currentPlayer.labId].tagline}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight mt-2">
                    Laboratory Operational Profile
                  </h2>
                  <p className="font-editorial text-lg leading-relaxed text-[#262523] mt-2">
                    {LAB_PROFILES[currentPlayer.labId].backgroundBrief}
                  </p>
                </div>

                {/* Horizontal Metric Bar Gauges */}
                <div className="border-t-2 border-b-2 border-[#121211] py-5">
                  <div className="font-mono-tech text-xs uppercase tracking-wider font-bold mb-4">
                    § 2.1 — Baseline Laboratory Posture Indices (Scale 0–100)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        code: "SEC-INDEX",
                        label: "Security Posture (SOC)",
                        val: myTable?.currentMetrics.security ?? 50,
                      },
                      {
                        code: "CAP-INDEX",
                        label: "Model Capability & Velocity",
                        val: myTable?.currentMetrics.capability ?? 50,
                      },
                      {
                        code: "TRU-INDEX",
                        label: "Public & Regulatory Trust",
                        val: myTable?.currentMetrics.trust ?? 50,
                      },
                      {
                        code: "GRO-INDEX",
                        label: "Commercial Market Growth",
                        val: myTable?.currentMetrics.growth ?? 50,
                      },
                    ].map((m) => (
                      <div
                        key={m.code}
                        className="p-3.5 border border-[#121211] bg-[#F2EDE2]"
                      >
                        <div className="flex items-center justify-between font-mono-tech text-xs">
                          <span className="uppercase font-semibold">
                            {m.label}
                          </span>
                          <span className="font-bold text-sm">{m.val}/100</span>
                        </div>
                        <div className="mt-2 h-2.5 w-full border border-[#121211] bg-[#FAF7F0]">
                          <div
                            className="h-full bg-[#121211]"
                            style={{ width: `${m.val}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operative Role Assignment Clearance */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="font-mono-tech text-xs uppercase tracking-wider font-bold">
                      § 2.2 — Your Assigned Specialist Clearance
                    </div>
                    <div className="flex items-center gap-2 font-mono-tech text-xs">
                      <label htmlFor="swap-role-lobby" className="text-[#57534E]">
                        REASSIGN SEAT:
                      </label>
                      <select
                        id="swap-role-lobby"
                        value={currentPlayer.roleId || ""}
                        onChange={(e) =>
                          handleRoleChange(e.target.value as RoleId)
                        }
                        className="px-2.5 py-1 border border-[#121211] bg-[#F2EDE2] text-xs font-mono-tech uppercase"
                      >
                        <option value="" disabled>
                          [AWAITING ASSIGNMENT]
                        </option>
                        {ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.shortTitle}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {currentPlayer.roleId ? (
                    (() => {
                      const roleDef = ROLES.find(
                        (r) => r.id === currentPlayer.roleId
                      )!;
                      return (
                        <div className="border-2 border-[#121211] bg-[#F2EDE2] p-5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#121211] pb-2">
                            <span className="font-bold text-lg uppercase">
                              {roleDef.title}
                            </span>
                            <span className="stamp-badge text-[#121211]">
                              DEPT // {roleDef.department}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-[#262523]">
                            {roleDef.missionSummary}
                          </p>
                          <div className="p-3 bg-[#FAF7F0] border border-[#121211] font-mono-tech text-xs text-[#44403C]">
                            <strong className="text-[#121211] uppercase">
                              Operational Context:
                            </strong>{" "}
                            {roleDef.realWorldParallel}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="border-2 border-dashed border-[#121211] p-6 bg-[#F2EDE2] font-mono-tech text-xs uppercase leading-relaxed">
                      [ STANDING BY FOR GAME MASTER ROLE DISTRIBUTION — OR USE THE DROPDOWN ABOVE TO CLAIM YOUR DEPARTMENT SEAT AT THE TABLE. ]
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right 4 Columns: Table Seat Ledger & Protocol Manual */}
            <div className="lg:col-span-4 space-y-6">
              <div className="dossier-sheet">
                <div className="border-b-2 border-[#121211] bg-[#E6DFD1] px-5 py-3 flex items-center justify-between font-mono-tech text-xs uppercase">
                  <span>TABLE {pad2(currentPlayer.tableNumber)} SEAT LEDGER</span>
                  <span>{myTable?.players.length || 0}/5 SEATED</span>
                </div>

                <div className="divide-y divide-[#121211]">
                  {myTable?.players.map((p, idx) => {
                    const rDef = ROLES.find((r) => r.id === p.roleId);
                    const isMe = p.id === currentPlayer.id;
                    return (
                      <div
                        key={p.id}
                        className={`p-4 flex items-center justify-between font-mono-tech text-xs ${
                          isMe ? "bg-[#F2EDE2]" : "bg-[#FAF7F0]"
                        }`}
                      >
                        <div>
                          <div className="text-[10px] text-[#57534E]">
                            SEAT 0{idx + 1} {isMe ? "// [YOU]" : ""}
                          </div>
                          <div className="font-bold text-sm text-[#121211] uppercase">
                            {p.name}
                          </div>
                        </div>
                        <span className="px-2 py-1 border border-[#121211] bg-[#FAF7F0] uppercase font-semibold text-[11px]">
                          {rDef ? rDef.shortTitle : "UNASSIGNED"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="dossier-sheet p-5 space-y-3">
                <div className="font-mono-tech text-xs uppercase tracking-wider font-bold border-b border-[#121211] pb-2">
                  Exercise Protocol (3 Acts)
                </div>
                <ol className="space-y-2.5 text-xs leading-relaxed text-[#262523] list-decimal list-inside font-mono-tech">
                  <li>
                    <strong>Inspect Department Intercepts:</strong> Every seat at your table receives different SIEM logs, model traces, or legal memos. Read yours aloud to your table.
                  </li>
                  <li>
                    <strong>File Individual &amp; Table Directives:</strong> Each specialist files 1 Department Directive; the table ratifies 1 Joint Resolution.
                  </li>
                  <li>
                    <strong>Field Admin Debrief:</strong> One of the 3 Field Admins will walk to your Arena, read the outcome assessment aloud, and declassify your updated scores.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        ) : state.phase === "debrief" ? (
          /* ===================================================================
             VIEW 4: DECLASSIFIED FINAL EXERCISE AFTER-ACTION REPORT
             =================================================================== */
          <div className="dossier-sheet">
            <div className="border-b-2 border-[#121211] bg-[#121211] text-[#FAF7F0] px-6 py-4 flex flex-wrap items-center justify-between gap-4 font-mono-tech text-xs uppercase">
              <span>DECLASSIFIED // FINAL AFTER-ACTION REPORT (ACTS I–III)</span>
              <span>
                ARENA {pad2(currentPlayer.arenaNumber)} // TABLE{" "}
                {pad2(currentPlayer.tableNumber)} VS. TABLE{" "}
                {pad2(rivalTableNumber || 0)}
              </span>
            </div>

            <div className="p-6 sm:p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b-2 border-[#121211] pb-6">
                <div>
                  <span className="stamp-badge text-[#166534]">
                    EXERCISE COMPLETE // FINAL TALLY
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-3">
                    Table {pad2(currentPlayer.tableNumber)} ({myTable?.shortName}):{" "}
                    {myTable?.totalScore} PTS
                  </h1>
                  <p className="font-mono-tech text-xs text-[#57534E] uppercase mt-2">
                    OPPOSING TABLE {pad2(rivalTableNumber || 0)} (
                    {rivalTable?.shortName}): {rivalTable?.totalScore} PTS
                  </p>
                </div>

                <div className="grid grid-cols-4 border-2 border-[#121211] divide-x-2 divide-[#121211] bg-[#F2EDE2] font-mono-tech text-center">
                  {[
                    ["SECURITY", myTable?.currentMetrics.security],
                    ["CAPABILITY", myTable?.currentMetrics.capability],
                    ["TRUST", myTable?.currentMetrics.trust],
                    ["GROWTH", myTable?.currentMetrics.growth],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="p-3 flex flex-col justify-center">
                      <div className="text-[10px] text-[#57534E]">{lbl}</div>
                      <div className="text-xl font-bold mt-1">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {([1, 2, 3] as const).map((actNum) => {
                  const actDef = ACTS[actNum];
                  const res = myTable?.actResolutions[String(actNum)];
                  return (
                    <div
                      key={actNum}
                      className="border-2 border-[#121211] bg-[#F2EDE2] p-5 space-y-3"
                    >
                      <div className="font-mono-tech text-xs uppercase font-bold text-[#C8322B]">
                        ACT 0{actNum} // {actDef.subtitle}
                      </div>
                      <div className="font-bold text-base uppercase">
                        {res?.teamDecisionTitle}
                      </div>
                      <p className="text-xs leading-relaxed text-[#262523]">
                        {res?.socLesson}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ===================================================================
             VIEW 3: ACTIVE CRISIS DOSSIER & DIRECTIVE BALLOT (ACTS I, II, III)
             =================================================================== */
          (() => {
            const actDef = ACTS[currentActNumber];
            const effectiveRoleId: RoleId = currentPlayer.roleId || "cyber";
            const roleDef = ROLES.find((r) => r.id === effectiveRoleId)!;
            const roleContent = actDef.roleBriefings[effectiveRoleId];
            const myChosenDeptOption =
              currentPlayer.departmentChoices[String(currentActNumber)] || null;
            const tableChosenDecision =
              myTable?.teamDecisions[String(currentActNumber)] || null;
            const arenaDebrief =
              arenaDebriefs[`${currentPlayer.arenaNumber}-${currentActNumber}`];
            const myResolution =
              myTable?.actResolutions[String(currentActNumber)];

            return (
              <div className="space-y-6">
                {/* Priority SEV-1 Flash Dispatch Wire */}
                <div className="border-2 border-[#C8322B] bg-[#FAF7F0] shadow-[4px_4px_0px_#C8322B]">
                  <div className="bg-[#C8322B] text-[#FAF7F0] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs uppercase font-bold">
                    <span>FLASH SITREP // {actDef.incidentAlertBanner}</span>
                    <span>CASE PARALLEL: {actDef.realWorldInspiration}</span>
                  </div>

                  {/* Arena Head-to-Head Strip + Submission Status */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x border-t border-[#121211] font-mono-tech text-xs">
                    <div className="lg:col-span-4 p-3 flex items-center justify-between bg-[#F2EDE2]">
                      <div>
                        <span className="text-[10px] text-[#57534E] block">
                          ARENA {pad2(currentPlayer.arenaNumber)} STANDINGS
                        </span>
                        <strong>
                          T{pad2(currentPlayer.tableNumber)} ({myTable?.shortName}
                          ): {myTable?.totalScore} PTS
                        </strong>{" "}
                        vs.{" "}
                        <span>
                          T{pad2(rivalTableNumber || 0)} ({rivalTable?.shortName}
                          ): {rivalTable?.totalScore} PTS
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-5 p-3 grid grid-cols-4 gap-2 text-center bg-[#FAF7F0]">
                      {[
                        ["SEC", myTable?.currentMetrics.security],
                        ["CAP", myTable?.currentMetrics.capability],
                        ["TRU", myTable?.currentMetrics.trust],
                        ["GRO", myTable?.currentMetrics.growth],
                      ].map(([k, v]) => (
                        <div key={k} className="border border-[#C8C0B0] py-1">
                          <span className="text-[10px] text-[#57534E] block">
                            {k}
                          </span>
                          <span className="font-bold text-sm">{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="lg:col-span-3 p-3 flex flex-col justify-center bg-[#F2EDE2]">
                      <div className="flex items-center justify-between">
                        <span>DEPT DIRECTIVE:</span>
                        <strong
                          className={
                            myChosenDeptOption
                              ? "text-[#166534]"
                              : "text-[#C8322B]"
                          }
                        >
                          {myChosenDeptOption ? "[FILED]" : "[PENDING]"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span>TABLE RESOLUTION:</span>
                        <strong
                          className={
                            tableChosenDecision
                              ? "text-[#166534]"
                              : "text-[#C8322B]"
                          }
                        >
                          {tableChosenDecision ? "[RATIFIED]" : "[PENDING]"}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Folder Index Tabs + Main Dossier Sheet */}
                <div>
                  <div className="flex flex-wrap items-end gap-1.5 border-b-2 border-[#121211]">
                    <button
                      type="button"
                      onClick={() => setActiveTab("role")}
                      className={`px-5 py-3 font-mono-tech text-xs uppercase tracking-wider font-bold border-t-2 border-l-2 border-r-2 border-[#121211] transition cursor-pointer ${
                        activeTab === "role"
                          ? "bg-[#FAF7F0] text-[#121211] -mb-[2px] pb-[14px]"
                          : "bg-[#E6DFD1] text-[#57534E] hover:bg-[#FAF7F0]"
                      }`}
                    >
                      [01] Department Intel &amp; Directive ({roleDef.shortTitle}){" "}
                      {myChosenDeptOption ? "✓" : ""}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("team")}
                      className={`px-5 py-3 font-mono-tech text-xs uppercase tracking-wider font-bold border-t-2 border-l-2 border-r-2 border-[#121211] transition cursor-pointer ${
                        activeTab === "team"
                          ? "bg-[#FAF7F0] text-[#121211] -mb-[2px] pb-[14px]"
                          : "bg-[#E6DFD1] text-[#57534E] hover:bg-[#FAF7F0]"
                      }`}
                    >
                      [02] Joint Table Resolution (5-Vote){" "}
                      {tableChosenDecision ? "✓" : ""}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("results")}
                      className={`px-5 py-3 font-mono-tech text-xs uppercase tracking-wider font-bold border-t-2 border-l-2 border-r-2 border-[#121211] transition cursor-pointer ${
                        activeTab === "results"
                          ? "bg-[#FAF7F0] text-[#121211] -mb-[2px] pb-[14px]"
                          : isCurrentActUnlocked
                          ? "bg-[#166534] text-[#FAF7F0]"
                          : "bg-[#E6DFD1] text-[#57534E]"
                      }`}
                    >
                      [03] After-Action Report{" "}
                      {isCurrentActUnlocked ? "[DECLASSIFIED]" : "[SEALED]"}
                    </button>
                  </div>

                  {/* TAB 01: DEPARTMENT INTEL & DIRECTIVE BALLOT */}
                  {activeTab === "role" && (
                    <div className="dossier-sheet border-t-0">
                      {/* Top Situation Narrative & Field Manual Split */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 border-b-2 border-[#121211]">
                        <div className="lg:col-span-7 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r-2 border-[#121211]">
                          <div className="font-mono-tech text-xs uppercase tracking-widest text-[#C8322B] font-bold">
                            SITUATION DISPATCH // ACT 0{currentActNumber} OF 03
                          </div>
                          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight mt-1">
                            {actDef.title}
                          </h1>
                          <div className="mt-4 space-y-3 font-editorial text-lg leading-relaxed text-[#121211]">
                            {actDef.situationBriefing.map((para, idx) => (
                              <p key={idx}>{para}</p>
                            ))}
                          </div>
                        </div>

                        {/* Annotated SOC Field Manual Box */}
                        <div className="lg:col-span-5 p-6 sm:p-8 bg-[#F2EDE2] flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-[#121211] pb-2">
                              <span className="stamp-badge text-[#121211]">
                                SOC FIELD MANUAL // REFERENCE
                              </span>
                              <span className="font-mono-tech text-[11px] text-[#57534E]">
                                SEC-EDU-0{currentActNumber}
                              </span>
                            </div>
                            <h2 className="font-bold text-base uppercase leading-snug">
                              {actDef.learningTakeawayTitle}
                            </h2>
                            <ul className="space-y-2.5 text-xs leading-relaxed text-[#262523]">
                              {actDef.learningTakeawayBullets.map((b, i) => (
                                <li
                                  key={i}
                                  className="pl-3 border-l-2 border-[#121211]"
                                >
                                  {b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Split: Role Classified Intercept + Official Directive Ballot */}
                      <div className="grid grid-cols-1 lg:grid-cols-12">
                        {/* Left: Role-Specific Intercept & Raw Terminal Log */}
                        <div className="lg:col-span-6 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r-2 border-[#121211] space-y-5">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#121211] pb-3">
                            <div>
                              <div className="font-mono-tech text-[10px] uppercase text-[#57534E]">
                                EYES ONLY // {roleDef.department}
                              </div>
                              <div className="font-bold text-base uppercase">
                                {roleDef.title}
                              </div>
                            </div>

                            <select
                              aria-label="Switch specialist desk"
                              value={effectiveRoleId}
                              onChange={(e) =>
                                handleRoleChange(e.target.value as RoleId)
                              }
                              className="px-2.5 py-1.5 border border-[#121211] bg-[#F2EDE2] font-mono-tech text-xs uppercase"
                            >
                              {ROLES.map((r) => (
                                <option key={r.id} value={r.id}>
                                  DESK: {r.shortTitle}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <h3 className="font-bold text-lg uppercase">
                              {roleContent.intelHeadline}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-[#262523]">
                              {roleContent.intelBody}
                            </p>
                          </div>

                          {roleContent.terminalSnippet && (
                            <div className="border-2 border-[#121211] bg-[#121211] text-[#F2EDE2] p-4 font-mono-tech text-xs overflow-x-auto">
                              <div className="flex items-center justify-between text-[10px] text-[#A8A29E] border-b border-[#2E2D2A] pb-2 mb-3 uppercase">
                                <span>RAW TELEMETRY INTERCEPT // {roleDef.id.toUpperCase()}_FEED</span>
                                <span>UTF-8 // VERIFIED</span>
                              </div>
                              <pre className="whitespace-pre-wrap leading-relaxed text-[#E7E5E4]">
                                {roleContent.terminalSnippet}
                              </pre>
                            </div>
                          )}

                          <div className="border-2 border-[#121211] bg-[#E6DFD1] p-4">
                            <div className="font-mono-tech text-xs uppercase font-bold text-[#C8322B] mb-1">
                              [MANDATORY TABLE BRIEFING CUE — READ ALOUD]:
                            </div>
                            <p className="text-xs leading-relaxed text-[#121211] font-medium">
                              {roleContent.tablePrompt}
                            </p>
                          </div>
                        </div>

                        {/* Right: Department Directive Ballot */}
                        <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-[#FAF7F0]">
                          <div className="space-y-4">
                            <div className="border-b border-[#121211] pb-3">
                              <div className="font-mono-tech text-[10px] uppercase text-[#57534E]">
                                FORM 02-B // DEPARTMENTAL ACTION ORDER
                              </div>
                              <h3 className="font-bold text-lg uppercase">
                                Authorize {roleDef.shortTitle} Directive
                              </h3>
                              <p className="text-xs text-[#57534E] mt-0.5">
                                Mark one directive below. After all specialists at your table have filed, proceed to Tab [02] to ratify your Joint Table Resolution.
                              </p>
                            </div>

                            <div className="space-y-3">
                              {roleContent.options.map((opt, idx) => {
                                const isPicked = myChosenDeptOption === opt.id;
                                const code = `DIR-0${currentActNumber}-${String.fromCharCode(
                                  65 + idx
                                )}`;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={
                                      submitting || isCurrentActUnlocked
                                    }
                                    onClick={() =>
                                      handleSelectDepartmentAction(opt.id)
                                    }
                                    className={`w-full text-left p-4 border-2 border-[#121211] transition cursor-pointer ${
                                      isPicked
                                        ? "bg-[#121211] text-[#FAF7F0] shadow-[3px_3px_0px_#C8322B]"
                                        : "bg-[#F2EDE2] hover:bg-white text-[#121211]"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3 font-mono-tech text-xs">
                                      <span className="font-bold uppercase">
                                        [{isPicked ? "X" : " "}] {code}
                                      </span>
                                      {isPicked && (
                                        <span className="px-2 py-0.5 bg-[#C8322B] text-[#FAF7F0] uppercase font-bold text-[10px]">
                                          FILED &amp; STAMPED
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-bold text-sm mt-2 leading-snug">
                                      {opt.label}
                                    </div>
                                    <p
                                      className={`mt-1.5 text-xs leading-relaxed ${
                                        isPicked
                                          ? "text-[#D6D0C4]"
                                          : "text-[#44403C]"
                                      }`}
                                    >
                                      {opt.summary}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t-2 border-[#121211] flex items-center justify-between">
                            <span className="font-mono-tech text-xs uppercase text-[#57534E]">
                              {myChosenDeptOption
                                ? "STATUS: DIRECTIVE LOGGED"
                                : "STATUS: AWAITING SELECTION"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTab("team")}
                              className="px-5 py-2.5 border-2 border-[#121211] bg-[#121211] text-[#FAF7F0] hover:bg-[#292826] font-mono-tech text-xs uppercase font-bold cursor-pointer"
                            >
                              Proceed to Tab [02] Table Ballot →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 02: JOINT TABLE STRATEGY BALLOT */}
                  {activeTab === "team" && (
                    <div className="dossier-sheet border-t-0 p-6 sm:p-8 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#121211] pb-4">
                        <div>
                          <div className="font-mono-tech text-xs uppercase text-[#C8322B] font-bold">
                            EXECUTIVE CONCENSUS BALLOT // TABLE{" "}
                            {pad2(currentPlayer.tableNumber)} (
                            {myTable?.shortName})
                          </div>
                          <h2 className="text-2xl font-bold uppercase tracking-tight mt-1">
                            Ratify Official Lab Strategy for Act 0
                            {currentActNumber}
                          </h2>
                          <p className="text-xs text-[#44403C] mt-1">
                            Debate these four options across all 5 roles at your physical table. Your table&apos;s resolution directly collides with Table{" "}
                            {pad2(rivalTableNumber || 0)} ({rivalTable?.shortName}
                            ) across Arena {pad2(currentPlayer.arenaNumber)}.
                          </p>
                        </div>

                        <div className="stamp-badge text-[#121211]">
                          {tableChosenDecision
                            ? "RESOLUTION RATIFIED // AWAITING ADMIN"
                            : "BALLOT OPEN"}
                        </div>
                      </div>

                      {/* 5-Department Roll Call Strip */}
                      <div className="border-2 border-[#121211] bg-[#F2EDE2] p-4">
                        <div className="font-mono-tech text-xs uppercase font-bold mb-3">
                          Table {pad2(currentPlayer.tableNumber)} Department Roll Call (Act 0{currentActNumber}):
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono-tech text-xs">
                          {ROLES.map((r) => {
                            const rolePlayers =
                              myTable?.players.filter((p) => p.roleId === r.id) ||
                              [];
                            const hasSubmitted = rolePlayers.some((p) =>
                              Boolean(
                                p.departmentChoices[String(currentActNumber)]
                              )
                            );
                            return (
                              <div
                                key={r.id}
                                className={`p-2.5 border border-[#121211] flex items-center justify-between ${
                                  hasSubmitted
                                    ? "bg-[#121211] text-[#FAF7F0]"
                                    : "bg-[#FAF7F0] text-[#57534E]"
                                }`}
                              >
                                <span className="font-bold uppercase">
                                  {r.shortTitle}
                                </span>
                                <span>{hasSubmitted ? "[FILED]" : "[...]"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4 Macro Resolution Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {actDef.teamDecisions.map((dec, idx) => {
                          const isSelected = tableChosenDecision === dec.id;
                          return (
                            <button
                              key={dec.id}
                              type="button"
                              disabled={submitting || isCurrentActUnlocked}
                              onClick={() => handleSelectTeamDecision(dec.id)}
                              className={`text-left p-5 border-2 border-[#121211] transition flex flex-col justify-between cursor-pointer ${
                                isSelected
                                  ? "bg-[#121211] text-[#FAF7F0] shadow-[4px_4px_0px_#C8322B]"
                                  : "bg-[#F2EDE2] hover:bg-white text-[#121211]"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-current/20 font-mono-tech text-xs uppercase">
                                  <span className="font-bold">
                                    [{isSelected ? "X" : " "}] RESOLUTION 0
                                    {idx + 1} // POSTURE: {dec.stance}
                                  </span>
                                  {isSelected && (
                                    <span className="px-2 py-0.5 bg-[#C8322B] text-[#FAF7F0] font-bold text-[10px]">
                                      RATIFIED BY TABLE
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-base font-bold uppercase leading-snug">
                                  {dec.title}
                                </h3>
                                <p
                                  className={`mt-2 text-xs leading-relaxed ${
                                    isSelected
                                      ? "text-[#D6D0C4]"
                                      : "text-[#44403C]"
                                  }`}
                                >
                                  {dec.subtitle}
                                </p>
                              </div>

                              <div className="mt-5 pt-3 border-t border-current/20 flex items-center justify-between font-mono-tech text-[11px] uppercase font-bold">
                                <span>
                                  {isSelected
                                    ? `LOCKED FOR TABLE ${pad2(
                                        currentPlayer.tableNumber
                                      )}`
                                    : "CLICK TO RATIFY AS OFFICIAL TABLE STRATEGY"}
                                </span>
                                <span>→</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 03: AFTER-ACTION REPORT (LOCKED UNTIL ROAMING ADMIN DECLASSIFIES) */}
                  {activeTab === "results" && (
                    <div className="dossier-sheet border-t-0 p-6 sm:p-8">
                      {!isCurrentActUnlocked ? (
                        <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
                          <div className="stamp-badge text-[#C8322B]">
                            CLASSIFIED // EMBARGOED PENDING FIELD ADMIN REVIEW
                          </div>
                          <h2 className="text-2xl font-bold uppercase tracking-tight">
                            Act 0{currentActNumber} After-Action Report Is Sealed
                          </h2>
                          <p className="font-editorial text-lg text-[#262523] leading-relaxed">
                            Once both Table {pad2(currentPlayer.tableNumber)} and Table{" "}
                            {pad2(rivalTableNumber || 0)} in{" "}
                            <strong>
                              Arena {pad2(currentPlayer.arenaNumber)}
                            </strong>{" "}
                            have ratified their resolutions, one of the{" "}
                            <strong>3 Field Admins</strong> will approach your Arena, deliver the verbal outcome assessment, and declassify this report on your terminal.
                          </p>
                          <div className="p-4 border-2 border-[#121211] bg-[#F2EDE2] font-mono-tech text-xs uppercase">
                            TABLE {pad2(currentPlayer.tableNumber)} STATUS:{" "}
                            <strong>
                              {tableChosenDecision
                                ? "READY FOR FIELD ADMIN DEBRIEF"
                                : "AWAITING JOINT TABLE RESOLUTION IN TAB [02]"}
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#121211] pb-4">
                            <div>
                              <span className="stamp-badge text-[#166534]">
                                DECLASSIFIED BY FIELD ADMIN // ARENA{" "}
                                {pad2(currentPlayer.arenaNumber)}
                              </span>
                              <h2 className="text-2xl font-bold uppercase mt-2">
                                Act 0{currentActNumber} After-Action Assessment — Table{" "}
                                {pad2(currentPlayer.tableNumber)}
                              </h2>
                            </div>

                            <div className="grid grid-cols-4 border-2 border-[#121211] divide-x-2 divide-[#121211] bg-[#F2EDE2] font-mono-tech text-xs text-center">
                              {(
                                [
                                  ["SEC", myResolution?.totalDelta.security],
                                  ["CAP", myResolution?.totalDelta.capability],
                                  ["TRU", myResolution?.totalDelta.trust],
                                  ["GRO", myResolution?.totalDelta.growth],
                                ] as const
                              ).map(([label, val]) => (
                                <div key={label} className="px-3 py-2">
                                  <div className="text-[10px] text-[#57534E]">
                                    {label}
                                  </div>
                                  <div
                                    className={`font-bold text-sm ${
                                      (val || 0) >= 0
                                        ? "text-[#166534]"
                                        : "text-[#C8322B]"
                                    }`}
                                  >
                                    {(val || 0) >= 0 ? `+${val}` : val}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {arenaDebrief && (
                            <div className="border-2 border-[#121211] bg-[#F2EDE2] p-5 space-y-3">
                              <div className="font-mono-tech text-xs uppercase font-bold text-[#1846C7]">
                                ARENA {pad2(currentPlayer.arenaNumber)} CROSS-LAB COLLISION SUMMARY
                              </div>
                              <p className="font-editorial text-lg leading-relaxed text-[#121211]">
                                {arenaDebrief.readAloudScript.crossArenaCollision}
                              </p>
                              <div className="pt-3 border-t border-[#121211] font-mono-tech text-xs text-[#166534]">
                                <strong>POST-INCIDENT LESSON:</strong>{" "}
                                {myResolution?.socLesson}
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="font-mono-tech text-xs uppercase font-bold mb-3">
                              Departmental Directive Audit (Table{" "}
                              {pad2(currentPlayer.tableNumber)})
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {myResolution?.departmentBreakdown.map((dept) => (
                                <div
                                  key={dept.roleId}
                                  className="border-2 border-[#121211] bg-[#FAF7F0] p-4 space-y-2"
                                >
                                  <div className="flex items-center justify-between border-b border-[#121211] pb-2 font-mono-tech text-xs">
                                    <span className="font-bold uppercase">
                                      {dept.roleTitle}{" "}
                                      {dept.playerNames.length > 0 &&
                                        `// ${dept.playerNames.join(", ")}`}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 border uppercase font-bold text-[10px] ${
                                        dept.evaluation === "optimal"
                                          ? "border-[#166534] text-[#166534] bg-[#166534]/10"
                                          : dept.evaluation === "risky"
                                          ? "border-[#C8322B] text-[#C8322B] bg-[#C8322B]/10"
                                          : "border-[#121211] text-[#121211]"
                                      }`}
                                    >
                                      {dept.evaluation}
                                    </span>
                                  </div>
                                  <div className="font-bold text-xs uppercase">
                                    DIRECTIVE: {dept.optionLabel}
                                  </div>
                                  <p className="text-xs text-[#44403C] leading-relaxed">
                                    {dept.debriefNote}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}
