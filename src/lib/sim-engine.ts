import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ACTS,
  ActDefinition,
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
  // Map of actNumber ("1" | "2" | "3") -> optionId
  departmentChoices: Record<string, string>;
  joinedAt: string;
}

export interface ActResolutionSummary {
  actNumber: 1 | 2 | 3;
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
  totalDelta: MetricDelta;
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
  // Team decision optionId per act ("1" | "2" | "3")
  teamDecisions: Record<string, string>;
  // Admin discussion bonus points per act ("1" | "2" | "3")
  adminBonusByAct: Record<string, number>;
  // Admin custom notes per act
  adminNotesByAct: Record<string, string>;
  // Whether the roaming Admin has unlocked the results for each act ("1" | "2" | "3")
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
  actNumber: 1 | 2 | 3;
  aegisTable: ComputedTableView;
  vanguardTable: ComputedTableView;
  unlocked: boolean;
  bothTeamsSubmitted: boolean;
  readAloudScript: {
    openingHook: string;
    aegisSummary: string;
    vanguardSummary: string;
    crossArenaCollision: string;
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
      adminBonusByAct: { "1": 0, "2": 0, "3": 0 },
      adminNotesByAct: {},
      unlockedActs: { "1": false, "2": false, "3": false },
    };
  }

  return {
    sessionId: "main",
    version: 1,
    phase: "lobby",
    rolesAssigned: false,
    timerSecondsRemaining: 15 * 60,
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
          "AI Lab & SOC Crisis Simulator initialized across 5 Arenas (Tables 1–10).",
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

function loadFromDisk(): SimulationState | null {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, "utf-8");
      return JSON.parse(raw) as SimulationState;
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
        current_act:
          state.phase === "act2" ? 2 : state.phase === "act3" ? 3 : 1,
        timer_seconds: state.timerSecondsRemaining,
        timer_running: state.timerRunning,
        state_json: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    // Non-blocking fallback to local memory/disk if table not yet migrated or offline
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

  // Poll Supabase at most once per 1000ms (or immediately before mutations) so Vercel serverless instances stay in sync
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
          global.__AI_SOC_SIM_STATE__ = data.state_json as SimulationState;
          saveToDisk(global.__AI_SOC_SIM_STATE__);
        }
      } catch {
        // Ignore if table doesn't exist yet
      }
    }
  }

  // Advance live countdown timer if running
  const state = global.__AI_SOC_SIM_STATE__!;
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

