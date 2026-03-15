/**
 * abb-robot-tool-actions.ts
 * Action handlers for ABB robot tool
 */

import type { ABBController } from "./abb-controller.js";
import type { RobotConfig } from "./robot-config-loader.js";
import {
  validateJointValues,
  resolvePreset,
  resolveSequence,
  listRobots,
} from "./robot-config-loader.js";

export async function handleAction(
  action: string,
  params: Record<string, unknown>,
  controller: ABBController | null,
  currentConfig: RobotConfig | null,
  pluginConfig: Record<string, unknown>,
  getCfg: (id: string) => RobotConfig,
  errorResult: (msg: string) => any
): Promise<any> {

  // Disconnect
  if (action === "disconnect") {
    if (!controller?.isConnected()) {
      return errorResult("Not connected to any controller");
    }
    try {
      await controller.disconnect();
      return {
        content: [{ type: "text" as const, text: "✓ Disconnected from controller" }],
        details: { connected: false },
      };
    } catch (err) {
      return errorResult(`Disconnect failed: ${String(err)}`);
    }
  }

  // Get status
  if (action === "get_status") {
    if (!controller?.isConnected()) {
      return {
        content: [{ type: "text" as const, text: "Not connected to any controller" }],
        details: { connected: false },
      };
    }
    try {
      const status = await controller.getStatus();
      const text = `Controller Status:\n` +
                  `  Connected: ${status.connected}\n` +
                  `  System: ${status.systemName}\n` +
                  `  Operation Mode: ${status.operationMode}\n` +
                  `  Motors: ${status.motorState}\n` +
                  `  RAPID Running: ${status.rapidRunning}`;
      return { content: [{ type: "text" as const, text }], details: status };
    } catch (err) {
      return errorResult(`Failed to get status: ${String(err)}`);
    }
  }

  // Get joints
  if (action === "get_joints") {
    if (!controller?.isConnected()) {
      return errorResult("Not connected. Use 'connect' action first.");
    }
    try {
      const joints = await controller.getJointPositions();
      const cfg = currentConfig || getCfg("abb-crb-15000");
      const lines = cfg.joints.map((j, i) =>
        `  ${j.label ?? j.id}: ${(joints[i] ?? 0).toFixed(2)}° [${j.min}…${j.max}]`
      );
      return {
        content: [{ type: "text" as const, text: `Current Joint Positions:\n${lines.join("\n")}` }],
        details: { joints },
      };
    } catch (err) {
      return errorResult(`Failed to get joints: ${String(err)}`);
    }
  }

  // Set joints
  if (action === "set_joints") {
    if (!controller?.isConnected()) {
      return errorResult("Not connected. Use 'connect' action first.");
    }
    const rawJ = params["joints"];
    if (!Array.isArray(rawJ)) return errorResult("joints array is required");
    const nums = (rawJ as unknown[]).map(Number);
    if (nums.some(isNaN)) return errorResult("joints must all be numeric");

    try {
      const cfg = currentConfig || getCfg("abb-crb-15000");
      const { values, violations } = validateJointValues(cfg, nums);
      const speed = Number(params["speed"] ?? 100);
      await controller.moveToJoints(values, speed);

      const lines = cfg.joints.map((j, i) => `  ${j.label ?? j.id}: ${values[i].toFixed(2)}°`);
      let text = `✓ Moving to joint positions:\n${lines.join("\n")}`;
      if (violations.length) {
        text += `\n\n⚠ Clamped to limits:\n${violations.map(v => `  ${v}`).join("\n")}`;
      }
      return { content: [{ type: "text" as const, text }], details: { joints: values, violations } };
    } catch (err) {
      return errorResult(`Move failed: ${String(err)}`);
    }
  }

  // Set preset
  if (action === "set_preset") {
    if (!controller?.isConnected()) {
      return errorResult("Not connected. Use 'connect' action first.");
    }
    const presetName = String(params["preset"] ?? "").trim();
    if (!presetName) return errorResult("preset name is required");

    try {
      const cfg = currentConfig || getCfg("abb-crb-15000");
      const joints = resolvePreset(cfg, presetName);
      const speed = Number(params["speed"] ?? 100);
      await controller.moveToJoints(joints, speed);

      const lines = cfg.joints.map((j, i) => `  ${j.label ?? j.id}: ${joints[i].toFixed(2)}°`);
      return {
        content: [{ type: "text" as const, text: `✓ Applied preset "${presetName}":\n${lines.join("\n")}` }],
        details: { preset: presetName, joints },
      };
    } catch (err) {
      return errorResult(String(err));
    }
  }

  // Run sequence
  if (action === "run_sequence") {
    if (!controller?.isConnected()) {
      return errorResult("Not connected. Use 'connect' action first.");
    }
    const seqName = String(params["sequence"] ?? "").trim();
    if (!seqName) return errorResult("sequence name is required");

    try {
      const cfg = currentConfig || getCfg("abb-crb-15000");
      const seq = resolveSequence(cfg, seqName);
      const positions = seq.steps.map(step => ({
        joints: step.joints,
        speed: step.speed || 100,
        zone: step.zone || "z10",
      }));
      const rapidCode = controller.generateRapidSequence(positions);
      await controller.executeRapidProgram(rapidCode);

      return {
        content: [{ type: "text" as const, text: `✓ Executing sequence "${seqName}" (${seq.steps.length} steps)` }],
        details: { sequence: seqName, steps: seq.steps.length },
      };
    } catch (err) {
      return errorResult(String(err));
    }
  }

  // Go home
  if (action === "go_home") {
    if (!controller?.isConnected()) {
      return errorResult("Not connected. Use 'connect' action first.");
    }
    try {
      const cfg = currentConfig || getCfg("abb-crb-15000");
      const homeJoints = cfg.joints.map(j => j.home);
      await controller.moveToJoints(homeJoints);
      return {
        content: [{ type: "text" as const, text: "✓ Moving to home position" }],
        details: { joints: homeJoints },
      };
    } catch (err) {
      return errorResult(`Go home failed: ${String(err)}`);
    }
  }

  // List robots
  if (action === "list_robots") {
    const robots = listRobots();
    const lines = robots.map(r => {
      try {
        const cfg = getCfg(r);
        return `  • ${r} — ${cfg.manufacturer} ${cfg.model} (${cfg.dof} DOF)`;
      } catch {
        return `  • ${r}`;
      }
    });
    return {
      content: [{ type: "text" as const, text: `Available robot configurations:\n${lines.join("\n")}` }],
      details: { robots },
    };
  }

  // List presets
  if (action === "list_presets") {
    const robotId = String(params["robot_id"] ?? currentConfig?.id ?? "abb-crb-15000");
    try {
      const cfg = getCfg(robotId);
      const presets = Object.keys(cfg.presets ?? {});
      return {
        content: [{
          type: "text" as const,
          text: presets.length
            ? `Presets for ${robotId}:\n${presets.map(p => `  • ${p}`).join("\n")}`
            : "No presets defined"
        }],
        details: { robotId, presets },
      };
    } catch (err) {
      return errorResult(String(err));
    }
  }

  // List sequences
  if (action === "list_sequences") {
    const robotId = String(params["robot_id"] ?? currentConfig?.id ?? "abb-crb-15000");
    try {
      const cfg = getCfg(robotId);
      const seqs = Object.entries(cfg.sequences ?? {}).map(
        ([k, v]) => `  • ${k}${v.description ? ` — ${v.description}` : ""}`
      );
      return {
        content: [{
          type: "text" as const,
          text: seqs.length
            ? `Sequences for ${robotId}:\n${seqs.join("\n")}`
            : "No sequences defined"
        }],
        details: { robotId, sequences: Object.keys(cfg.sequences ?? {}) },
      };
    } catch (err) {
      return errorResult(String(err));
    }
  }

  // Execute RAPID
  if (action === "execute_rapid") {
    if (!controller?.isConnected()) {
      return errorResult("Not connected. Use 'connect' action first.");
    }
    const code = String(params["rapid_code"] ?? "");
    if (!code) return errorResult("rapid_code parameter is required");
    const moduleName = String(params["module_name"] ?? "MainModule");

    try {
      await controller.executeRapidProgram(code, moduleName);
      return {
        content: [{ type: "text" as const, text: `✓ Executing RAPID program (${moduleName})` }],
        details: { moduleName },
      };
    } catch (err) {
      return errorResult(`RAPID execution failed: ${String(err)}`);
    }
  }

  // Motors on/off
  if (action === "motors_on" || action === "motors_off") {
    if (!controller?.isConnected()) {
      return errorResult("Not connected. Use 'connect' action first.");
    }
    try {
      const state = action === "motors_on" ? "ON" : "OFF";
      await controller.setMotors(state);
      return {
        content: [{ type: "text" as const, text: `✓ Motors turned ${state.toLowerCase()}` }],
        details: { motorState: state },
      };
    } catch (err) {
      return errorResult(`Failed to set motors: ${String(err)}`);
    }
  }

  return errorResult(`Unknown action: "${action}"`);
}
