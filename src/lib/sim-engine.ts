import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ACTS,
  ActDefinition,
  ActNumber,
  ALL_ACTS,
  getArenaTables,
  getTableArenaNumber,
  getTableLabId,
  LAB_PROFILES,
  LabId,
  MetricDelta,
  PhaseId,
  RoleId,
  ROLES,
} from "./scenario";

export interface PlayerRecord {
  id: string;
  name: string;
  tableNumber: number; // 1..10
  arenaNumber: number; // 1..5
  labId: LabId;
  roleId: RoleId | null;
  // Map of actNumber ("1".."5") -> optionId
  departmentChoices: Record<string, string>;
  joinedAt: string;
}

export interface ActResolutionSummary {
  actNumber: ActNumber;
  teamDecisionId: string | null;
  teamDecisionTitle: string;
  teamDecisionStance: string;
  departmentBreakdown: {
    roleId: RoleId;
    roleTitle: string;
    playerNames: string[];
    optionId: string | null;
    optionLabel: string;
    evaluation: "optimal" | "balanced" | "risky" | "missing";
    debriefNote: string;
    delta: MetricDelta;
  }[];
  teamDecisionDelta: MetricDelta;
  rivalCrossEffectDelta: MetricDelta;
  comboAndCarryOverDelta: MetricDelta;
  totalDelta: MetricDelta;
  triggeredEvents: string[];
  rivalInteractionNote: string;
  jigsawReveal: string;
  adminReadoutParagraph: string;
  socLesson: string;
}

export interface TableState {
  tableNumber: number; // 1..10
  arenaNumber: number; // 1..5
  labId: LabId;
  labName: string;
  shortName: string;
  baseMetrics: MetricDelta;
  // Team decision optionId per act ("1".."5")
  teamDecisions: Record<string, string>;
  // Admin discussion bonus points per act ("1".."5")
  adminBonusByAct: Record<string, number>;
  // Admin custom notes per act
  adminNotesByAct: Record<string, string>;
  // Whether the roaming Admin has unlocked the results for each act ("1".."5")
  unlockedActs: Record<string, boolean>;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  arenaNumber?: number;
  tableNumber?: number;
  actNumber?: number;
  actor: string;
  category: "system" | "player" | "team" | "admin";
  message: string;
}

export interface SimulationState {
  sessionId: string;
  version: number;
  phase: PhaseId;
  rolesAssigned: boolean;
  timerSecondsRemaining: number;
  timerRunning: boolean;
  timerLastUpdatedAt: number;
  tables: Record<number, TableState>;
  players: Record<string, PlayerRecord>;
  auditLogs: AuditLogItem[];
}

export interface ComputedTableView extends TableState {
  currentMetrics: MetricDelta;
  totalScore: number;
  players: PlayerRecord[];
  actResolutions: Record<string, ActResolutionSummary>;
}

export interface ArenaDebriefPackage {
  arenaNumber: number;
  actNumber: ActNumber;
  aegisTable: ComputedTableView;
  vanguardTable: ComputedTableView;
  unlocked: boolean;
  bothTeamsSubmitted: boolean;
  readAloudScript: {
    openingHook: string;
    aegisSummary: string;
    vanguardSummary: string;
    crossArenaCollision: string;
    jigsawAndCarryOver: string;
    socTakeaway: string;
  };
}

const STATE_FILE_PATH = path.join(process.cwd(), ".sim-state.json");

let supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    supabaseAdmin = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabaseAdmin;
}

export function phaseToActNumber(phase: PhaseId): ActNumber {
  if (phase === "act2") return 2;
  if (phase === "act3") return 3;
  if (phase === "act4") return 4;
  if (phase === "act5") return 5;
  return 1;
}

