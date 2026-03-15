---
name: abb-robot-control
description: >
  Control actual ABB robots via PC SDK. Use when the user wants to connect to
  an ABB robot controller, move a real robot, execute RAPID programs, apply
  presets, run motion sequences, or query robot status. Supports automatic
  robot identification based on DH parameters and joint limits. Use for any
  task involving real ABB robot hardware control.
metadata:
  openclaw:
    emoji: "🤖"
    requires:
      bins: []
---

# ABB Robot Control Skill

Control actual ABB robots via PC SDK through natural language commands.

## Quick Reference

| User Request | Action |
|---|---|
| "Connect to robot at 192.168.1.10" | `abb_robot` action:`connect` host:`192.168.1.10` |
| "Move robot to home" | `abb_robot` action:`go_home` |
| "Set joint 1 to 45 degrees" | `abb_robot` action:`set_joints` joints:`[45,0,0,0,0,0]` |
| "Apply ready preset" | `abb_robot` action:`set_preset` preset:`ready` |
| "Execute wave sequence" | `abb_robot` action:`run_sequence` sequence:`wave_sequence` |
| "Get current position" | `abb_robot` action:`get_joints` |
| "Check robot status" | `abb_robot` action:`get_status` |
| "Turn motors on" | `abb_robot` action:`motors_on` |
| "List available robots" | `abb_robot` action:`list_robots` |

## Prerequisites

1. **ABB PC SDK 2025** installed on Windows
2. **ABB robot controller** accessible on network
3. **Robot configuration file** in `extensions/abb-robot-control/robots/`
4. **Network connectivity** to robot controller (default port 7000)

## Connection

Before controlling the robot, establish connection:

```
User: Connect to the ABB robot at 192.168.125.1
Tool: abb_robot action:connect host:192.168.125.1
```

The plugin will:
- Connect to the controller via PC SDK
- Auto-identify the robot model based on joint limits and DH parameters
- Load the matching robot configuration
- Report connection status and robot model

## Robot Configuration

Each robot requires a configuration file in `robots/<robot-id>.json`:

```json
{
  "id": "abb-crb-15000",
  "manufacturer": "ABB",
  "model": "CRB 15000",
  "dof": 6,
  "joints": [
    {
      "index": 0,
      "id": "joint0",
      "label": "J1 - Base Rotation",
      "type": "revolute",
      "min": -180.0,
      "max": 180.0,
      "speed": 250.0,
      "home": 0.0
    }
    // ... more joints
  ],
  "presets": {
    "home": [0, 0, 0, 0, 0, 0],
    "ready": [0, -30, 60, 0, 30, 0]
  },
  "sequences": {
    "wave_sequence": {
      "steps": [
        { "joints": [45, -30, 60, 0, 30, 0], "durationMs": 800, "speed": 100 }
      ]
    }
  }
}
```

## Available Actions

### connect
Connect to ABB robot controller.

**Parameters:**
- `host` (required): Controller IP address or hostname
- `port` (optional): Controller port (default: 7000)
- `robot_id` (optional): Robot config ID (auto-detected if omitted)

**Example:**
```
abb_robot action:connect host:192.168.125.1 port:7000
```

### disconnect
Disconnect from controller.

### get_status
Get controller and robot status (operation mode, motor state, RAPID running).

### get_joints
Get current joint positions in degrees.

### set_joints
Move robot to specified joint positions.

**Parameters:**
- `joints` (required): Array of joint angles in degrees
- `speed` (optional): Movement speed 1-100% (default: 100)

**Example:**
```
abb_robot action:set_joints joints:[0,-30,60,0,30,0] speed:50
```

Joint values are automatically clamped to configured limits.

### set_preset
Apply a named preset position.

**Parameters:**
- `preset` (required): Preset name (e.g. "home", "ready")
- `speed` (optional): Movement speed 1-100%

**Example:**
```
abb_robot action:set_preset preset:ready speed:75
```

### run_sequence
Execute a named motion sequence.

**Parameters:**
- `sequence` (required): Sequence name (e.g. "wave_sequence")

**Example:**
```
abb_robot action:run_sequence sequence:wave_sequence
```

Sequences are converted to RAPID programs and executed on the controller.

