/**
 * abb-robot-tool.ts
 * OpenClaw MCP agent tool for controlling actual ABB robots
 * 
 * Provides natural language interface to ABB robot control via PC SDK
 */

import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { ABBController, createController, type ControllerConfig } from "./abb-controller.js";
import {
  loadRobotConfig,
  validateJointValues,
  resolvePreset,
  resolveSequence,
  listRobots,
  identifyRobot,
  type RobotConfig,
} from "./robot-config-loader.js";

// ── Global state ─────────────────────────────────────────────────────────────

let controller: ABBController | null = null;
let currentConfig: RobotConfig | null = null;
const configCache = new Map<string, RobotConfig>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCfg(robotId: string): RobotConfig {
  if (!configCache.has(robotId)) {
    configCache.set(robotId, loadRobotConfig(robotId));
  }
  return configCache.get(robotId)!;
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `❌ abb_robot error: ${message}` }],
    details: { error: message },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ── Tool ─────────────────────────────────────────────────────────────────────

export function createABBRobotTool(pluginConfig: Record<string, unknown>): AnyAgentTool {
  return {
    name: "abb_robot",
    label: "ABB Robot Control",
    description:
      "Control actual ABB robots via PC SDK. Connect to robot controllers, " +
      "move robots to joint positions, execute RAPID programs, apply presets, " +
      "run motion sequences, and query robot status. Supports automatic robot " +
      "identification based on DH parameters and joint limits.",

    parameters: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          enum: [
            "connect", "disconnect", "get_status", "get_joints", "set_joints",
            "set_preset", "run_sequence", "go_home", "identify_robot",
            "list_robots", "list_presets", "list_sequences", "execute_rapid",
            "load_rapid", "start_program", "stop_program", "motors_on", "motors_off",
          ],
          description: "The action to perform.",
        },
        host: { type: "string", description: "Controller IP address or hostname" },
        port: { type: "number", description: "Controller port (default: 7000)" },
        robot_id: { type: "string", description: "Robot configuration ID" },
        joints: { type: "array", items: { type: "number" }, description: "Joint angles in degrees" },
        preset: { type: "string", description: "Named preset key" },
        sequence: { type: "string", description: "Named sequence key" },
        speed: { type: "number", description: "Movement speed percentage (1-100)" },
        rapid_code: { type: "string", description: "RAPID program code" },
        module_name: { type: "string", description: "RAPID module name" },
      },
      required: ["action"],
    },

    execute: async (_id: string, params: Record<string, unknown>) => {
      const action = String(params["action"] ?? "");

      // Connect action
      if (action === "connect") {
        const host = String(params["host"] ?? pluginConfig["controllerHost"] ?? "");
        if (!host) return errorResult("host parameter or controllerHost config is required");

        const port = Number(params["port"] ?? pluginConfig["controllerPort"] ?? 7000);
        const robotId = String(params["robot_id"] ?? pluginConfig["defaultRobot"] ?? "");

        try {
          if (controller?.isConnected()) await controller.disconnect();

          const config: ControllerConfig = { host, port };
          controller = createController(config);
          await controller.connect();

          const systemName = controller.getSystemName();
          let identifiedRobot = robotId;
          if (!identifiedRobot) {
            const joints = await controller.getJointPositions();
            const jointConfigs = joints.map((_, i) => ({
              index: i, id: `joint${i}`, type: "revolute" as const,
              min: -180, max: 180, home: 0,
            }));
            identifiedRobot = identifyRobot(jointConfigs) || "abb-crb-15000";
          }

          currentConfig = getCfg(identifiedRobot);

          return {
            content: [{
              type: "text" as const,
              text: `✓ Connected to ABB controller at ${host}:${port}\n` +
                    `System: ${systemName}\n` +
                    `Robot: ${currentConfig.manufacturer} ${currentConfig.model} (${currentConfig.id})`
            }],
            details: { connected: true, host, port, systemName, robotId: currentConfig.id },
          };
        } catch (err) {
          return errorResult(`Connection failed: ${String(err)}`);
        }
      }

      // Other actions - see part 2
      return require("./abb-robot-tool-actions.js").handleAction(
        action, params, controller, currentConfig, pluginConfig, getCfg, errorResult
      );
    },
  };
}
