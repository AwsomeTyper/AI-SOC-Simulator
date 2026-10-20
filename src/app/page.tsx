"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Terminal,
  Cpu,
  TrendingUp,
  Scale,
  Crown,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Award,
  Sparkles,
  ChevronRight,
  Radio,
} from "lucide-react";
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

const ROLE_ICON_MAP: Record<RoleId, React.ReactNode> = {
  ceo: <Crown className="w-4 h-4 text-amber-400" />,
  cyber: <Shield className="w-4 h-4 text-cyan-400" />,
  research: <Cpu className="w-4 h-4 text-purple-400" />,
  growth: <TrendingUp className="w-4 h-4 text-emerald-400" />,
  policy: <Scale className="w-4 h-4 text-rose-400" />,
};

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
  const [activeTab, setActiveTab] = useState<"role" | "team" | "results">("role");
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

  // Automatically switch to "results" tab when an Admin unlocks the current Act for this player's table
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
        setErrorMsg(json.error || "Failed to join table");
      } else {
        setData(json);
        if (json.joinedPlayer?.id) {
          setPlayerId(json.joinedPlayer.id);
          window.localStorage.setItem("ai_soc_player_id", json.joinedPlayer.id);
        }
      }
    } catch {
      setErrorMsg("Network error while joining table.");
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
        setErrorMsg(json.error || "Could not submit action.");
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
        setErrorMsg(json.error || "Could not lock in team decision.");
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
      <div className="min-h-screen flex items-center justify-center bg-[#070b14] text-slate-200">
        <div className="flex items-center gap-3 text-cyan-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-mono text-sm tracking-wider uppercase">
            Connecting to AI SOC Tactical Engine...
          </span>
        </div>
      </div>
    );
  }

  const { state, computedTables, arenaDebriefs } = data;
  const rivalTableNumber =
    currentPlayer
      ? currentPlayer.tableNumber % 2 === 1
        ? currentPlayer.tableNumber + 1
        : currentPlayer.tableNumber - 1
      : null;
  const rivalTable =
    rivalTableNumber ? computedTables[rivalTableNumber] : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-slate-100">
      {/* Top Tactical Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0b1120]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white">
                  AI SOC CRISIS SIMULATOR
                </span>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {state.phase === "lobby"
                    ? "PHASE: LOBBY"
                    : state.phase === "debrief"
                    ? "PHASE: FINAL DEBRIEF"
                    : `PHASE: ACT ${currentActNumber} OF 3`}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Frontier AI Labs & Security Operations Tabletop Exercise (5v5 Arena Format)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Round Countdown Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm ${
                state.timerRunning
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                  : "bg-slate-900 border-slate-800 text-slate-400"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTimer(state.timerSecondsRemaining)}</span>
            </div>

            {currentPlayer && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                <span className="font-semibold text-white">
                  Table {currentPlayer.tableNumber}
                </span>
                <span className="text-slate-500">•</span>
                <span
                  className={
                    currentPlayer.labId === "aegis"
                      ? "text-sky-400 font-medium"
                      : "text-amber-400 font-medium"
                  }
                >
                  {LAB_PROFILES[currentPlayer.labId].shortName}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{currentPlayer.name}</span>
                <button
                  onClick={handleLeaveSession}
                  className="ml-1 text-[11px] text-slate-400 hover:text-rose-400 underline"
                  title="Switch Table or Name"
                >
                  Switch
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs">
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-medium transition"
              >
                Admin Console (3)
              </Link>
              <Link
                href="/gm"
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium transition"
              >
                GM Projector
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs underline text-rose-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* VIEW 1: STUDENT ONBOARDING / TABLE SELECTION */}
        {!currentPlayer ? (
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 shadow-2xl">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 mb-3">
                  <Radio className="w-3.5 h-3.5" /> Student Terminal Onboarding
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Take Your Seat & Join Your AI Lab Crisis Table
                </h1>
                <p className="mt-2 text-slate-300 text-sm sm:text-base leading-relaxed">
                  You and your 4 tablemates are the Executive & Security Operations Center (SOC) leadership team of a frontier AI lab. Across your Arena sits your rival AI lab. Over the next hour, both labs will face three real-world AI cybersecurity crises.
                </p>
              </div>

              <form onSubmit={handleJoinTable} className="mt-6 space-y-6">
                <div>
                  <label
                    htmlFor="student-name"
                    className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-2"
                  >
                    1. Enter Your First & Last Name
                  </label>
                  <input
                    id="student-name"
                    type="text"
                    required
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="e.g., Alex Rivera"
                    className="w-full sm:max-w-md px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-3">
                    2. Select Your Physical Table Number (Tables 1–10 Across 5 Arenas)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((tNum) => {
                      const labId = getTableLabId(tNum);
                      const arenaNum = getTableArenaNumber(tNum);
                      const tView = computedTables[tNum];
                      const isSelected = selectedTable === tNum;
                      const isAegis = labId === "aegis";

                      return (
                        <button
                          key={tNum}
                          type="button"
                          onClick={() => setSelectedTable(tNum)}
                          className={`text-left p-3.5 rounded-xl border transition flex flex-col justify-between ${
                            isSelected
                              ? isAegis
                                ? "bg-sky-500/20 border-sky-400 ring-2 ring-sky-400/30"
                                : "bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/30"
                              : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono text-slate-400">
                                Arena {arenaNum}
                              </span>
                              <span
                                className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                                  isAegis
                                    ? "bg-sky-500/15 text-sky-300"
                                    : "bg-amber-500/15 text-amber-300"
                                }`}
                              >
                                {isAegis ? "Aegis AI" : "Vanguard AI"}
                              </span>
                            </div>
                            <div className="mt-1.5 text-lg font-bold text-white">
                              Table {tNum}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {tView.players.length} / 5 seated
                            </span>
                            {isSelected && (
                              <span className="text-cyan-300 font-semibold">
                                Selected
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    Joining{" "}
                    <strong className="text-white">Table {selectedTable}</strong>{" "}
                    (Arena {getTableArenaNumber(selectedTable)} —{" "}
                    <span
                      className={
                        getTableLabId(selectedTable) === "aegis"
                          ? "text-sky-400 font-semibold"
                          : "text-amber-400 font-semibold"
                      }
                    >
                      {LAB_PROFILES[getTableLabId(selectedTable)].name}
                    </span>
                    )
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !joinName.trim()}
                    className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    <span>Join Table {selectedTable}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : state.phase === "lobby" ? (
          /* VIEW 2: LOBBY & ROLE BRIEFING VIEW */
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lab Dossier Card */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <span
                    className={`text-xs font-mono uppercase px-2.5 py-1 rounded-full border ${
                      currentPlayer.labId === "aegis"
                        ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    Arena {currentPlayer.arenaNumber} • Table{" "}
                    {currentPlayer.tableNumber} vs. Table {rivalTableNumber}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Waiting for Game Master to Launch Act I...
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-white">
                  {LAB_PROFILES[currentPlayer.labId].name}
                </h2>
                <p className="text-sm text-cyan-300 font-medium mt-0.5">
                  {LAB_PROFILES[currentPlayer.labId].tagline}
                </p>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                  {LAB_PROFILES[currentPlayer.labId].backgroundBrief}
                </p>

                {/* Starting Lab Metrics */}
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Security Posture",
                      val: myTable?.currentMetrics.security ?? 50,
                      color: "text-cyan-400",
                    },
                    {
                      label: "AI Capability",
                      val: myTable?.currentMetrics.capability ?? 50,
                      color: "text-purple-400",
                    },
                    {
                      label: "Public Trust",
                      val: myTable?.currentMetrics.trust ?? 50,
                      color: "text-emerald-400",
                    },
                    {
                      label: "Market Growth",
                      val: myTable?.currentMetrics.growth ?? 50,
                      color: "text-amber-400",
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800"
                    >
                      <div className="text-[11px] font-mono uppercase text-slate-400">
                        {m.label}
                      </div>
                      <div className={`text-xl font-bold mt-1 ${m.color}`}>
                        {m.val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Assigned Role Dossier */}
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300">
                      Your Assigned Executive / SOC Role
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Need to swap roles at table?</span>
                      <select
                        aria-label="Swap role at table"
                        value={currentPlayer.roleId || ""}
                        onChange={(e) =>
                          handleRoleChange(e.target.value as RoleId)
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="" disabled>
                          Select role...
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
                        <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30">
                          <div className="flex items-center gap-2.5">
                            {ROLE_ICON_MAP[roleDef.id]}
                            <span className="text-lg font-bold text-white">
                              {roleDef.title}
                            </span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {roleDef.department}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">
                            {roleDef.missionSummary}
                          </p>
                          <div className="mt-3 p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-400">
                            <strong className="text-cyan-300">
                              Real-World Industry Role:
                            </strong>{" "}
                            {roleDef.realWorldParallel}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-dashed border-slate-700 text-sm text-slate-300">
                      Waiting for the Game Master to click{" "}
                      <strong className="text-cyan-300">
                        &ldquo;Auto-Assign Roles&rdquo;
                      </strong>{" "}
                      (or you can manually pick your role above if your table is ready).
                    </div>
                  )}
                </div>
              </div>

              {/* Table Roster Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center justify-between">
                    <span>Table {currentPlayer.tableNumber} Roster</span>
                    <span className="text-xs font-mono text-cyan-400">
                      {myTable?.players.length || 0} / 5 Players
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Introduce yourselves at your physical table! Each role receives different forensic logs during each Act.
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {myTable?.players.map((p) => {
                      const rDef = ROLES.find((r) => r.id === p.roleId);
                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            p.id === currentPlayer.id
                              ? "bg-cyan-500/10 border-cyan-500/40"
                              : "bg-slate-950/70 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-white">
                              {p.name}
                            </span>
                            {p.id === currentPlayer.id && (
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            {rDef ? (
                              <>
                                {ROLE_ICON_MAP[rDef.id]}
                                <span className="text-slate-200 font-medium">
                                  {rDef.shortTitle}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-500 italic">
                                Pending Role
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1.5">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    How Each Act Works (No Luck / No Dice):
                  </div>
                  <p>
                    1. Read your secret department log & share clues out loud with your table.
                  </p>
                  <p>
                    2. Lock in your individual <strong>Department Action</strong> + vote on one <strong>Official Table Strategy</strong>.
                  </p>
                  <p>
                    3. One of the <strong>3 Roaming Admins</strong> will visit your Arena to read out the results and unlock your new score!
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : state.phase === "debrief" ? (
          /* VIEW 4: FINAL GLOBAL DEBRIEF & LEADERBOARD */
          <div className="space-y-6">
            <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <Award className="w-3.5 h-3.5" /> Simulation Complete — Final Debrief
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">
                    Table {currentPlayer.tableNumber} ({myTable?.shortName}) Final Score:{" "}
                    <span className="text-cyan-400">{myTable?.totalScore} pts</span>
                  </h1>
                  <p className="text-sm text-slate-300 mt-1">
                    Arena {currentPlayer.arenaNumber} Matchup: Table{" "}
                    {currentPlayer.tableNumber} ({myTable?.totalScore} pts) vs. Table{" "}
                    {rivalTableNumber} ({rivalTable?.totalScore} pts)
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {([1, 2, 3] as const).map((actNum) => {
                  const actDef = ACTS[actNum];
                  const res = myTable?.actResolutions[String(actNum)];
                  return (
                    <div
                      key={actNum}
                      className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2"
                    >
                      <div className="text-xs font-mono text-cyan-400 uppercase">
                        Act {actNum} Takeaway
                      </div>
                      <div className="font-bold text-white text-sm">
                        {actDef.title}
                      </div>
                      <div className="text-xs text-slate-300">
                        <strong>Your Strategy:</strong> {res?.teamDecisionTitle}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-slate-800">
                        {actDef.learningTakeawayBullets[0]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 3: ACTIVE CRISIS ACT (ACT 1, ACT 2, ACT 3) */
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
                {/* SEV-1 Incident Alert Banner */}
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-sm text-rose-200">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span className="font-mono text-xs sm:text-sm font-semibold">
                      {actDef.incidentAlertBanner}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-rose-300">
                    {actDef.realWorldInspiration}
                  </span>
                </div>

                {/* Top Grid: Act Situation Briefing + Live Arena Scoreboard */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                        Act {currentActNumber} of 3 • Crisis Situation Briefing
                      </span>
                      <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        Your Role: {roleDef.title}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
                      {actDef.title}
                    </h1>
                    <p className="text-sm text-slate-400">{actDef.subtitle}</p>

                    <div className="mt-4 space-y-2.5 text-sm text-slate-200 leading-relaxed">
                      {actDef.situationBriefing.map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>

                    {/* Educational SOC Field Note Box */}
                    <div className="mt-5 p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30">
                      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-300 font-semibold">
                        <BookOpen className="w-4 h-4" />
                        {actDef.learningTakeawayTitle}
                      </div>
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                        {actDef.learningTakeawayBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Arena Head-to-Head Status Card */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-400">
                        <span>Arena {currentPlayer.arenaNumber} Matchup</span>
                        <span>
                          {isCurrentActUnlocked ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Unlock className="w-3.5 h-3.5" /> Results Unlocked
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" /> Active Round
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/30">
                          <div className="text-[11px] font-mono text-cyan-300">
                            YOUR TABLE (T{currentPlayer.tableNumber})
                          </div>
                          <div className="font-bold text-white text-sm mt-0.5">
                            {myTable?.shortName}
                          </div>
                          <div className="text-2xl font-extrabold text-white mt-2">
                            {myTable?.totalScore}{" "}
                            <span className="text-xs font-normal text-slate-400">
                              pts
                            </span>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="text-[11px] font-mono text-slate-400">
                            RIVAL TABLE (T{rivalTableNumber})
                          </div>
                          <div className="font-bold text-slate-200 text-sm mt-0.5">
                            {rivalTable?.shortName}
                          </div>
                          <div className="text-2xl font-extrabold text-slate-300 mt-2">
                            {rivalTable?.totalScore}{" "}
                            <span className="text-xs font-normal text-slate-500">
                              pts
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 4 Live Metrics */}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex justify-between">
                          <span className="text-slate-400">Security:</span>
                          <span className="font-mono font-bold text-cyan-400">
                            {myTable?.currentMetrics.security}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex justify-between">
                          <span className="text-slate-400">Capability:</span>
                          <span className="font-mono font-bold text-purple-400">
                            {myTable?.currentMetrics.capability}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex justify-between">
                          <span className="text-slate-400">Public Trust:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {myTable?.currentMetrics.trust}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex justify-between">
                          <span className="text-slate-400">Growth:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {myTable?.currentMetrics.growth}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Table Submission Checklist */}
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <div className="text-xs font-mono uppercase text-slate-400">
                        Table {currentPlayer.tableNumber} Act {currentActNumber} Checklist
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">
                          1. Your Department Action ({roleDef.shortTitle}):
                        </span>
                        {myChosenDeptOption ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Locked In
                          </span>
                        ) : (
                          <span className="text-amber-400">Pending</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">
                          2. Official Table Strategy:
                        </span>
                        {tableChosenDecision ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                          </span>
                        ) : (
                          <span className="text-amber-400">Pending</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">
                          3. Roaming Admin Debrief:
                        </span>
                        {isCurrentActUnlocked ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Unlock className="w-3.5 h-3.5" /> Unlocked!
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Waiting for Admin...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Navigation Tabs */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("role")}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
                      activeTab === "role"
                        ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {ROLE_ICON_MAP[effectiveRoleId]}
                    <span>1. My Department Intel & Action ({roleDef.shortTitle})</span>
                    {myChosenDeptOption && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("team")}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
                      activeTab === "team"
                        ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>2. Official Table Strategy (Team Vote)</span>
                    {tableChosenDecision && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("results")}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
                      activeTab === "results"
                        ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {isCurrentActUnlocked ? (
                      <Unlock className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400" />
                    )}
                    <span>
                      3. Act {currentActNumber} Debrief & Score Breakdown
                    </span>
                  </button>
                </div>

                {/* TAB 1: ROLE-SPECIFIC INTEL & DEPARTMENT ACTION */}
                {activeTab === "role" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase px-2.5 py-1 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {roleDef.department} Telemetry
                        </span>
                        <select
                          aria-label="Switch active role view"
                          value={effectiveRoleId}
                          onChange={(e) =>
                            handleRoleChange(e.target.value as RoleId)
                          }
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-300"
                        >
                          {ROLES.map((r) => (
                            <option key={r.id} value={r.id}>
                              Role: {r.shortTitle}
                            </option>
                          ))}
                        </select>
                      </div>

                      <h2 className="text-lg font-bold text-white">
                        {roleContent.intelHeadline}
                      </h2>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {roleContent.intelBody}
                      </p>

                      {roleContent.terminalSnippet && (
                        <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          <div className="flex items-center gap-1.5 text-slate-500 pb-2 mb-2 border-b border-slate-800">
                            <Terminal className="w-3.5 h-3.5" />
                            <span>LIVE TELEMETRY STREAM</span>
                          </div>
                          {roleContent.terminalSnippet}
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                        <strong className="uppercase font-mono block text-amber-300 mb-1">
                          Speak Up at Your Table:
                        </strong>
                        {roleContent.tablePrompt}
                      </div>
                    </div>

                    <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          Select Your {roleDef.shortTitle} Action for Act{" "}
                          {currentActNumber}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Choose the action your department will execute right now. Once your whole table is ready, switch to Tab 2 to lock in your Lab&apos;s Official Strategy.
                        </p>

                        <div className="mt-4 space-y-3">
                          {roleContent.options.map((opt, idx) => {
                            const isPicked = myChosenDeptOption === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={submitting || isCurrentActUnlocked}
                                onClick={() =>
                                  handleSelectDepartmentAction(opt.id)
                                }
                                className={`w-full text-left p-4 rounded-xl border transition cursor-pointer ${
                                  isPicked
                                    ? "bg-cyan-500/15 border-cyan-400 ring-2 ring-cyan-400/30"
                                    : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="font-semibold text-sm text-white">
                                    <span className="font-mono text-cyan-400 mr-2">
                                      Option {String.fromCharCode(65 + idx)}:
                                    </span>
                                    {opt.label}
                                  </div>
                                  {isPicked && (
                                    <span className="shrink-0 text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-bold">
                                      Locked In
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                                  {opt.summary}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {myChosenDeptOption
                            ? "Your department action is saved! Now discuss the Official Table Strategy."
                            : "Select one option above to lock in your department's move."}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab("team")}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Go to Official Table Strategy</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: OFFICIAL TABLE STRATEGY (5-PERSON TEAM DECISION) */}
                {activeTab === "team" && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <h2 className="text-xl font-bold text-white">
                            Table {currentPlayer.tableNumber} ({myTable?.shortName}) — Official Lab Strategy for Act {currentActNumber}
                          </h2>
                          <p className="text-xs text-slate-400 mt-1">
                            Debate these 4 strategies out loud with all 5 roles at your table. Your choice directly interacts with what Table {rivalTableNumber} ({rivalTable?.shortName}) chooses across the Arena!
                          </p>
                        </div>
                        <div className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                          {tableChosenDecision
                            ? "Table Strategy Submitted — Waiting for Admin Debrief"
                            : "Awaiting Table Strategy Selection"}
                        </div>
                      </div>

                      {/* Department Readiness Strip */}
                      <div className="mb-6 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-xs font-mono uppercase text-slate-400 mb-2">
                          Table {currentPlayer.tableNumber} Department Action Status:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                                  hasSubmitted
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                    : "bg-slate-900 border-slate-800 text-slate-400"
                                }`}
                              >
                                <span className="font-medium">{r.shortTitle}</span>
                                {hasSubmitted ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <span className="text-[10px] font-mono">
                                    Pending
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4 Team Decision Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {actDef.teamDecisions.map((dec) => {
                          const isSelected = tableChosenDecision === dec.id;
                          return (
                            <button
                              key={dec.id}
                              type="button"
                              disabled={submitting || isCurrentActUnlocked}
                              onClick={() => handleSelectTeamDecision(dec.id)}
                              className={`text-left p-5 rounded-xl border transition flex flex-col justify-between cursor-pointer ${
                                isSelected
                                  ? "bg-cyan-500/15 border-cyan-400 ring-2 ring-cyan-400/30"
                                  : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                                    Stance: {dec.stance}
                                  </span>
                                  {isSelected && (
                                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-bold">
                                      Official Table Choice
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-base font-bold text-white">
                                  {dec.title}
                                </h3>
                                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                                  {dec.subtitle}
                                </p>
                              </div>
                              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-cyan-300 font-medium">
                                <span>
                                  {isSelected
                                    ? "Locked in for Table " +
                                      currentPlayer.tableNumber
                                    : "Click to lock in as Table Strategy"}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: ACT DEBRIEF & SCORE BREAKDOWN (LOCKED UNTIL ROAMING ADMIN UNLOCKS) */}
                {activeTab === "results" && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                    {!isCurrentActUnlocked ? (
                      <div className="py-12 text-center max-w-xl mx-auto space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                          <Lock className="w-7 h-7" />
                        </div>
                        <h2 className="text-xl font-bold text-white">
                          Act {currentActNumber} Results Are Locked Pending Admin Debrief
                        </h2>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          Once both tables in{" "}
                          <strong className="text-white">
                            Arena {currentPlayer.arenaNumber} (Tables{" "}
                            {currentPlayer.tableNumber} & {rivalTableNumber})
                          </strong>{" "}
                          have locked in their choices, one of the{" "}
                          <strong className="text-cyan-300">
                            3 Roaming Admins
                          </strong>{" "}
                          will walk up to your Arena, read the crisis outcome summary out loud, and unlock your score breakdown!
                        </p>
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                          Table {currentPlayer.tableNumber} Status:{" "}
                          <strong className="text-white">
                            {tableChosenDecision
                              ? "Ready for Admin Debrief"
                              : "Still needs to lock in Official Table Strategy"}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                          <div>
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <Sparkles className="w-3.5 h-3.5" /> Admin Debrief Unlocked
                            </span>
                            <h2 className="text-xl font-bold text-white mt-2">
                              Act {currentActNumber} Outcome Report — Table{" "}
                              {currentPlayer.tableNumber} ({myTable?.shortName})
                            </h2>
                          </div>
                          <div className="flex items-center gap-2">
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
                                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                              >
                                <span className="text-slate-400">{label}: </span>
                                <span
                                  className={
                                    (val || 0) >= 0
                                      ? "text-emerald-400 font-bold"
                                      : "text-rose-400 font-bold"
                                  }
                                >
                                  {(val || 0) >= 0 ? `+${val}` : val}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Cross-Arena Narrative Summary */}
                        {arenaDebrief && (
                          <div className="p-5 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2">
                            <div className="text-xs font-mono uppercase text-cyan-400">
                              Arena {currentPlayer.arenaNumber} Collision Summary
                            </div>
                            <p className="text-sm text-slate-200 leading-relaxed">
                              {arenaDebrief.readAloudScript.crossArenaCollision}
                            </p>
                            <p className="text-xs text-emerald-300 pt-2 border-t border-slate-800">
                              <strong>SOC Lesson:</strong>{" "}
                              {myResolution?.socLesson}
                            </p>
                          </div>
                        )}

                        {/* 5-Role Department Breakdown */}
                        <div>
                          <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 mb-3">
                            How Each Role at Table {currentPlayer.tableNumber} Performed
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {myResolution?.departmentBreakdown.map((dept) => (
                              <div
                                key={dept.roleId}
                                className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-sm text-white">
                                    {dept.roleTitle}{" "}
                                    {dept.playerNames.length > 0 && (
                                      <span className="text-xs font-normal text-slate-400">
                                        ({dept.playerNames.join(", ")})
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded ${
                                      dept.evaluation === "optimal"
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : dept.evaluation === "risky"
                                        ? "bg-rose-500/15 text-rose-300"
                                        : "bg-amber-500/15 text-amber-300"
                                    }`}
                                  >
                                    {dept.evaluation}
                                  </span>
                                </div>
                                <div className="text-xs text-cyan-300 font-medium">
                                  Choice: {dept.optionLabel}
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">
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
            );
          })()
        )}
      </main>
    </div>
  );
}