### go_home
Return all joints to home position (typically all zeros).

### execute_rapid
Execute RAPID code on the controller.

**Parameters:**
- `rapid_code` (required): RAPID program code
- `module_name` (optional): Module name (default: "MainModule")

**Example:**
```
abb_robot action:execute_rapid rapid_code:"MODULE MainModule\n  PROC main()\n    MoveJ [[0,0,0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]], v100, fine, tool0;\n  ENDPROC\nENDMODULE"
```

### motors_on / motors_off
Turn robot motors on or off.

### list_robots
List all available robot configurations.

### list_presets
List presets for current or specified robot.

**Parameters:**
- `robot_id` (optional): Robot config ID

### list_sequences
List motion sequences for current or specified robot.

## Multi-Robot Support

The plugin supports multiple robot configurations. Each robot is identified by:

1. **Joint limits** - Min/max angles for each joint
2. **DH parameters** - Denavit-Hartenberg kinematic parameters
3. **DOF** - Number of degrees of freedom

When connecting, the plugin automatically identifies the robot model by comparing
controller data with available configurations.

To add a new robot:

1. Create `robots/<robot-id>.json` with robot specifications
2. Connect to controller - auto-identification will match the config
3. Or specify `robot_id` parameter explicitly

## Safety Notes

- Always verify joint limits before moving
- Start with low speeds (20-50%) for testing
- Ensure workspace is clear before executing motions
- Use emergency stop if unexpected behavior occurs
- Test sequences in simulation before running on real hardware

## RAPID Program Generation

The plugin automatically generates RAPID code for:

- Single joint movements (`set_joints`)
- Motion sequences (`run_sequence`)
- Custom trajectories

Generated programs use:
- `MoveAbsJ` for joint movements
- Speed values: `v1` to `v100` (percentage)
- Zone values: `fine` (precise) or `z10` (blended)

## Troubleshooting

**Connection fails:**
- Verify controller IP address and network connectivity
- Check firewall settings (port 7000)
- Ensure PC SDK is installed correctly
- Verify controller is in AUTO mode

**Robot doesn't move:**
- Check motor state with `get_status`
- Turn motors on with `motors_on`
- Verify operation mode is AUTO
- Check for active RAPID programs

**Joint limits exceeded:**
- Plugin automatically clamps values to configured limits
- Check robot configuration file for correct min/max values
- Violations are reported in tool response

**Robot not identified:**
- Manually specify `robot_id` parameter
- Verify robot configuration file exists
- Check joint limits and DH parameters match actual robot

## Example Workflows

### Basic Movement
```
User: Connect to robot at 192.168.125.1
AI: abb_robot action:connect host:192.168.125.1

User: Move to ready position
AI: abb_robot action:set_preset preset:ready

User: Now move joint 1 to 90 degrees
AI: abb_robot action:set_joints joints:[90,0,0,0,0,0]
```

### Execute Sequence
```
User: Make the robot wave
AI: abb_robot action:run_sequence sequence:wave_sequence

User: What other sequences are available?
AI: abb_robot action:list_sequences
```

### Custom RAPID Program
```
User: Execute a custom pick and place motion
AI: abb_robot action:execute_rapid rapid_code:"MODULE PickPlace\n  PROC main()\n    MoveJ pPick, v100, fine, tool0;\n    ! Pick logic here\n    MoveJ pPlace, v100, fine, tool0;\n  ENDPROC\nENDMODULE"
```

## Configuration

Plugin configuration in `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "abb-robot-control": {
        "enabled": true,
        "config": {
          "controllerHost": "192.168.125.1",
          "controllerPort": 7000,
          "defaultRobot": "abb-crb-15000",
          "autoConnect": false,
          "rapidProgramPath": "/hd0a/programs/"
        }
      }
    }
  }
}
```

## Architecture

```
OpenClaw Chat
     │
     ▼
abb_robot MCP Tool
     │
     ▼
ABB Controller (abb-controller.ts)
     │
     ▼
ABB PC SDK (C# Bridge)
     │
     ▼
Robot Controller (IRC5)
     │
     ▼
Physical Robot
```

The plugin uses a C# bridge process to interface with ABB's PC SDK, which
communicates with the robot controller over TCP/IP.
