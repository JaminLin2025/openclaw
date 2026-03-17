---
name: abb-robot-virtual-control
description: Independent virtual ABB plugin usage. Use when user wants to drive only the 3D viewer/bridge without touching real robot.
---

# ABB Virtual Plugin Skill

Use tool `abb_robot_virtual` only.

## Core Actions
- connect: `abb_robot_virtual action:connect host:127.0.0.1 port:9877 robot_id:abb-crb-15000`
- get_status: `abb_robot_virtual action:get_status`
- get_joints: `abb_robot_virtual action:get_joints`
- set_joints: `abb_robot_virtual action:set_joints joints:[0,0,0,0,0,0]`
- movj: `abb_robot_virtual action:movj joints:[10,-10,20,0,10,0] speed:40`
- go_home: `abb_robot_virtual action:go_home`
- disconnect: `abb_robot_virtual action:disconnect`

## Safety
- This plugin is virtual-only and does not communicate with physical ABB controllers.
- For real hardware always use `abb_robot_real` plugin.
