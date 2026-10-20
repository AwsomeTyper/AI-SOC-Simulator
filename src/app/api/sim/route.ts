import { NextRequest, NextResponse } from "next/server";
import {
  ACTS,
  getArenaTables,
  getTableArenaNumber,
  getTableLabId,
  PhaseId,
  RoleId,
  ROLES,
} from "@/lib/scenario";
import {
  appendLog,
  assignRolesAcrossTables,
  buildArenaDebriefPackage,
  computeAllTables,
  createInitialSimulationState,
  getSimulationState,
  seedDemoPlayers,
  updateSimulationState,
} from "@/lib/sim-engine";

export const dynamic = "force-dynamic";

function buildFullPayload(state: Awaited<ReturnType<typeof getSimulationState>>) {
  const computedTables = computeAllTables(state);
  const arenaDebriefs: Record<string, ReturnType<typeof buildArenaDebriefPackage>> = {};

  for (let arena = 1; arena <= 5; arena++) {
    for (const act of [1, 2, 3] as const) {
      arenaDebriefs[`${arena}-${act}`] = buildArenaDebriefPackage(
        state,
        arena,
        act
      );
    }
  }

  return {
    state,
    computedTables,
    arenaDebriefs,
  };
}

export async function GET() {
  const state = await getSimulationState();
  return NextResponse.json(buildFullPayload(state));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const updatedState = await updateSimulationState((draft) => {
      switch (action) {
        case "join_table": {
          const name = String(body.name || "").trim();
          const tableNumber = Number(body.tableNumber);
          const existingPlayerId = body.playerId ? String(body.playerId) : null;

          if (!name || tableNumber < 1 || tableNumber > 10) {
            throw new Error("Please provide your name and select a valid Table (1–10).");
          }

          const labId = getTableLabId(tableNumber);
          const arenaNumber = getTableArenaNumber(tableNumber);
          const id =
            existingPlayerId && draft.players[existingPlayerId]
              ? existingPlayerId
              : `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

          // If roles were already assigned, automatically give a newcomer the least-used role at that table
          let assignedRole: RoleId | null =
            draft.players[id]?.roleId ?? null;

          if (draft.rolesAssigned && !assignedRole) {
            const tablePlayers = Object.values(draft.players).filter(
              (p) => p.tableNumber === tableNumber && p.id !== id
            );
            const roleCounts: Record<RoleId, number> = {
              ceo: 0,
              cyber: 0,
              research: 0,
              growth: 0,
              policy: 0,
            };
            for (const p of tablePlayers) {
              if (p.roleId) roleCounts[p.roleId]++;
            }
            const sortedRoles = (Object.keys(roleCounts) as RoleId[]).sort(
              (a, b) => roleCounts[a] - roleCounts[b]
            );
            assignedRole = sortedRoles[0];
          }

          draft.players[id] = {
            id,
            name,
            tableNumber,
            arenaNumber,
            labId,
            roleId: assignedRole,
            departmentChoices: draft.players[id]?.departmentChoices || {},
            joinedAt: draft.players[id]?.joinedAt || new Date().toISOString(),
          };

          appendLog(draft, {
            arenaNumber,
            tableNumber,
            actor: name,
            category: "player",
            message: `${name} joined Table ${tableNumber} (${draft.tables[tableNumber].shortName}, Arena ${arenaNumber}).`,
          });
          break;
        }

        case "set_player_role": {
          const { playerId, roleId } = body as {
            playerId: string;
            roleId: RoleId;
          };
          const player = draft.players[playerId];
          if (player && ROLES.some((r) => r.id === roleId)) {
            player.roleId = roleId;
          }
          break;
        }

        case "submit_department_action": {
          const { playerId, actNumber, optionId } = body as {
            playerId: string;
            actNumber: 1 | 2 | 3;
            optionId: string;
          };
          const player = draft.players[playerId];
          if (!player) throw new Error("Player session not found.");
          const actKey = String(actNumber);
          if (draft.tables[player.tableNumber]?.unlockedActs[actKey]) {
            throw new Error("This Act has already been debriefed and locked.");
          }

          player.departmentChoices[actKey] = optionId;

          const roleObj = ROLES.find((r) => r.id === player.roleId);
          appendLog(draft, {
            arenaNumber: player.arenaNumber,
            tableNumber: player.tableNumber,
            actNumber,
            actor: `${player.name} (${roleObj?.shortTitle || "Specialist"})`,
            category: "player",
            message: `Table ${player.tableNumber}: ${roleObj?.shortTitle || player.name} locked in their Act ${actNumber} department action.`,
          });
          break;
        }

        case "submit_team_decision": {
          const { tableNumber, actNumber, decisionId, actorName } = body as {
            tableNumber: number;
            actNumber: 1 | 2 | 3;
            decisionId: string;
            actorName?: string;
          };
          const table = draft.tables[tableNumber];
          if (!table) throw new Error("Invalid table number.");
          const actKey = String(actNumber);
          if (table.unlockedActs[actKey]) {
            throw new Error("This Act has already been debriefed and unlocked.");
          }

          table.teamDecisions[actKey] = decisionId;
          const decisionObj = ACTS[actNumber]?.teamDecisions.find(
            (d) => d.id === decisionId
          );

          appendLog(draft, {
            arenaNumber: table.arenaNumber,
            tableNumber,
            actNumber,
            actor: actorName || `Table ${tableNumber} Command`,
            category: "team",
            message: `Table ${tableNumber} (${table.shortName}) locked in Act ${actNumber} Lab Strategy: "${decisionObj?.title || decisionId}". Ready for Admin Debrief!`,
          });
          break;
        }

        case "gm_auto_assign_roles": {
          assignRolesAcrossTables(draft);
          appendLog(draft, {
            actor: "GM-CONTROL",
            category: "system",
            message:
              "Auto-assigned Executive & SOC roles (CEO, SOC Lead, AI Research, Growth, Safety & Policy) across all 10 tables.",
          });
          break;
        }

        case "gm_set_phase": {
          const nextPhase = body.phase as PhaseId;
          if (!["lobby", "act1", "act2", "act3", "debrief"].includes(nextPhase)) {
            throw new Error("Invalid phase.");
          }
          if (nextPhase !== "lobby" && !draft.rolesAssigned) {
            assignRolesAcrossTables(draft);
          }
          draft.phase = nextPhase;
          if (nextPhase === "act1" || nextPhase === "act2" || nextPhase === "act3") {
            draft.timerSecondsRemaining = 12 * 60;
            draft.timerRunning = true;
            draft.timerLastUpdatedAt = Date.now();
          } else if (nextPhase === "debrief") {
            draft.timerRunning = false;
          }

          appendLog(draft, {
            actor: "GM-CONTROL",
            category: "system",
            message: `Global simulation phase advanced to ${nextPhase.toUpperCase()}.`,
          });
          break;
        }

        case "gm_timer_control": {
          const { command, seconds } = body as {
            command: "start" | "pause" | "reset" | "set";
            seconds?: number;
          };
          if (command === "start") {
            draft.timerRunning = true;
            draft.timerLastUpdatedAt = Date.now();
          } else if (command === "pause") {
            draft.timerRunning = false;
          } else if (command === "reset") {
            draft.timerRunning = false;
            draft.timerSecondsRemaining = 12 * 60;
            draft.timerLastUpdatedAt = Date.now();
          } else if (command === "set" && typeof seconds === "number") {
            draft.timerSecondsRemaining = Math.max(0, seconds);
            draft.timerLastUpdatedAt = Date.now();
          }
          break;
        }

        case "admin_unlock_arena_act": {
          const { arenaNumber, actNumber, unlocked, adminName } = body as {
            arenaNumber: number;
            actNumber: 1 | 2 | 3;
            unlocked: boolean;
            adminName?: string;
          };
          const [oddTable, evenTable] = getArenaTables(arenaNumber);
          const actKey = String(actNumber);
          draft.tables[oddTable].unlockedActs[actKey] = unlocked;
          draft.tables[evenTable].unlockedActs[actKey] = unlocked;

          appendLog(draft, {
            arenaNumber,
            actNumber,
            actor: adminName || `Admin (Arena ${arenaNumber})`,
            category: "admin",
            message: `${adminName || "Admin"} ${
              unlocked ? "completed read-aloud debrief and UNLOCKED" : "re-locked"
            } Act ${actNumber} results for Arena ${arenaNumber} (Tables ${oddTable} & ${evenTable}).`,
          });
          break;
        }

        case "admin_unlock_all_arenas_act": {
          const { actNumber, unlocked } = body as {
            actNumber: 1 | 2 | 3;
            unlocked: boolean;
          };
          const actKey = String(actNumber);
          for (let t = 1; t <= 10; t++) {
            draft.tables[t].unlockedActs[actKey] = unlocked;
          }
          appendLog(draft, {
            actNumber,
            actor: "GM / ADMIN",
            category: "admin",
            message: `${
              unlocked ? "Unlocked" : "Locked"
            } Act ${actNumber} results across ALL 5 Arenas (Tables 1–10).`,
          });
          break;
        }

        case "admin_adjust_bonus": {
          const { tableNumber, actNumber, delta, adminName } = body as {
            tableNumber: number;
            actNumber: 1 | 2 | 3;
            delta: number;
            adminName?: string;
          };
          const table = draft.tables[tableNumber];
          if (!table) throw new Error("Invalid table number.");
          const actKey = String(actNumber);
          table.adminBonusByAct[actKey] =
            (table.adminBonusByAct[actKey] || 0) + delta;

          appendLog(draft, {
            arenaNumber: table.arenaNumber,
            tableNumber,
            actNumber,
            actor: adminName || "Roaming Admin",
            category: "admin",
            message: `Admin awarded ${delta >= 0 ? `+${delta}` : delta} discussion bonus points to Table ${tableNumber} (${table.shortName}) in Act ${actNumber}.`,
          });
          break;
        }

        case "gm_seed_demo": {
          seedDemoPlayers(draft);
          appendLog(draft, {
            actor: "GM-CONTROL",
            category: "system",
            message:
              "Seeded 50 demo college student players (5 per table across Tables 1–10) with assigned roles.",
          });
          break;
        }

        case "gm_autofill_act_choices": {
          const actNumber = (body.actNumber || 1) as 1 | 2 | 3;
          const actKey = String(actNumber);
          const actDef = ACTS[actNumber];

          for (const player of Object.values(draft.players)) {
            if (!player.roleId) continue;
            if (!player.departmentChoices[actKey]) {
              const opts = actDef.roleBriefings[player.roleId].options;
              const randomOpt = opts[Math.floor(Math.random() * opts.length)];
              player.departmentChoices[actKey] = randomOpt.id;
            }
          }

          for (let t = 1; t <= 10; t++) {
            if (!draft.tables[t].teamDecisions[actKey]) {
              const decisions = actDef.teamDecisions;
              const pick = decisions[t % decisions.length];
              draft.tables[t].teamDecisions[actKey] = pick.id;
            }
          }

          appendLog(draft, {
            actNumber,
            actor: "GM-CONTROL",
            category: "system",
            message: `Auto-populated remaining player & table choices for Act ${actNumber} for simulation testing.`,
          });
          break;
        }

        case "gm_reset_all": {
          const fresh = createInitialSimulationState();
          Object.assign(draft, fresh);
          break;
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    });

    const latestPlayer =
      body.action === "join_table"
        ? Object.values(updatedState.players).find(
            (p) =>
              p.name === String(body.name || "").trim() &&
              p.tableNumber === Number(body.tableNumber)
          )
        : undefined;

    return NextResponse.json({
      ...buildFullPayload(updatedState),
      joinedPlayer: latestPlayer,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
