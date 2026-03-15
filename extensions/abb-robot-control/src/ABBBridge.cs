using System;
using System.IO;
using ABB.Robotics.Controllers;
using ABB.Robotics.Controllers.RapidDomain;

/// <summary>
/// ABB Robot Controller Bridge for PC SDK Integration
/// Provides direct communication with actual ABB robot controllers
/// </summary>
public class ABBBridge
{
    private Controller controller;
    private bool isConnected = false;

    /// <summary>
    /// Connect to ABB robot controller
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> Connect(dynamic input)
    {
        try
        {
            string host = input["host"];

            // PC SDK 2025 supports host-based constructor directly.
            controller = new Controller(host);
            isConnected = controller.Connected;

            if (isConnected)
            {
                return new
                {
                    success = true,
                    systemName = controller.SystemName,
                    robotModel = controller.Name,
                    serialNumber = controller.SystemId.ToString(),
                    connected = true
                };
            }
            else
            {
                return new { success = false, error = "Failed to connect to controller" };
            }
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Disconnect from controller
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> Disconnect(dynamic input)
    {
        try
        {
            if (controller != null)
            {
                controller.Dispose();
                isConnected = false;
            }
            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Get controller status
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> GetStatus(dynamic input)
    {
        try
        {
            if (!isConnected || controller == null)
            {
                return new { success = false, error = "Not connected" };
            }

            var operationMode = controller.OperatingMode.ToString();
            var controllerState = controller.State.ToString();
            var task = controller.Rapid.GetTask("T_ROB1");
            var taskExecStatus = task.ExecutionStatus.ToString();

            return new
            {
                success = true,
                connected = isConnected,
                operationMode = operationMode,
                motorState = controllerState,
                rapidRunning = task.ExecutionStatus == TaskExecutionStatus.Running,
                rapidExecutionStatus = taskExecStatus
            };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Get current joint positions
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> GetJointPositions(dynamic input)
    {
        try
        {
            if (!isConnected || controller == null)
            {
                return new { success = false, error = "Not connected" };
            }

            var task = controller.Rapid.GetTask("T_ROB1");
            var jt = task.GetJointTarget();
            var robAx = jt.RobAx;

            double[] jointArray = new double[6];
            jointArray[0] = robAx.Rax_1;
            jointArray[1] = robAx.Rax_2;
            jointArray[2] = robAx.Rax_3;
            jointArray[3] = robAx.Rax_4;
            jointArray[4] = robAx.Rax_5;
            jointArray[5] = robAx.Rax_6;

            return new { success = true, joints = jointArray };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Move robot to joint positions
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> MoveToJoints(dynamic input)
    {
        try
        {
            if (!isConnected || controller == null)
            {
                return new { success = false, error = "Not connected" };
            }

            double[] joints = input["joints"];
            double speed = input["speed"] ?? 100;
            string zone = input["zone"] ?? "fine";

            string rapidCode = GenerateMoveJointsCode(joints, speed, zone);
            await ExecuteRapidProgram(rapidCode, "MainModule");

            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Execute RAPID program
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> ExecuteRapidProgram(dynamic input)
    {
        try
        {
            if (!isConnected || controller == null)
            {
                return new { success = false, error = "Not connected" };
            }

            string rapidCode = input["code"];
            string moduleName = input["moduleName"] ?? "MainModule";

            await ExecuteRapidProgram(rapidCode, moduleName);

            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Load RAPID program
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> LoadRapidProgram(dynamic input)
    {
        try
        {
            if (!isConnected || controller == null)
            {
                return new { success = false, error = "Not connected" };
            }

            string rapidCode = input["code"];
            string moduleName = input["moduleName"] ?? "MainModule";

            string tempFile = CreateTempRapidFile(rapidCode, moduleName);
            try
            {
                var task = controller.Rapid.GetTask("T_ROB1");
                bool loaded = task.LoadProgramFromFile(tempFile, RapidLoadMode.Replace);
                if (!loaded)
                {
                    return new { success = false, error = "Failed to load RAPID program from temporary file" };
                }
            }
            finally
            {
                TryDeleteTempFile(tempFile);
            }

            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Start RAPID execution
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> StartRapid(dynamic input)
    {
        try
        {
            if (!isConnected || controller == null)
            {
                return new { success = false, error = "Not connected" };
            }

            var task = controller.Rapid.GetTask("T_ROB1");
            task.Start();

            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Stop RAPID execution
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> StopRapid(dynamic input)
    {
        try
        {
            if (!isConnected || controller == null)
            {
                return new { success = false, error = "Not connected" };
            }

            var task = controller.Rapid.GetTask("T_ROB1");
            task.Stop();

            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Set motors on/off
    /// </summary>
    public async System.Threading.Tasks.Task<dynamic> SetMotors(dynamic input)
    {
        try
        {
            if (!isConnected || controller == null)
            {
                return new { success = false, error = "Not connected" };
            }

            string state = input["state"];
            return new
            {
                success = false,
                error = "MotorOn/MotorOff is not available in ABB PCSDK 2025 controller API",
                requestedState = state
            };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Generate RAPID code for joint movement
    /// </summary>
    private string GenerateMoveJointsCode(double[] joints, double speed, string zone)
    {
        string jointsStr = string.Join(", ", joints);
        string speedStr = "v" + (int)speed;

        return $@"MODULE MainModule
  PROC main()
    MoveAbsJ [[{jointsStr}], [9E9, 9E9, 9E9, 9E9, 9E9, 9E9]], {speedStr}, {zone}, tool0;
  ENDPROC
ENDMODULE";
    }

    /// <summary>
    /// Execute RAPID program internally
    /// </summary>
    private async System.Threading.Tasks.Task ExecuteRapidProgram(string rapidCode, string moduleName)
    {
        var task = controller.Rapid.GetTask("T_ROB1");
        string tempFile = CreateTempRapidFile(rapidCode, moduleName);
        try
        {
            bool loaded = task.LoadProgramFromFile(tempFile, RapidLoadMode.Replace);
            if (!loaded)
            {
                throw new InvalidOperationException("Failed to load RAPID program from temporary file.");
            }

            task.Start();
            while (task.ExecutionStatus == TaskExecutionStatus.Running)
            {
                await System.Threading.Tasks.Task.Delay(100);
            }
        }
        finally
        {
            TryDeleteTempFile(tempFile);
        }
    }

    private static string CreateTempRapidFile(string rapidCode, string moduleName)
    {
        string safeModuleName = string.IsNullOrWhiteSpace(moduleName) ? "MainModule" : moduleName;
        string fileName = "ABBBridge_" + safeModuleName + "_" + Guid.NewGuid().ToString("N") + ".mod";
        string tempFile = Path.Combine(Path.GetTempPath(), fileName);
        File.WriteAllText(tempFile, rapidCode ?? string.Empty);
        return tempFile;
    }

    private static void TryDeleteTempFile(string filePath)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(filePath) && File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
        catch
        {
        }
    }
}