export function computeTableResolutionForAct(
  state: SimulationState,
  tableNumber: number,
  actNumber: 1 | 2 | 3
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

  const departmentBreakdown = ROLES.map((roleDef) => {
    const rolePlayers = tablePlayers.filter((p) => p.roleId === roleDef.id);
    const roleAct = actDef.roleBriefings[roleDef.id];
    // Find first player with this role who submitted an option, or check any player at table
    const chosenOptionId =
      rolePlayers
        .map((p) => p.departmentChoices[actKey])
        .find((val) => Boolean(val)) || null;

    const chosenOption =
      roleAct.options.find((o) => o.id === chosenOptionId) || null;

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
        : "Department did not submit a specialized action before lockdown.",
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

  const rivalCrossEffectDelta: MetricDelta = rivalDecisionObj
    ? rivalDecisionObj.rivalEffect
    : { security: 0, capability: 0, trust: 0, growth: 0 };

  const totalDelta = addDelta(
    addDelta(deptTotalDelta, teamDecisionDelta),
    rivalCrossEffectDelta
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
    totalDelta,
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

    const actResolutions: Record<string, ActResolutionSummary> = {
      "1": computeTableResolutionForAct(state, t, 1),
      "2": computeTableResolutionForAct(state, t, 2),
      "3": computeTableResolutionForAct(state, t, 3),
    };

    let runningMetrics: MetricDelta = { ...table.baseMetrics };
    let totalBonus = 0;

    for (const actNum of [1, 2, 3] as const) {
      const k = String(actNum);
      // Apply score changes for acts that are unlocked OR when in debrief
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
  actNumber: 1 | 2 | 3
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

  // Build dynamic collision narrative between Aegis (Odd Table) and Vanguard (Even Table)
  let crossArenaCollision = "";
  if (
    aegisRes.teamDecisionStance === "cooperative" &&
    vanguardRes.teamDecisionStance === "cooperative"
  ) {
    crossArenaCollision = `In Arena ${arenaNumber}, BOTH Table ${oddTableNum} (Aegis AI) and Table ${evenTableNum} (Vanguard AI) chose cooperative threat-sharing! By exchanging Indicators of Compromise (IOCs) instead of attacking each other, both labs earned a +4/+5 cross-arena security resilience bonus.`;
  } else if (
    aegisRes.teamDecisionStance === "cooperative" &&
    (vanguardRes.teamDecisionStance === "aggressive" ||
      vanguardRes.teamDecisionStance === "coverup")
  ) {
    crossArenaCollision = `Dramatic contrast in Arena ${arenaNumber}: Table ${oddTableNum} (Aegis AI) transparently shared forensic threat intel with CISA and their rival, while Table ${evenTableNum} (Vanguard AI) took a ${vanguardRes.teamDecisionStance} stance. Aegis earned major regulatory trust, while Vanguard's aggressive posture backfired once federal logs exposed the full timeline.`;
  } else if (
    vanguardRes.teamDecisionStance === "cooperative" &&
    (aegisRes.teamDecisionStance === "aggressive" ||
      aegisRes.teamDecisionStance === "coverup")
  ) {
    crossArenaCollision = `Dramatic contrast in Arena ${arenaNumber}: Table ${evenTableNum} (Vanguard AI) stepped up with transparent forensic threat-sharing, while Table ${oddTableNum} (Aegis AI) took a ${aegisRes.teamDecisionStance} path. Vanguard captured enterprise CISO trust, while Aegis took a heavy regulatory credibility hit.`;
  } else if (
    aegisRes.teamDecisionStance === "aggressive" &&
    vanguardRes.teamDecisionStance === "aggressive"
  ) {
    crossArenaCollision = `Cutthroat collision in Arena ${arenaNumber}! Both Table ${oddTableNum} (Aegis AI) and Table ${evenTableNum} (Vanguard AI) went on the offensive against each other instead of focusing on containment—causing mutual brand damage and leaving lingering security vulnerabilities on both sides.`;
  } else {
    crossArenaCollision = `In Arena ${arenaNumber}, Table ${oddTableNum} (Aegis AI) adopted a ${aegisRes.teamDecisionStance} strategy while Table ${evenTableNum} (Vanguard AI) chose a ${vanguardRes.teamDecisionStance} approach.`;
  }

  const aegisOptimalCount = aegisRes.departmentBreakdown.filter(
    (d) => d.evaluation === "optimal"
  ).length;
  const vanguardOptimalCount = vanguardRes.departmentBreakdown.filter(
    (d) => d.evaluation === "optimal"
  ).length;

  return {
    arenaNumber,
    actNumber,
    aegisTable,
    vanguardTable,
    unlocked,
    bothTeamsSubmitted,
    readAloudScript: {
      openingHook: `Attention Arena ${arenaNumber} (Table ${oddTableNum} Aegis AI & Table ${evenTableNum} Vanguard AI): Here is the official SOC debrief for ${actDef.title}.`,
      aegisSummary: `Table ${oddTableNum} (Aegis AI) chose "${aegisRes.teamDecisionTitle}". ${aegisRes.adminReadoutParagraph} Across their 5 departments, ${aegisOptimalCount} of 5 leads executed optimal security playbooks.`,
      vanguardSummary: `Table ${evenTableNum} (Vanguard AI) chose "${vanguardRes.teamDecisionTitle}". ${vanguardRes.adminReadoutParagraph} Across their 5 departments, ${vanguardOptimalCount} of 5 leads executed optimal security playbooks.`,
      crossArenaCollision,
      socTakeaway: `Key SOC Takeaway for Act ${actNumber}: ${actDef.learningTakeawayBullets[0]} ${actDef.learningTakeawayBullets[1]}`,
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

  // Keep any real human players who already checked in so solo testers aren't logged out
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

    // Ensure any human players at this table have a role assigned
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

    // Fill remaining open roles at this table with demo students up to 5 total
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