export function createInitialSimulationState(): SimulationState {
  const tables: Record<number, TableState> = {};
  for (let t = 1; t <= 10; t++) {
    const labId = getTableLabId(t);
    const profile = LAB_PROFILES[labId];
    const arenaNumber = getTableArenaNumber(t);
    tables[t] = {
      tableNumber: t,
      arenaNumber,
      labId,
      labName: profile.name,
      shortName: profile.shortName,
      baseMetrics: { ...profile.startingMetrics },
      teamDecisions: {},
      adminBonusByAct: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      adminNotesByAct: {},
      unlockedActs: {
        "1": false,
        "2": false,
        "3": false,
        "4": false,
        "5": false,
      },
    };
  }

  return {
    sessionId: "main",
    version: 1,
    phase: "lobby",
    rolesAssigned: false,
    timerSecondsRemaining: 9 * 60,
    timerRunning: false,
    timerLastUpdatedAt: Date.now(),
    tables,
    players: {},
    auditLogs: [
      {
        id: "init-1",
        timestamp: new Date().toISOString(),
        actor: "SIM-CORE",
        category: "system",
        message:
          "AI Lab & SOC 5-Act Crisis Simulator initialized across 5 Arenas (Tables 1–10).",
      },
    ],
  };
}

// Global singleton in Node memory + disk + Supabase sync
declare global {
  // eslint-disable-next-line no-var
  var __AI_SOC_SIM_STATE__: SimulationState | undefined;
  // eslint-disable-next-line no-var
  var __AI_SOC_LAST_DB_FETCH_MS__: number | undefined;
}

function normalizeLoadedState(state: SimulationState): SimulationState {
  for (let t = 1; t <= 10; t++) {
    if (state.tables?.[t]) {
      for (const actNum of ALL_ACTS) {
        const k = String(actNum);
        if (state.tables[t].adminBonusByAct[k] === undefined) {
          state.tables[t].adminBonusByAct[k] = 0;
        }
        if (state.tables[t].unlockedActs[k] === undefined) {
          state.tables[t].unlockedActs[k] = false;
        }
      }
    }
  }
  return state;
}

function loadFromDisk(): SimulationState | null {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, "utf-8");
      return normalizeLoadedState(JSON.parse(raw) as SimulationState);
    }
  } catch {
    // ignore
  }
  return null;
}

function saveToDisk(state: SimulationState) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // ignore in read-only environments
  }
}

async function syncToSupabase(state: SimulationState) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    await sb.from("sim_sessions").upsert(
      {
        id: "main",
        phase: state.phase,
        current_act: phaseToActNumber(state.phase),
        timer_seconds: state.timerSecondsRemaining,
        timer_running: state.timerRunning,
        state_json: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    // Non-blocking fallback to local memory/disk
  }
}

export async function getSimulationState(
  forceDbCheck = false
): Promise<SimulationState> {
  if (!global.__AI_SOC_SIM_STATE__) {
    const diskState = loadFromDisk();
    if (diskState) {
      global.__AI_SOC_SIM_STATE__ = diskState;
    } else {
      global.__AI_SOC_SIM_STATE__ = createInitialSimulationState();
    }
  }

  const nowMs = Date.now();
  if (
    forceDbCheck ||
    !global.__AI_SOC_LAST_DB_FETCH_MS__ ||
    nowMs - global.__AI_SOC_LAST_DB_FETCH_MS__ > 1000
  ) {
    global.__AI_SOC_LAST_DB_FETCH_MS__ = nowMs;
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data } = await sb
          .from("sim_sessions")
          .select("state_json")
          .eq("id", "main")
          .single();
        if (
          data?.state_json &&
          typeof data.state_json === "object" &&
          "version" in data.state_json &&
          (data.state_json as SimulationState).version >
            (global.__AI_SOC_SIM_STATE__?.version ?? 0)
        ) {
          global.__AI_SOC_SIM_STATE__ = normalizeLoadedState(
            data.state_json as SimulationState
          );
          saveToDisk(global.__AI_SOC_SIM_STATE__);
        }
      } catch {
        // Ignore if table doesn't exist yet
      }
    }
  }

  const state = normalizeLoadedState(global.__AI_SOC_SIM_STATE__!);
  if (state.timerRunning) {
    const now = Date.now();
    const elapsedSec = Math.floor((now - state.timerLastUpdatedAt) / 1000);
    if (elapsedSec > 0) {
      state.timerSecondsRemaining = Math.max(
        0,
        state.timerSecondsRemaining - elapsedSec
      );
      state.timerLastUpdatedAt = now;
      if (state.timerSecondsRemaining === 0) {
        state.timerRunning = false;
      }
    }
  }

  return state;
}

