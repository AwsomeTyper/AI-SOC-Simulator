"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ACTS,
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
      // ignore
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
        setErrorMsg(json.error || "Failed to join table.");
      } else {
        setData(json);
        if (json.joinedPlayer?.id) {
          setPlayerId(json.joinedPlayer.id);
          window.localStorage.setItem("ai_soc_player_id", json.joinedPlayer.id);
        }
      }
    } catch {
      setErrorMsg("Network error.");
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
        setErrorMsg(json.error || "Could not save choice.");
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
        setErrorMsg(json.error || "Could not save team choice.");
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
      <div className="min-h-screen flex items-center justify-center font-mono-tech text-xs uppercase tracking-widest text-[#57534E]">
        Loading Dossier...
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
    <div className="min-h-screen flex flex-col">
      {/* Minimal Dossier Top Bar */}
      <header className="bg-[#FAF7F0] border-b-2 border-[#121211] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm uppercase tracking-tight">
              AI Crisis Sim
            </span>
            {currentPlayer && (
              <span className="stamp-badge text-[#121211]">
                Table {currentPlayer.tableNumber} •{" "}
                {LAB_PROFILES[currentPlayer.labId].shortName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono-tech text-xs">
            <span
              className={`font-bold px-2.5 py-1 border border-[#121211] bg-[#F2EDE2] ${
                state.timerRunning ? "text-[#C8322B]" : "text-[#121211]"
              }`}
            >
              {formatTimer(state.timerSecondsRemaining)}
            </span>

            {currentPlayer && (
              <button
                type="button"
                onClick={handleLeaveSession}
                className="text-[#57534E] hover:text-[#121211] uppercase underline cursor-pointer"
              >
                Leave
              </button>
            )}

            <Link
              href="/admin"
              className="px-2.5 py-1 border border-[#121211] bg-[#F2EDE2] hover:bg-[#121211] hover:text-[#FAF7F0] uppercase font-semibold transition"
            >
              Admin
            </Link>
            <Link
              href="/gm"
              className="px-2.5 py-1 border border-[#121211] bg-[#121211] text-[#FAF7F0] uppercase font-semibold transition"
            >
              Host
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        {errorMsg && (
          <div className="mb-6 p-3.5 border-2 border-[#C8322B] bg-[#FAF7F0] text-[#C8322B] font-mono-tech text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="font-bold underline uppercase cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =========================================================
            1. STARTING JOIN SCREEN (Minimal Dossier Card)
           ========================================================= */}
        {!currentPlayer ? (
          <div className="max-w-md mx-auto mt-4 dossier-sheet">
            <div className="border-b-2 border-[#121211] bg-[#E6DFD1] px-6 py-2.5 font-mono-tech text-[11px] uppercase tracking-wider font-semibold">
              Table Check-In
            </div>

            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold uppercase tracking-tight">
                Join Your Table
              </h1>
              <p className="font-editorial text-base text-[#57534E] mt-1">
                Enter your name and pick the table where you&apos;re sitting.
              </p>

              <form onSubmit={handleJoinTable} className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="player-name"
                    className="block font-mono-tech text-xs uppercase font-bold mb-1.5"
                  >
                    Your Name
                  </label>
                  <input
                    id="player-name"
                    type="text"
                    required
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full px-3.5 py-2.5 border-2 border-[#121211] bg-[#F2EDE2] font-mono-tech text-sm focus:outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-xs uppercase font-bold mb-1.5">
                    Table Number
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((tNum) => {
                      const isAegis = getTableLabId(tNum) === "aegis";
                      const count = computedTables[tNum].players.length;
                      const isSelected = selectedTable === tNum;

                      return (
                        <button
                          key={tNum}
                          type="button"
                          onClick={() => setSelectedTable(tNum)}
                          className={`p-3 border-2 border-[#121211] text-left transition flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-[#121211] text-[#FAF7F0]"
                              : "bg-[#F2EDE2] hover:bg-white text-[#121211]"
                          }`}
                        >
                          <div>
                            <div className="text-sm font-bold uppercase">
                              Table {tNum}
                            </div>
                            <div
                              className={`font-mono-tech text-[11px] uppercase ${
                                isSelected
                                  ? "text-[#D6D0C4]"
                                  : isAegis
                                  ? "text-[#1846C7]"
                                  : "text-[#C84B15]"
                              }`}
                            >
                              {isAegis ? "Aegis AI" : "Vanguard AI"}
                            </div>
                          </div>
                          <span
                            className={`font-mono-tech text-xs ${
                              isSelected ? "text-[#FAF7F0]" : "text-[#57534E]"
                            }`}
                          >
                            {count}/5
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !joinName.trim()}
                  className="w-full py-3 border-2 border-[#121211] bg-[#C8322B] hover:bg-[#a8251f] disabled:opacity-40 text-[#FAF7F0] font-mono-tech text-xs uppercase tracking-widest font-bold shadow-[3px_3px_0px_#121211] transition cursor-pointer"
                >
                  Join Table {selectedTable} →
                </button>
              </form>
            </div>
          </div>
        ) : state.phase === "lobby" ? (
          /* =========================================================
             2. LOBBY SCREEN (Minimal Dossier Sheet)
             ========================================================= */
          <div className="space-y-5">
            <div className="dossier-sheet">
              <div className="border-b-2 border-[#121211] bg-[#E6DFD1] px-6 py-2.5 flex items-center justify-between font-mono-tech text-xs uppercase">
                <span>
                  Arena {currentPlayer.arenaNumber} •{" "}
                  {LAB_PROFILES[currentPlayer.labId].name}
                </span>
                <span className="text-[#C8322B] font-bold">
                  Standing By for Host
                </span>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <h1 className="text-2xl font-bold uppercase">
                    Table {currentPlayer.tableNumber}
                  </h1>
                  <p className="font-editorial text-lg text-[#262523] mt-1">
                    {LAB_PROFILES[currentPlayer.labId].backgroundBrief}
                  </p>
                </div>

                {/* Assigned Role Box */}
                <div className="pt-4 border-t-2 border-[#121211] flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="font-mono-tech text-[11px] uppercase text-[#57534E]">
                      Your Assigned Role
                    </div>
                    {currentPlayer.roleId ? (
                      (() => {
                        const r = ROLES.find(
                          (x) => x.id === currentPlayer.roleId
                        )!;
                        return (
                          <div className="mt-0.5">
                            <span className="text-lg font-bold uppercase">
                              {r.title}
                            </span>
                            <p className="text-xs text-[#44403C] mt-0.5">
                              {r.missionSummary}
                            </p>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="font-mono-tech text-xs uppercase text-[#57534E] mt-1">
                        Host will assign roles shortly (or pick below)
                      </div>
                    )}
                  </div>

                  <select
                    aria-label="Select Role"
                    value={currentPlayer.roleId || ""}
                    onChange={(e) => handleRoleChange(e.target.value as RoleId)}
                    className="px-3 py-1.5 border-2 border-[#121211] bg-[#F2EDE2] font-mono-tech text-xs uppercase"
                  >
                    <option value="" disabled>
                      Switch role...
                    </option>
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Teammates List */}
            <div className="dossier-sheet">
              <div className="border-b-2 border-[#121211] bg-[#E6DFD1] px-6 py-2.5 flex items-center justify-between font-mono-tech text-xs uppercase">
                <span className="font-bold">
                  Table {currentPlayer.tableNumber} Roster
                </span>
                <span>{myTable?.players.length || 0} / 5 Seated</span>
              </div>
              <div className="divide-y divide-[#121211]">
                {myTable?.players.map((p) => {
                  const r = ROLES.find((x) => x.id === p.roleId);
                  return (
                    <div
                      key={p.id}
                      className="px-6 py-3 flex items-center justify-between font-mono-tech text-xs"
                    >
                      <span className="font-bold uppercase">
                        {p.name}{" "}
                        {p.id === currentPlayer.id && (
                          <span className="text-[#C8322B]">(You)</span>
                        )}
                      </span>
                      <span className="uppercase text-[#57534E]">
                        {r ? r.title : "Unassigned"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : state.phase === "debrief" ? (
          /* =========================================================
             4. FINAL RESULTS SCREEN
             ========================================================= */
          <div className="dossier-sheet p-6 space-y-5">
            <div>
              <span className="stamp-badge text-[#166534]">
                Simulation Complete
              </span>
              <h1 className="text-2xl font-bold uppercase mt-2">
                Table {currentPlayer.tableNumber} Final Score:{" "}
                {myTable?.totalScore} pts
              </h1>
              <p className="font-mono-tech text-xs text-[#57534E] uppercase mt-1">
                Rival Table {rivalTableNumber} ({rivalTable?.shortName}):{" "}
                {rivalTable?.totalScore} pts
              </p>
            </div>

            <div className="grid grid-cols-4 border-2 border-[#121211] divide-x-2 divide-[#121211] bg-[#F2EDE2] font-mono-tech text-center">
              {[
                ["Security", myTable?.currentMetrics.security],
                ["Capability", myTable?.currentMetrics.capability],
                ["Trust", myTable?.currentMetrics.trust],
                ["Growth", myTable?.currentMetrics.growth],
              ].map(([lbl, val]) => (
                <div key={lbl} className="p-3">
                  <div className="text-[10px] uppercase text-[#57534E]">
                    {lbl}
                  </div>
                  <div className="text-lg font-bold mt-0.5">{val}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* =========================================================
             3. ACTIVE ACT VIEW (Dossier Folder Tabs + Minimal Text)
             ========================================================= */
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
              <div>
                {/* Folder Index Tabs + Compact Score */}
                <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-[#121211]">
                  <div className="flex flex-wrap items-end gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("role")}
                      className={`px-4 py-2.5 font-mono-tech text-xs uppercase font-bold border-t-2 border-l-2 border-r-2 border-[#121211] cursor-pointer ${
                        activeTab === "role"
                          ? "bg-[#FAF7F0] text-[#121211] -mb-[2px] pb-[12px]"
                          : "bg-[#E6DFD1] text-[#57534E]"
                      }`}
                    >
                      1. Your Move ({roleDef.shortTitle}){" "}
                      {myChosenDeptOption ? "✓" : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("team")}
                      className={`px-4 py-2.5 font-mono-tech text-xs uppercase font-bold border-t-2 border-l-2 border-r-2 border-[#121211] cursor-pointer ${
                        activeTab === "team"
                          ? "bg-[#FAF7F0] text-[#121211] -mb-[2px] pb-[12px]"
                          : "bg-[#E6DFD1] text-[#57534E]"
                      }`}
                    >
                      2. Team Vote {tableChosenDecision ? "✓" : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("results")}
                      className={`px-4 py-2.5 font-mono-tech text-xs uppercase font-bold border-t-2 border-l-2 border-r-2 border-[#121211] cursor-pointer ${
                        activeTab === "results"
                          ? "bg-[#FAF7F0] text-[#121211] -mb-[2px] pb-[12px]"
                          : isCurrentActUnlocked
                          ? "bg-[#166534] text-[#FAF7F0]"
                          : "bg-[#E6DFD1] text-[#57534E]"
                      }`}
                    >
                      3. Results {isCurrentActUnlocked ? "✓" : ""}
                    </button>
                  </div>

                  <div className="font-mono-tech text-xs pb-2">
                    SCORE: <strong>{myTable?.totalScore}</strong> vs RIVAL{" "}
                    <strong>{rivalTable?.totalScore}</strong>
                  </div>
                </div>

                {/* STEP 1: YOUR CLUE & MOVE */}
                {activeTab === "role" && (
                  <div className="dossier-sheet border-t-0 p-6 space-y-5">
                    <div>
                      <span className="stamp-badge text-[#C8322B]">
                        {actDef.title}
                      </span>
                      <h1 className="text-xl font-bold uppercase mt-2">
                        {actDef.subtitle}
                      </h1>
                      <p className="font-editorial text-lg text-[#262523] mt-1.5 leading-relaxed">
                        {actDef.situationBriefing.join(" ")}
                      </p>
                    </div>

                    {/* Role Clue Box */}
                    <div className="p-4 border-2 border-[#121211] bg-[#F2EDE2] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tech text-xs uppercase font-bold">
                          Your Clue ({roleDef.title})
                        </span>
                        <select
                          aria-label="Switch Role"
                          value={effectiveRoleId}
                          onChange={(e) =>
                            handleRoleChange(e.target.value as RoleId)
                          }
                          className="font-mono-tech text-xs bg-[#FAF7F0] border border-[#121211] px-2 py-1 uppercase"
                        >
                          {ROLES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <p className="text-sm text-[#121211] leading-relaxed">
                        {roleContent.intelBody}
                      </p>

                      {roleContent.terminalSnippet && (
                        <pre className="p-3 border border-[#121211] bg-[#121211] text-[#FAF7F0] font-mono-tech text-xs overflow-x-auto whitespace-pre-wrap">
                          {roleContent.terminalSnippet}
                        </pre>
                      )}

                      <p className="font-mono-tech text-xs bg-[#FAF7F0] border border-[#121211] px-3 py-2">
                        <strong className="text-[#C8322B] uppercase">
                          Say to your table:
                        </strong>{" "}
                        {roleContent.tablePrompt}
                      </p>
                    </div>

                    {/* 3 Clean Choice Buttons */}
                    <div className="space-y-2">
                      <div className="font-mono-tech text-xs uppercase font-bold">
                        Pick your {roleDef.shortTitle} move:
                      </div>
                      {roleContent.options.map((opt) => {
                        const isPicked = myChosenDeptOption === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={submitting || isCurrentActUnlocked}
                            onClick={() => handleSelectDepartmentAction(opt.id)}
                            className={`w-full text-left p-3.5 border-2 border-[#121211] text-sm transition flex items-center justify-between gap-3 cursor-pointer ${
                              isPicked
                                ? "bg-[#121211] text-[#FAF7F0] font-bold"
                                : "bg-[#F2EDE2] hover:bg-white text-[#121211]"
                            }`}
                          >
                            <span>
                              [{isPicked ? "X" : " "}] {opt.label}
                            </span>
                            {isPicked && (
                              <span className="font-mono-tech text-[10px] uppercase px-2 py-0.5 bg-[#C8322B] text-[#FAF7F0] shrink-0">
                                Filed
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Optional "Learn More" Accordion */}
                    <details className="font-mono-tech text-xs border-t border-[#121211] pt-3">
                      <summary className="cursor-pointer font-bold uppercase">
                        + Why this matters in real cybersecurity
                      </summary>
                      <ul className="mt-2 space-y-1.5 list-disc list-inside font-sans text-xs text-[#262523]">
                        {actDef.learningTakeawayBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </details>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab("team")}
                        className="px-4 py-2 border-2 border-[#121211] bg-[#121211] text-[#FAF7F0] font-mono-tech text-xs uppercase font-bold cursor-pointer"
                      >
                        Next: Team Vote →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: TEAM VOTE */}
                {activeTab === "team" && (
                  <div className="dossier-sheet border-t-0 p-6 space-y-5">
                    <div>
                      <h2 className="text-xl font-bold uppercase">
                        Table {currentPlayer.tableNumber} Team Decision
                      </h2>
                      <p className="text-xs text-[#57534E] mt-0.5">
                        Agree on one strategy as a table and tap to lock it in.
                      </p>
                    </div>

                    {/* Simple 5-Role Readiness Pills */}
                    <div className="flex flex-wrap gap-1.5 font-mono-tech text-xs">
                      {ROLES.map((r) => {
                        const done = myTable?.players
                          .filter((p) => p.roleId === r.id)
                          .some((p) =>
                            Boolean(
                              p.departmentChoices[String(currentActNumber)]
                            )
                          );
                        return (
                          <span
                            key={r.id}
                            className={`px-2.5 py-1 border border-[#121211] uppercase ${
                              done
                                ? "bg-[#121211] text-[#FAF7F0] font-bold"
                                : "bg-[#F2EDE2] text-[#57534E]"
                            }`}
                          >
                            {r.shortTitle} {done ? "✓" : ""}
                          </span>
                        );
                      })}
                    </div>

                    {/* 4 Team Decision Buttons */}
                    <div className="space-y-2.5">
                      {actDef.teamDecisions.map((dec) => {
                        const isSelected = tableChosenDecision === dec.id;
                        return (
                          <button
                            key={dec.id}
                            type="button"
                            disabled={submitting || isCurrentActUnlocked}
                            onClick={() => handleSelectTeamDecision(dec.id)}
                            className={`w-full text-left p-4 border-2 border-[#121211] transition cursor-pointer ${
                              isSelected
                                ? "bg-[#121211] text-[#FAF7F0]"
                                : "bg-[#F2EDE2] hover:bg-white text-[#121211]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-sm uppercase">
                                [{isSelected ? "X" : " "}] {dec.title}
                              </span>
                              {isSelected && (
                                <span className="font-mono-tech text-[10px] uppercase px-2 py-0.5 bg-[#C8322B] text-[#FAF7F0] shrink-0">
                                  Ratified
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-xs mt-1 ${
                                isSelected
                                  ? "text-[#D6D0C4]"
                                  : "text-[#44403C]"
                              }`}
                            >
                              {dec.subtitle}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 3: RESULTS */}
                {activeTab === "results" && (
                  <div className="dossier-sheet border-t-0 p-6">
                    {!isCurrentActUnlocked ? (
                      <div className="py-10 text-center space-y-2">
                        <span className="stamp-badge text-[#C8322B]">
                          Sealed
                        </span>
                        <div className="text-lg font-bold uppercase mt-2">
                          Waiting for Admin Debrief
                        </div>
                        <p className="font-editorial text-base text-[#44403C] max-w-md mx-auto">
                          Once both tables in Arena {currentPlayer.arenaNumber}{" "}
                          lock in their decisions, an Admin will visit your
                          table to read the outcome and unlock your score.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div>
                          <span className="stamp-badge text-[#166534]">
                            Act {currentActNumber} Declassified
                          </span>
                          <h2 className="text-lg font-bold uppercase mt-2">
                            {myResolution?.teamDecisionTitle}
                          </h2>
                        </div>

                        <div className="grid grid-cols-4 border-2 border-[#121211] divide-x-2 divide-[#121211] bg-[#F2EDE2] font-mono-tech text-center">
                          {(
                            [
                              ["Security", myResolution?.totalDelta.security],
                              [
                                "Capability",
                                myResolution?.totalDelta.capability,
                              ],
                              ["Trust", myResolution?.totalDelta.trust],
                              ["Growth", myResolution?.totalDelta.growth],
                            ] as const
                          ).map(([label, val]) => (
                            <div key={label} className="p-3">
                              <div className="text-[10px] uppercase text-[#57534E]">
                                {label}
                              </div>
                              <div
                                className={`text-base font-bold mt-0.5 ${
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

                        {arenaDebrief && (
                          <div className="p-4 border-2 border-[#121211] bg-[#F2EDE2] space-y-2">
                            <p className="font-editorial text-base text-[#121211]">
                              {arenaDebrief.readAloudScript.crossArenaCollision}
                            </p>
                            <p className="font-mono-tech text-xs text-[#166534] pt-2 border-t border-[#121211]">
                              <strong>Takeaway:</strong>{" "}
                              {myResolution?.socLesson}
                            </p>
                          </div>
                        )}

                        <details className="font-mono-tech text-xs border-t border-[#121211] pt-3">
                          <summary className="cursor-pointer font-bold uppercase">
                            + View all 5 role results at your table
                          </summary>
                          <div className="mt-3 space-y-2 font-sans">
                            {myResolution?.departmentBreakdown.map((dept) => (
                              <div
                                key={dept.roleId}
                                className="p-3 border border-[#121211] bg-[#F2EDE2]"
                              >
                                <div className="flex justify-between font-mono-tech font-bold uppercase text-xs">
                                  <span>{dept.roleTitle}</span>
                                  <span>{dept.evaluation}</span>
                                </div>
                                <div className="text-xs text-[#262523] mt-1">
                                  {dept.debriefNote}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        )}
      </main>
    </div>
  );
}
