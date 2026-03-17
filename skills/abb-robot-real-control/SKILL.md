---
name: abb-robot-real-control
description: Independent real ABB plugin usage. Use when user wants scan, connect, status, motion, RAPID, logs, and module backup on actual ABB controllers.
---

# ABB Real Plugin Skill

Use tool `abb_robot_real` only.

## Discovery and Connection
- Scan: `abb_robot_real action:scan_controllers`
- Connect: `abb_robot_real action:connect host:127.0.0.1 port:7000`
- Status: `abb_robot_real action:get_status`

## FormMain-Equivalent Actions
- System info: `abb_robot_real action:get_system_info`
- Service info: `abb_robot_real action:get_service_info`
- Get speed: `abb_robot_real action:get_speed`
- Set speed: `abb_robot_real action:set_speed speed:30`
- Get joints: `abb_robot_real action:get_joints`
- Get world position: `abb_robot_real action:get_world_position`
- Event log: `abb_robot_real action:get_event_log categoryId:0 limit:20`
- Query logs alias: `abb_robot_real action:query_logs categoryId:0 limit:20`
- Intelligent analysis: `abb_robot_real action:analyze_logs categoryId:0 limit:30`
- Intelligent analysis with screenshot/error text: `abb_robot_real action:analyze_logs categoryId:0 limit:30 error_hint:"T_ROB1 MainModule 行3 错误"`
- Backup module: `abb_robot_real action:backup_module moduleName:T_ROB1 outputDir:D:/tmp/abb-backup`
- Reset pointer: `abb_robot_real action:reset_program_pointer taskName:T_ROB1`
- Move joints: `abb_robot_real action:movj joints:[0,-20,20,0,20,0] speed:10 zone:fine`

## RAPID Control
- Load RAPID: `abb_robot_real action:load_rapid rapid_code:"..." module_name:MainModule`
- Start: `abb_robot_real action:start_program allowRealExecution:true`
- Stop: `abb_robot_real action:stop_program`

## Safety Notes
- Start/execute on real robot is blocked unless `allowRealExecution:true`.
- Always verify workspace safety before motion commands.

## Intelligent Troubleshooting

When you see errors like `T_ROB1 - MainModule - line X` or semantic errors:

1. Run `abb_robot_real action:analyze_logs categoryId:0 limit:30`
2. Follow recommended actions returned by plugin, typically:
	- list tasks/modules first
	- avoid hardcoded `T_ROB1` reset if task/module mismatch
	- fix RAPID syntax before `start_program`
3. Re-run `get_status`, `get_event_log`, and then low-speed `movj` validation.