export async function updateSimulationState(
  mutator: (draft: SimulationState) => void
): Promise<SimulationState> {
  const state = await getSimulationState(true);
  const prevVersion = state.version || 1;
  mutator(state);
  state.version = Math.max(prevVersion, state.version || 1) + 1;
  if (state.auditLogs.length > 120) {
    state.auditLogs = state.auditLogs.slice(0, 120);
  }
  saveToDisk(state);
  await syncToSupabase(state);
  return state;
}

export function appendLog(
  state: SimulationState,
  entry: Omit<AuditLogItem, "id" | "timestamp">
) {
  state.auditLogs.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

function addDelta(a: MetricDelta, b: MetricDelta): MetricDelta {
  return {
    security: a.security + b.security,
    capability: a.capability + b.capability,
    trust: a.trust + b.trust,
    growth: a.growth + b.growth,
  };
}

function clampMetric(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function assignRolesAcrossTables(state: SimulationState) {
  const roleOrder: RoleId[] = ["ceo", "cyber", "research", "growth", "policy"];

  for (let t = 1; t <= 10; t++) {
    const tablePlayers = Object.values(state.players)
      .filter((p) => p.tableNumber === t)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

    tablePlayers.forEach((player, idx) => {
      player.roleId = roleOrder[idx % roleOrder.length];
    });
  }
  state.rolesAssigned = true;
}

function getChosenOptionForRole(
  tablePlayers: PlayerRecord[],
  roleId: RoleId,
  actNumber: ActNumber
): string | null {
  const actKey = String(actNumber);
  return (
    tablePlayers
      .filter((p) => p.roleId === roleId)
      .map((p) => p.departmentChoices[actKey])
      .find((val) => Boolean(val)) || null
  );
}

export function computeTableResolutionForAct(
  state: SimulationState,
  tableNumber: number,
  actNumber: ActNumber
): ActResolutionSummary {
  const actKey = String(actNumber);
  const actDef: ActDefinition = ACTS[actNumber];
  const table = state.tables[tableNumber];
  const [oddTable, evenTable] = getArenaTables(table.arenaNumber);
  const rivalTableNumber = tableNumber === oddTable ? evenTable : oddTable;
  const rivalTable = state.tables[rivalTableNumber];

  const tablePlayers = Object.values(state.players).filter(
    (p) => p.tableNumber === tableNumber
  );

  let deptTotalDelta: MetricDelta = {
    security: 0,
    capability: 0,
    trust: 0,
    growth: 0,
  };

  const chosenOptionIdsThisAct = new Set<string>();

  const departmentBreakdown = ROLES.map((roleDef) => {
    const rolePlayers = tablePlayers.filter((p) => p.roleId === roleDef.id);
    const roleAct = actDef.roleBriefings[roleDef.id];
    const chosenOptionId = getChosenOptionForRole(
      tablePlayers,
      roleDef.id,
      actNumber
    );

    const chosenOption =
      roleAct.options.find((o) => o.id === chosenOptionId) || null;

    if (chosenOption) {
      chosenOptionIdsThisAct.add(chosenOption.id);
    }

    const delta: MetricDelta = chosenOption
      ? chosenOption.impact
      : { security: 0, capability: 0, trust: 0, growth: 0 };

    deptTotalDelta = addDelta(deptTotalDelta, delta);

    const evaluation: "optimal" | "balanced" | "risky" | "missing" = chosenOption
      ? chosenOption.socEvaluation
      : "missing";

    return {
      roleId: roleDef.id,
      roleTitle: roleDef.shortTitle,
      playerNames: rolePlayers.map((p) => p.name),
      optionId: chosenOption?.id || null,
      optionLabel: chosenOption
        ? chosenOption.label
        : "No department action locked in",
      evaluation,
      debriefNote: chosenOption
        ? chosenOption.debriefNote
        : "Department did not submit an action before lockdown.",
      delta,
    };
  });

  const teamDecisionId = table.teamDecisions[actKey] || null;
  const teamDecisionObj =
    actDef.teamDecisions.find((d) => d.id === teamDecisionId) || null;

  const teamDecisionDelta: MetricDelta = teamDecisionObj
    ? teamDecisionObj.impact
    : { security: 0, capability: 0, trust: 0, growth: 0 };

  const rivalDecisionId = rivalTable.teamDecisions[actKey] || null;
  const rivalDecisionObj =
    actDef.teamDecisions.find((d) => d.id === rivalDecisionId) || null;

  let rivalCrossEffectDelta: MetricDelta = rivalDecisionObj
    ? { ...rivalDecisionObj.rivalEffect }
    : { security: 0, capability: 0, trust: 0, growth: 0 };

  let comboAndCarryOverDelta: MetricDelta = {
    security: 0,
    capability: 0,
    trust: 0,
    growth: 0,
  };
  const triggeredEvents: string[] = [];

  // 1. Evaluate Cross-Role Combos (Synergies & Silo Contradictions within the table)
  for (const combo of actDef.combos) {
    const allMatched = combo.requiredOptionIds.every((id) =>
      chosenOptionIdsThisAct.has(id)
    );
    if (allMatched) {
      comboAndCarryOverDelta = addDelta(comboAndCarryOverDelta, combo.delta);
      triggeredEvents.push(`${combo.title}: ${combo.description}`);
    }
  }

  // 2. Evaluate Carry-Over Consequences from Earlier Acts
  if (actNumber === 2) {
    const act1Decision = table.teamDecisions["1"];
    const act1Cyber = getChosenOptionForRole(tablePlayers, "cyber", 1);
    if (
      act1Decision === "act1_team_blitz_forward" ||
      act1Cyber === "cyber_1_firewall_ip_block"
    ) {
      const penalty = { security: -4, capability: 0, trust: -2, growth: 0 };
      comboAndCarryOverDelta = addDelta(comboAndCarryOverDelta, penalty);
      triggeredEvents.push(
        "Act 1 Carry-Over Penalty (-4 Sec, -2 Trust): Because your table blocked only the IP in Act 1 without rotating OpenHub tokens, the attacker used that active token to speed up the Act 2 MCP injection."
      );
    }
  }

  if (actNumber === 3) {
    const rivalAct2Decision = rivalTable.teamDecisions["2"];
    if (rivalAct2Decision === "act2_team_lock_mcp_and_share_cve") {
      const bonus = { security: 3, capability: 0, trust: 2, growth: 0 };
      comboAndCarryOverDelta = addDelta(comboAndCarryOverDelta, bonus);
      triggeredEvents.push(
        `Rival Act 2 CVE Advisory (+3 Sec, +2 Trust): Table ${rivalTableNumber}'s early MCP CVE disclosure helped your engineers patch before the swarm escalated.`
      );
    }
  }

  if (actNumber === 4) {
    const act2Decision = table.teamDecisions["2"];
    const act2Cyber = getChosenOptionForRole(tablePlayers, "cyber", 2);
    if (
      act2Decision === "act2_team_keep_sprint_velocity" ||
      act2Decision === "act2_team_prompt_patch_only" ||
      act2Cyber === "cyber_2_block_domain_keep_iam"
    ) {
      const penalty = { security: -5, capability: 0, trust: -3, growth: 0 };
      comboAndCarryOverDelta = addDelta(comboAndCarryOverDelta, penalty);
      triggeredEvents.push(
        "Act 2 Carry-Over Penalty (-5 Sec, -3 Trust): Because developer AWS/partner keys were not rotated in Act 2, the attacker used those exact stolen keys to stage the 14:12 UTC deepfake call and upload the poisoned RAG PDF!"
      );
    }
  }

  if (actNumber === 5) {
    const act1Cyber = getChosenOptionForRole(tablePlayers, "cyber", 1);
    const act1Decision = table.teamDecisions["1"];
    const wipedForensicsInAct1 =
      act1Cyber === "cyber_1_wipe_reboot" ||
      act1Decision === "act1_team_wipe_and_deny";

    const act4Cyber = getChosenOptionForRole(tablePlayers, "cyber", 4);
    const act4Decision = table.teamDecisions["4"];
    const severedPort8443InAct4 =
      act4Cyber === "cyber_4_sever_8443_and_rekey" ||
      act4Decision === "act4_team_fido2_and_joint_takedown" ||
      act4Decision === "act4_team_internal_lockdown";

    if (wipedForensicsInAct1) {
      const penalty = { security: -3, capability: 0, trust: -5, growth: 0 };
      comboAndCarryOverDelta = addDelta(comboAndCarryOverDelta, penalty);
      triggeredEvents.push(
        "Act 1 Carry-Over Penalty (-3 Sec, -5 Trust): Because your table wiped gpu-stage-04 in Act 1 before saving RAM forensics, your Act 5 NetFlow timeline had a gap that reporters questioned."
      );
    }

    if (severedPort8443InAct4) {
      const bonus = { security: 5, capability: 2, trust: 4, growth: 0 };
      comboAndCarryOverDelta = addDelta(comboAndCarryOverDelta, bonus);
      triggeredEvents.push(
        "Act 4 Carry-Over Bonus (+5 Sec, +4 Trust): Because you severed Port 8443 immediately during the Act 4 deepfake call, the 36.8 MB transfer was cut off mid-header—your Defense LoRA weights remained safe!"
      );
    } else if (
      act4Decision === "act4_team_honeypot_and_spin" ||
      act4Cyber === "cyber_4_honeypot_watch"
    ) {
      const penalty = { security: -6, capability: 0, trust: -4, growth: -2 };
      comboAndCarryOverDelta = addDelta(comboAndCarryOverDelta, penalty);
      triggeredEvents.push(
        "Act 4 Carry-Over Penalty (-6 Sec, -4 Trust): Because Port 8443 was left open as a honeypot in Act 4, the attacker finished downloading your 36.8 MB Defense LoRA adapter!"
      );
    }
  }

  // 3. Direct Aegis <-> Vanguard Head-to-Head Arena Interaction (Current & Previous Act)
  let rivalInteractionNote = `Rival Table ${rivalTableNumber} (${rivalTable.shortName}) has not locked in a decision yet.`;
  if (teamDecisionObj && rivalDecisionObj) {
    if (
      teamDecisionObj.stance === "cooperative" &&
      rivalDecisionObj.stance === "cooperative"
    ) {
      const mutualBonus = { security: 3, capability: 0, trust: 3, growth: 1 };
      rivalCrossEffectDelta = addDelta(rivalCrossEffectDelta, mutualBonus);
      rivalInteractionNote = `Mutual Arena Pact: Both Table ${tableNumber} and Rival Table ${rivalTableNumber} shared IOCs—earning a joint +3 Security / +3 Trust resilience bonus.`;
    } else if (
      teamDecisionObj.stance === "cooperative" &&
      rivalDecisionObj.stance === "aggressive"
    ) {
      rivalInteractionNote = `Asymmetric Clash: You shared threat intel transparently while Table ${rivalTableNumber} weaponized the crisis to poach your clients (${rivalCrossEffectDelta.growth} Growth today, but CISA logs will penalize their Trust next round).`;
    } else if (
      teamDecisionObj.stance === "aggressive" &&
      rivalDecisionObj.stance === "cooperative"
    ) {
      rivalInteractionNote = `Predatory Edge: You capitalized on Table ${rivalTableNumber}'s transparency to win short-term deals, but CISA audit logs recorded your bad-faith poaching for next round.`;
    } else if (
      teamDecisionObj.stance === "aggressive" &&
      rivalDecisionObj.stance === "aggressive"
    ) {
      const mutualPenalty = {
        security: -3,
        capability: 0,
        trust: -4,
        growth: -2,
      };
      rivalCrossEffectDelta = addDelta(rivalCrossEffectDelta, mutualPenalty);
      rivalInteractionNote = `Arena Bloodbath: Both Table ${tableNumber} and Table ${rivalTableNumber} attacked each other simultaneously—causing mutual CISO backlash (-3 Sec, -4 Trust).`;
    } else {
      rivalInteractionNote = `Table ${tableNumber} took a ${teamDecisionObj.stance} stance while Rival Table ${rivalTableNumber} chose a ${rivalDecisionObj.stance} posture.`;
    }
  }

  // Check if aggressive poaching in the PREVIOUS Act triggers CISA audit backlash in THIS Act
  if (actNumber > 1) {
    const prevKey = String(actNumber - 1);
    const prevActDef = ACTS[(actNumber - 1) as ActNumber];
    const myPrevDec = prevActDef.teamDecisions.find(
      (d) => d.id === table.teamDecisions[prevKey]
    );
    const rivalPrevDec = prevActDef.teamDecisions.find(
      (d) => d.id === rivalTable.teamDecisions[prevKey]
    );
    if (
      myPrevDec?.stance === "aggressive" &&
      rivalPrevDec?.stance === "cooperative"
    ) {
      const backlash = { security: 0, capability: 0, trust: -6, growth: -3 };
      comboAndCarryOverDelta = addDelta(comboAndCarryOverDelta, backlash);
      triggeredEvents.push(
        `Cross-Arena Audit Backlash (-6 Trust, -3 Growth): CISA logs from Act ${
          actNumber - 1
        } exposed that you poached Table ${rivalTableNumber}'s clients while hiding the same vulnerability.`
      );
    }
  }

  const totalDelta = addDelta(
    addDelta(addDelta(deptTotalDelta, teamDecisionDelta), rivalCrossEffectDelta),
    comboAndCarryOverDelta
  );

  return {
    actNumber,
    teamDecisionId,
    teamDecisionTitle: teamDecisionObj
      ? teamDecisionObj.title
      : "No Official Lab Decision Submitted",
    teamDecisionStance: teamDecisionObj ? teamDecisionObj.stance : "none",
    departmentBreakdown,
    teamDecisionDelta,
    rivalCrossEffectDelta,
    comboAndCarryOverDelta,
    totalDelta,
    triggeredEvents,
    rivalInteractionNote,
    jigsawReveal: actDef.jigsawReveal,
    adminReadoutParagraph: teamDecisionObj
      ? teamDecisionObj.adminReadoutSummary
      : `${table.shortName} hesitated to lock in a unified executive response during Act ${actNumber}, leaving individual departments to operate in silos.`,
    socLesson: teamDecisionObj
      ? teamDecisionObj.socLesson
      : actDef.learningTakeawayBullets[0],
  };
}

export function computeAllTables(
  state: SimulationState
): Record<number, ComputedTableView> {
  const result: Record<number, ComputedTableView> = {};

  for (let t = 1; t <= 10; t++) {
    const table = state.tables[t];
    const players = Object.values(state.players)
      .filter((p) => p.tableNumber === t)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

    const actResolutions: Record<string, ActResolutionSummary> = {};
    for (const actNum of ALL_ACTS) {
      actResolutions[String(actNum)] = computeTableResolutionForAct(
        state,
        t,
        actNum
      );
    }

    let runningMetrics: MetricDelta = { ...table.baseMetrics };
    let totalBonus = 0;

    for (const actNum of ALL_ACTS) {
      const k = String(actNum);
      if (table.unlockedActs[k] || state.phase === "debrief") {
        runningMetrics = addDelta(runningMetrics, actResolutions[k].totalDelta);
        totalBonus += table.adminBonusByAct[k] || 0;
      }
    }

    const clamped: MetricDelta = {
      security: clampMetric(runningMetrics.security),
      capability: clampMetric(runningMetrics.capability),
      trust: clampMetric(runningMetrics.trust),
      growth: clampMetric(runningMetrics.growth),
    };

    const totalScore =
      clamped.security +
      clamped.capability +
      clamped.trust +
      clamped.growth +
      totalBonus;

    result[t] = {
      ...table,
      currentMetrics: clamped,
      totalScore,
      players,
      actResolutions,
    };
  }

  return result;
}

export function buildArenaDebriefPackage(
  state: SimulationState,
  arenaNumber: number,
  actNumber: ActNumber
): ArenaDebriefPackage {
  const computed = computeAllTables(state);
  const [oddTableNum, evenTableNum] = getArenaTables(arenaNumber);
  const aegisTable = computed[oddTableNum];
  const vanguardTable = computed[evenTableNum];
  const actKey = String(actNumber);
  const actDef = ACTS[actNumber];

  const aegisRes = aegisTable.actResolutions[actKey];
  const vanguardRes = vanguardTable.actResolutions[actKey];

  const unlocked = Boolean(
    aegisTable.unlockedActs[actKey] && vanguardTable.unlockedActs[actKey]
  );
  const bothTeamsSubmitted = Boolean(
    aegisTable.teamDecisions[actKey] && vanguardTable.teamDecisions[actKey]
  );

  let crossArenaCollision = "";
  if (
    aegisRes.teamDecisionStance === "cooperative" &&
    vanguardRes.teamDecisionStance === "cooperative"
  ) {
    crossArenaCollision = `In Arena ${arenaNumber}, BOTH Table ${oddTableNum} (Aegis AI) and Table ${evenTableNum} (Vanguard AI) chose cooperative threat-sharing—earning a mutual cross-arena security & trust bonus!`;
  } else if (
    aegisRes.teamDecisionStance === "cooperative" &&
    (vanguardRes.teamDecisionStance === "aggressive" ||
      vanguardRes.teamDecisionStance === "coverup")
  ) {
    crossArenaCollision = `Arena ${arenaNumber} Clash: Table ${oddTableNum} (Aegis AI) shared forensic IOCs transparently, while Table ${evenTableNum} (Vanguard AI) took a ${vanguardRes.teamDecisionStance} stance to grab short-term commercial ground—setting up a CISA audit backlash against Vanguard next round.`;
  } else if (
    vanguardRes.teamDecisionStance === "cooperative" &&
    (aegisRes.teamDecisionStance === "aggressive" ||
      aegisRes.teamDecisionStance === "coverup")
  ) {
    crossArenaCollision = `Arena ${arenaNumber} Clash: Table ${evenTableNum} (Vanguard AI) shared forensic IOCs transparently, while Table ${oddTableNum} (Aegis AI) took a ${aegisRes.teamDecisionStance} path—setting up a CISA audit backlash against Aegis next round.`;
  } else if (
    aegisRes.teamDecisionStance === "aggressive" &&
    vanguardRes.teamDecisionStance === "aggressive"
  ) {
    crossArenaCollision = `Cutthroat collision in Arena ${arenaNumber}! Both Table ${oddTableNum} (Aegis AI) and Table ${evenTableNum} (Vanguard AI) went on the offensive against each other instead of focusing on containment—causing mutual CISO trust penalties.`;
  } else {
    crossArenaCollision = `In Arena ${arenaNumber}, Table ${oddTableNum} (Aegis AI) chose a ${aegisRes.teamDecisionStance} strategy while Table ${evenTableNum} (Vanguard AI) chose a ${vanguardRes.teamDecisionStance} approach.`;
  }

  return {
    arenaNumber,
    actNumber,
    aegisTable,
    vanguardTable,
    unlocked,
    bothTeamsSubmitted,
    readAloudScript: {
      openingHook: `Arena ${arenaNumber} (Table ${oddTableNum} Aegis AI & Table ${evenTableNum} Vanguard AI) — Debrief for ${actDef.title}:`,
      aegisSummary: `Table ${oddTableNum} (Aegis AI) chose "${aegisRes.teamDecisionTitle}". ${aegisRes.adminReadoutParagraph}`,
      vanguardSummary: `Table ${evenTableNum} (Vanguard AI) chose "${vanguardRes.teamDecisionTitle}". ${vanguardRes.adminReadoutParagraph}`,
      crossArenaCollision,
      jigsawAndCarryOver: actDef.jigsawReveal,
      socTakeaway: `Key Takeaway: ${actDef.learningTakeawayBullets[0]}`,
    },
  };
}

export function seedDemoPlayers(state: SimulationState) {
  const firstNames = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey",
    "Riley", "Cameron", "Quinn", "Avery", "Parker",
    "Sawyer", "Peyton", "Blake", "Hayden", "Rowan",
    "Dakota", "Reese", "Finley", "Emerson", "Tatum",
    "Kai", "Devon", "Skyler", "Kendall", "Logan",
    "Micah", "Elena", "Marcus", "Priya", "Liam",
    "Sophia", "Noah", "Maya", "Ethan", "Chloe",
    "Lucas", "Zoe", "Mason", "Lily", "Owen",
    "Aria", "Caleb", "Nadia", "Leo", "Grace",
    "Isaac", "Hannah", "Julian", "Layla", "Miles",
  ];

  const roleOrder: RoleId[] = ["ceo", "cyber", "research", "growth", "policy"];

  const preservedHumanPlayers: Record<string, PlayerRecord> = {};
  for (const [id, p] of Object.entries(state.players)) {
    if (!id.startsWith("demo-")) {
      preservedHumanPlayers[id] = p;
    }
  }
  state.players = preservedHumanPlayers;

  let idx = 0;
  for (let t = 1; t <= 10; t++) {
    const labId = getTableLabId(t);
    const arenaNumber = getTableArenaNumber(t);
    const existingAtTable = Object.values(state.players).filter(
      (p) => p.tableNumber === t
    );

    const takenRoles = new Set<RoleId>();
    for (const hp of existingAtTable) {
      if (hp.roleId) {
        takenRoles.add(hp.roleId);
      }
    }
    for (const hp of existingAtTable) {
      if (!hp.roleId) {
        const openRole =
          roleOrder.find((r) => !takenRoles.has(r)) || "cyber";
        hp.roleId = openRole;
        takenRoles.add(openRole);
      }
    }

    for (let r = 0; r < 5; r++) {
      const roleId = roleOrder[r];
      if (takenRoles.has(roleId)) continue;
      const name = firstNames[idx % firstNames.length];
      const id = `demo-t${t}-p${r + 1}`;
      state.players[id] = {
        id,
        name: `${name} (T${t})`,
        tableNumber: t,
        arenaNumber,
        labId,
        roleId,
        departmentChoices: {},
        joinedAt: new Date(Date.now() + idx * 100).toISOString(),
      };
      idx++;
    }
  }
  state.rolesAssigned = true;
}
