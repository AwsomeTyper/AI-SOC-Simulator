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
      <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">
        Loading...
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
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
      {/* Minimal Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm tracking-tight">
              AI Crisis Sim
            </span>
            {currentPlayer && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 font-medium">
                Table {currentPlayer.tableNumber} •{" "}
                {LAB_PROFILES[currentPlayer.labId].shortName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono font-semibold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-md">
              {formatTimer(state.timerSecondsRemaining)}
            </span>

            {currentPlayer && (
              <button
                type="button"
                onClick={handleLeaveSession}
                className="text-neutral-500 hover:text-neutral-900 cursor-pointer"
              >
                Leave
              </button>
            )}

            <Link
              href="/admin"
              className="text-neutral-500 hover:text-neutral-900 font-medium"
            >
              Admin
            </Link>
            <Link
              href="/gm"
              className="text-neutral-500 hover:text-neutral-900 font-medium"
            >
              Host
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="font-medium underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =========================================================
            1. STARTING JOIN SCREEN (Minimal, ~30 words total)
           ========================================================= */}
        {!currentPlayer ? (
          <div className="max-w-md mx-auto mt-4 bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 shadow-xs">
            <h1 className="text-xl font-bold tracking-tight">
              Join Your Table
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Enter your name and pick the table where you&apos;re sitting.
            </p>

            <form onSubmit={handleJoinTable} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="player-name"
                  className="block text-xs font-medium text-neutral-700 mb-1.5"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
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
                        className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-200 bg-white hover:bg-neutral-50"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold">
                            Table {tNum}
                          </div>
                          <div
                            className={`text-[11px] ${
                              isSelected
                                ? "text-neutral-300"
                                : isAegis
                                ? "text-blue-600"
                                : "text-orange-600"
                            }`}
                          >
                            {isAegis ? "Aegis AI" : "Vanguard AI"}
                          </div>
                        </div>
                        <span
                          className={`text-xs ${
                            isSelected ? "text-neutral-300" : "text-neutral-400"
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
                className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-sm font-semibold transition cursor-pointer"
              >
                Join Table {selectedTable}
              </button>
            </form>
          </div>
        ) : state.phase === "lobby" ? (
          /* =========================================================
             2. LOBBY SCREEN (Clean Role + Teammates Card)
             ========================================================= */
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span
                    className={`text-xs font-semibold ${
                      currentPlayer.labId === "aegis"
                        ? "text-blue-600"
                        : "text-orange-600"
                    }`}
                  >
                    Arena {currentPlayer.arenaNumber} •{" "}
                    {LAB_PROFILES[currentPlayer.labId].name}
                  </span>
                  <h1 className="text-xl font-bold mt-0.5">
                    Table {currentPlayer.tableNumber}
                  </h1>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                  Waiting for Host to Start
                </span>
              </div>

              <p className="text-sm text-neutral-600 mt-2">
                {LAB_PROFILES[currentPlayer.labId].backgroundBrief}
              </p>

              {/* Assigned Role Box */}
              <div className="mt-5 pt-5 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-neutral-400 font-medium">
                    Your Role
                  </div>
                  {currentPlayer.roleId ? (
                    (() => {
                      const r = ROLES.find(
                        (x) => x.id === currentPlayer.roleId
                      )!;
                      return (
                        <div className="mt-0.5">
                          <span className="text-base font-bold">{r.title}</span>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {r.missionSummary}
                          </p>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-sm font-medium text-neutral-500 mt-0.5">
                      Host will assign roles shortly (or pick below)
                    </div>
                  )}
                </div>

                <select
                  aria-label="Select Role"
                  value={currentPlayer.roleId || ""}
                  onChange={(e) => handleRoleChange(e.target.value as RoleId)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50"
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

            {/* Teammates List */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">
                  Table {currentPlayer.tableNumber} Teammates
                </h2>
                <span className="text-xs text-neutral-400">
                  {myTable?.players.length || 0} / 5 joined
                </span>
              </div>
              <div className="divide-y divide-neutral-100">
                {myTable?.players.map((p) => {
                  const r = ROLES.find((x) => x.id === p.roleId);
                  return (
                    <div
                      key={p.id}
                      className="py-2.5 flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">
                        {p.name}{" "}
                        {p.id === currentPlayer.id && (
                          <span className="text-xs text-neutral-400">(You)</span>
                        )}
                      </span>
                      <span className="text-xs text-neutral-500">
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
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
            <div>
              <span className="text-xs font-semibold text-emerald-600">
                Simulation Complete
              </span>
              <h1 className="text-2xl font-bold mt-0.5">
                Table {currentPlayer.tableNumber} Final Score:{" "}
                {myTable?.totalScore} pts
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Rival Table {rivalTableNumber} ({rivalTable?.shortName}):{" "}
                {rivalTable?.totalScore} pts
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ["Security", myTable?.currentMetrics.security],
                ["Capability", myTable?.currentMetrics.capability],
                ["Trust", myTable?.currentMetrics.trust],
                ["Growth", myTable?.currentMetrics.growth],
              ].map(([lbl, val]) => (
                <div
                  key={lbl}
                  className="p-3 rounded-xl bg-neutral-50 border border-neutral-200"
                >
                  <div className="text-xs text-neutral-500">{lbl}</div>
                  <div className="text-lg font-bold mt-0.5">{val}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* =========================================================
             3. ACTIVE ACT VIEW (Focused 3-Step Flow)
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
              <div className="space-y-4">
                {/* Compact Score & Step Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex p-1 rounded-xl bg-neutral-200/70 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setActiveTab("role")}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        activeTab === "role"
                          ? "bg-white text-neutral-900 shadow-2xs font-semibold"
                          : "text-neutral-600"
                      }`}
                    >
                      1. Your Move ({roleDef.shortTitle}){" "}
                      {myChosenDeptOption ? "✓" : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("team")}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        activeTab === "team"
                          ? "bg-white text-neutral-900 shadow-2xs font-semibold"
                          : "text-neutral-600"
                      }`}
                    >
                      2. Team Vote {tableChosenDecision ? "✓" : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("results")}
                      className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                        activeTab === "results"
                          ? "bg-white text-neutral-900 shadow-2xs font-semibold"
                          : isCurrentActUnlocked
                          ? "text-emerald-700 font-semibold"
                          : "text-neutral-600"
                      }`}
                    >
                      3. Results {isCurrentActUnlocked ? "• Live" : ""}
                    </button>
                  </div>

                  <div className="text-xs text-neutral-500">
                    Score: <strong className="text-neutral-900">{myTable?.totalScore}</strong> vs Rival{" "}
                    <strong>{rivalTable?.totalScore}</strong>
                  </div>
                </div>

                {/* STEP 1: YOUR CLUE & MOVE */}
                {activeTab === "role" && (
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
                    <div>
                      <span className="text-xs font-semibold text-red-600">
                        {actDef.title}
                      </span>
                      <h1 className="text-lg font-bold mt-0.5">
                        {actDef.subtitle}
                      </h1>
                      <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                        {actDef.situationBriefing.join(" ")}
                      </p>
                    </div>

                    {/* Role Clue Box */}
                    <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900">
                          Your Clue ({roleDef.title})
                        </span>
                        <select
                          aria-label="Switch Role"
                          value={effectiveRoleId}
                          onChange={(e) =>
                            handleRoleChange(e.target.value as RoleId)
                          }
                          className="text-xs bg-white border border-neutral-200 rounded-md px-2 py-1"
                        >
                          {ROLES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <p className="text-sm text-neutral-700 leading-relaxed">
                        {roleContent.intelBody}
                      </p>

                      {roleContent.terminalSnippet && (
                        <pre className="p-3 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                          {roleContent.terminalSnippet}
                        </pre>
                      )}

                      <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        💬 <strong>Say to your table:</strong>{" "}
                        {roleContent.tablePrompt}
                      </p>
                    </div>

                    {/* 3 Clean Choice Buttons */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-neutral-500">
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
                            className={`w-full text-left p-3.5 rounded-xl border text-sm transition flex items-center justify-between gap-3 cursor-pointer ${
                              isPicked
                                ? "border-neutral-900 bg-neutral-900 text-white font-medium"
                                : "border-neutral-200 bg-white hover:bg-neutral-50"
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isPicked && (
                              <span className="text-xs shrink-0 px-2 py-0.5 rounded-md bg-white/20">
                                Saved
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Optional "Learn More" Accordion */}
                    <details className="text-xs text-neutral-500 border-t border-neutral-100 pt-3">
                      <summary className="cursor-pointer font-medium text-neutral-700">
                        💡 Why this matters in real cybersecurity
                      </summary>
                      <ul className="mt-2 space-y-1.5 list-disc list-inside text-neutral-600">
                        {actDef.learningTakeawayBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </details>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab("team")}
                        className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold cursor-pointer"
                      >
                        Next: Team Vote →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: TEAM VOTE */}
                {activeTab === "team" && (
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
                    <div>
                      <h2 className="text-lg font-bold">
                        Table {currentPlayer.tableNumber} Team Decision
                      </h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Agree on one strategy as a table and tap to lock it in.
                      </p>
                    </div>

                    {/* Simple 5-Role Readiness Pills */}
                    <div className="flex flex-wrap gap-1.5">
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
                            className={`text-xs px-2.5 py-1 rounded-full border ${
                              done
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-medium"
                                : "bg-neutral-50 border-neutral-200 text-neutral-400"
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
                            className={`w-full text-left p-4 rounded-xl border transition cursor-pointer ${
                              isSelected
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-200 bg-white hover:bg-neutral-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm">
                                {dec.title}
                              </span>
                              {isSelected && (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 shrink-0">
                                  Locked In
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-xs mt-1 ${
                                isSelected
                                  ? "text-neutral-300"
                                  : "text-neutral-500"
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
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                    {!isCurrentActUnlocked ? (
                      <div className="py-10 text-center space-y-2">
                        <div className="text-base font-bold">
                          Waiting for Admin Debrief
                        </div>
                        <p className="text-sm text-neutral-500 max-w-md mx-auto">
                          Once both tables in Arena {currentPlayer.arenaNumber}{" "}
                          lock in their decisions, an Admin will visit your
                          table to read the outcome and unlock your score.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div>
                          <span className="text-xs font-semibold text-emerald-600">
                            Act {currentActNumber} Results
                          </span>
                          <h2 className="text-lg font-bold mt-0.5">
                            {myResolution?.teamDecisionTitle}
                          </h2>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center">
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
                            <div
                              key={label}
                              className="p-3 rounded-xl bg-neutral-50 border border-neutral-200"
                            >
                              <div className="text-xs text-neutral-500">
                                {label}
                              </div>
                              <div
                                className={`text-base font-bold mt-0.5 ${
                                  (val || 0) >= 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {(val || 0) >= 0 ? `+${val}` : val}
                              </div>
                            </div>
                          ))}
                        </div>

                        {arenaDebrief && (
                          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-700 space-y-2">
                            <p>
                              {arenaDebrief.readAloudScript.crossArenaCollision}
                            </p>
                            <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-200">
                              <strong>Key Takeaway:</strong>{" "}
                              {myResolution?.socLesson}
                            </p>
                          </div>
                        )}

                        <details className="text-xs border-t border-neutral-100 pt-3">
                          <summary className="cursor-pointer font-medium text-neutral-700">
                            View all 5 role results at your table
                          </summary>
                          <div className="mt-3 space-y-2">
                            {myResolution?.departmentBreakdown.map((dept) => (
                              <div
                                key={dept.roleId}
                                className="p-3 rounded-xl bg-neutral-50 border border-neutral-200"
                              >
                                <div className="flex justify-between font-semibold text-neutral-900">
                                  <span>{dept.roleTitle}</span>
                                  <span className="uppercase text-[11px] text-neutral-500">
                                    {dept.evaluation}
                                  </span>
                                </div>
                                <div className="text-neutral-600 mt-0.5">
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
