use std::process::Stdio;

use tauri::{Manager, State};
use tokio::process::{Child, Command};
use tokio::time::{timeout, Duration};

use crate::agents::iflow_adapter::{find_available_port, message_listener_task};
use crate::models::{AgentInfo, AgentStatus, ConnectResponse, ListenerCommand};
use crate::runtime_env::{resolve_executable_path, runtime_path_env};
use crate::state::{AgentInstance, AppState};

async fn terminate_agent_process(process: &mut Child) {
    let _pid = process.id();

    #[cfg(unix)]
    if let Some(pid) = _pid {
        let pid = pid.to_string();
        let _ = Command::new("pkill")
            .arg("-TERM")
            .arg("-P")
            .arg(&pid)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await;
    }

    let _ = process.kill().await;
    let _ = timeout(Duration::from_secs(2), process.wait()).await;

    #[cfg(unix)]
    if let Some(pid) = pid {
        let pid = pid.to_string();
        let _ = Command::new("pkill")
            .arg("-KILL")
            .arg("-P")
            .arg(&pid)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await;
    }
}

async fn terminate_agent_instance(instance: &mut AgentInstance) {
    if let Some(mut process) = instance.process.take() {
        terminate_agent_process(&mut process).await;
    }
}

pub async fn shutdown_all_agents(state: &AppState) {
    let mut instances = state.agent_manager.take_all().await;
    for instance in &mut instances {
        terminate_agent_instance(instance).await;
    }
}

async fn spawn_iflow_agent(
    app_handle: tauri::AppHandle,
    state: &AppState,
    agent_id: String,
    iflow_path: String,
    workspace_path: String,
    model: Option<String>,
) -> Result<ConnectResponse, String> {
    println!("Connecting to iFlow...");
    println!("Agent ID: {}", agent_id);
    println!("Workspace: {}", workspace_path);
    if let Some(model_name) = model.as_ref() {
        println!("Model override: {}", model_name);
    }

    // 查找可用端口
    let port = find_available_port().await?;
    println!("Using port: {}", port);

    let resolved_iflow_path = resolve_executable_path(&iflow_path)?;
    let runtime_path = runtime_path_env()?;
    println!("Resolved iFlow executable: {}", resolved_iflow_path.display());

    // 启动 iFlow 进程
    let mut cmd = Command::new(&resolved_iflow_path);
    cmd.current_dir(&workspace_path)
        .arg("--experimental-acp")
        .arg("--port")
        .arg(port.to_string())
        .env("PATH", runtime_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    // 在 Windows 上隐藏控制台窗口
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        unsafe { cmd.creation_flags(CREATE_NO_WINDOW); }
    }

    if let Some(model_name) = model.as_ref() {
        let trimmed = model_name.trim();
        if !trimmed.is_empty() {
            cmd.arg("--model").arg(trimmed);
        }
    }

    println!("Spawning iFlow process...");
    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start iFlow: {}", e))?;
    println!("iFlow process started, PID: {:?}", child.id());

    // 等待 iFlow 启动
    println!("Waiting for iFlow to initialize...");
    tokio::time::sleep(Duration::from_secs(3)).await;

    let ws_url = format!("ws://127.0.0.1:{}/acp", port);

    // 创建消息发送通道
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<ListenerCommand>();

    // 保存 Agent 实例
    let agent_info = AgentInfo {
        id: agent_id.clone(),
        name: "iFlow".to_string(),
        agent_type: "iflow".to_string(),
        status: AgentStatus::Connected,
        workspace_path: workspace_path.clone(),
        port: Some(port),
    };

    let instance = AgentInstance {
        info: agent_info,
        process: Some(child),
        port,
        iflow_path: iflow_path.clone(),
        model: model.clone(),
        message_sender: Some(tx),
    };

    state.agent_manager.upsert(agent_id.clone(), instance).await;
    let (agent_count, agent_ids) = state.agent_manager.stats().await;
    println!("[connect] Agent saved, total agents: {}", agent_count);
    println!("[connect] Agent IDs: {:?}", agent_ids);

    // 启动后台消息监听任务
    let app_handle_clone = app_handle.clone();
    let agent_id_clone = agent_id.clone();
    let ws_url_clone = ws_url.clone();
    let workspace_path_clone = workspace_path.clone();

    tokio::spawn(async move {
        message_listener_task(
            app_handle_clone,
            agent_id_clone,
            ws_url_clone,
            workspace_path_clone,
            rx,
        )
        .await;
    });

    println!("Agent {} connected successfully", agent_id);

    Ok(ConnectResponse {
        success: true,
        port,
        error: None,
    })
}

/// 连接 iFlow
#[tauri::command]
pub async fn connect_iflow(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    agent_id: String,
    iflow_path: String,
    workspace_path: String,
    model: Option<String>,
) -> Result<ConnectResponse, String> {
    spawn_iflow_agent(
        app_handle,
        &state,
        agent_id,
        iflow_path,
        workspace_path,
        model,
    )
    .await
}

/// 切换模型（通过重启 ACP 会话生效）
#[tauri::command]
pub async fn switch_agent_model(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    agent_id: String,
    iflow_path: String,
    workspace_path: String,
    model: String,
) -> Result<ConnectResponse, String> {
    let target_model = model.trim();
    if target_model.is_empty() {
        return Err("Model name cannot be empty".to_string());
    }

    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if agent_exists {
        if let Some(sender) = sender {
            let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
            let send_result = sender.send(ListenerCommand::SetModel {
                model: target_model.to_string(),
                response: tx,
            });

            if send_result.is_ok() {
                match timeout(Duration::from_secs(20), rx).await {
                    Ok(Ok(Ok(_current_model))) => {
                        let port = state
                            .agent_manager
                            .port_of(&agent_id)
                            .await
                            .ok_or_else(|| "Agent port not available".to_string())?;
                        return Ok(ConnectResponse {
                            success: true,
                            port,
                            error: None,
                        });
                    }
                    Ok(Ok(Err(err))) => {
                        println!(
                            "[switch_agent_model] ACP switch failed, fallback to restart: {}",
                            err
                        );
                    }
                    Ok(Err(_)) => {
                        println!(
                            "[switch_agent_model] ACP switch response channel closed, fallback to restart"
                        );
                    }
                    Err(_) => {
                        println!("[switch_agent_model] ACP switch timeout, fallback to restart");
                    }
                }
            } else {
                println!(
                    "[switch_agent_model] Failed to send ACP switch command, fallback to restart"
                );
            }
        }
    }

    if let Some(mut instance) = state.agent_manager.remove(&agent_id).await {
        terminate_agent_instance(&mut instance).await;
    }

    spawn_iflow_agent(
        app_handle,
        &state,
        agent_id,
        iflow_path,
        workspace_path,
        Some(target_model.to_string()),
    )
    .await
}

#[tauri::command]
pub async fn toggle_agent_think(
    state: State<'_, AppState>,
    agent_id: String,
    enable: bool,
    config: Option<String>,
) -> Result<(), String> {
    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    let Some(sender) = sender else {
        return Err("Message sender not available".to_string());
    };

    let normalized_config = config
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "think".to_string());

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<bool, String>>();
    sender
        .send(ListenerCommand::SetThink {
            enable,
            config: normalized_config,
            response: tx,
        })
        .map_err(|e| format!("Failed to queue think switch: {}", e))?;

    match timeout(Duration::from_secs(20), rx).await {
        Ok(Ok(Ok(_))) => Ok(()),
        Ok(Ok(Err(err))) => Err(err),
        Ok(Err(_)) => Err("Think switch response channel closed".to_string()),
        Err(_) => Err("Think switch timeout after 20 seconds".to_string()),
    }
}


/// 发送消息
#[tauri::command]
pub async fn send_message(
    state: State<'_, AppState>,
    agent_id: String,
    content: String,
    session_id: Option<String>,
) -> Result<(), String> {
    println!(
        "[send_message] Starting for agent {}, content length: {}",
        agent_id,
        content.len()
    );

    let (agent_count, agent_ids) = state.agent_manager.stats().await;
    println!(
        "[send_message] Got agent manager snapshot, total agents: {}",
        agent_count
    );
    println!("[send_message] Available agent IDs: {:?}", agent_ids);
    println!("[send_message] Looking for agent: {}", agent_id);

    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        println!("[send_message] ERROR: Agent {} not found!", agent_id);
        return Err(format!("Agent {} not found", agent_id));
    }
    println!(
        "[send_message] Found agent! sender exists: {}",
        sender.is_some()
    );

    if let Some(sender) = sender {
        println!(
            "[send_message] Queueing user prompt to listener (length: {})",
            content.len()
        );
        match sender.send(ListenerCommand::UserPrompt {
            content,
            session_id,
        }) {
            Ok(_) => {
                println!("[send_message] Prompt queued successfully");
                Ok(())
            }
            Err(e) => {
                println!("[send_message] Failed to queue prompt: {}", e);
                Err(format!("Failed to queue prompt: {}", e))
            }
        }
    } else {
        println!("[send_message] Message sender not available");
        Err("Message sender not available".to_string())
    }
}

/// 发送长消息（通过临时文件传输，避免 IPC 大小限制）
#[tauri::command]
pub async fn send_long_message(
    _app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    agent_id: String,
    content: String,
    session_id: Option<String>,
) -> Result<(), String> {
    println!(
        "[send_long_message] Starting for agent {}, content length: {}",
        agent_id,
        content.len()
    );

    // 写入临时文件
    let temp_dir = std::env::temp_dir();
    let temp_file_name = format!("iflow_msg_{}.txt", uuid::Uuid::new_v4());
    let temp_file_path = temp_dir.join(&temp_file_name);
    
    std::fs::write(&temp_file_path, &content)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    println!("[send_long_message] Message written to temp file: {:?}", temp_file_path);

    // 从文件读取内容并发送
    let file_content = std::fs::read_to_string(&temp_file_path)
        .map_err(|e| format!("Failed to read temp file: {}", e))?;
    
    // 清理临时文件
    let _ = std::fs::remove_file(&temp_file_path);

    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    if let Some(sender) = sender {
        sender.send(ListenerCommand::UserPrompt {
            content: file_content,
            session_id,
        }).map_err(|e| format!("Failed to queue prompt: {}", e))?;
        
        println!("[send_long_message] Long prompt queued successfully");
        Ok(())
    } else {
        Err("Message sender not available".to_string())
    }
}

/// 停止当前消息生成
#[tauri::command]
pub async fn stop_message(state: State<'_, AppState>, agent_id: String) -> Result<(), String> {
    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    if let Some(sender) = sender {
        sender
            .send(ListenerCommand::CancelPrompt)
            .map_err(|e| format!("Failed to queue cancel request: {}", e))?;
        Ok(())
    } else {
        Err("Message sender not available".to_string())
    }
}

/// 断开连接
#[tauri::command]
pub async fn disconnect_agent(state: State<'_, AppState>, agent_id: String) -> Result<(), String> {
    println!("Disconnecting agent: {}", agent_id);

    if let Some(mut instance) = state.agent_manager.remove(&agent_id).await {
        terminate_agent_instance(&mut instance).await;
        println!("Agent {} disconnected", agent_id);
    }

    Ok(())
}

/// 浏览 MCP 市场
#[tauri::command]
pub async fn browse_mcp_market(state: State<'_, AppState>, agent_id: String) -> Result<crate::models::MarketResponse, String> {
    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    let Some(sender) = sender else {
        return Err("Message sender not available".to_string());
    };

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<crate::models::MarketResponse, String>>();
    sender.send(crate::models::ListenerCommand::BrowseMcpMarket { response: tx })
        .map_err(|e| format!("Failed to queue browse MCP market request: {}", e))?;

    match timeout(Duration::from_secs(30), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(err)) => Err(format!("Browse MCP market response channel error: {}", err)),
        Err(_) => Err("Browse MCP market timeout after 30 seconds".to_string()),
    }
}

/// 安装 MCP
#[tauri::command]
pub async fn install_mcp(state: State<'_, AppState>, agent_id: String, name: String) -> Result<crate::models::InstallResponse, String> {
    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    let Some(sender) = sender else {
        return Err("Message sender not available".to_string());
    };

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<crate::models::InstallResponse, String>>();
    sender.send(crate::models::ListenerCommand::InstallMcp { name, response: tx })
        .map_err(|e| format!("Failed to queue install MCP request: {}", e))?;

    match timeout(Duration::from_secs(60), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(err)) => Err(format!("Install MCP response channel error: {}", err)),
        Err(_) => Err("Install MCP timeout after 60 seconds".to_string()),
    }
}

/// 列出已安装的 MCP
#[tauri::command]
pub async fn list_installed_mcp(state: State<'_, AppState>, agent_id: String) -> Result<crate::models::MarketResponse, String> {
    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    let Some(sender) = sender else {
        return Err("Message sender not available".to_string());
    };

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<crate::models::MarketResponse, String>>();
    sender.send(crate::models::ListenerCommand::ListInstalledMcp { response: tx })
        .map_err(|e| format!("Failed to queue list installed MCP request: {}", e))?;

    match timeout(Duration::from_secs(30), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(err)) => Err(format!("List installed MCP response channel error: {}", err)),
        Err(_) => Err("List installed MCP timeout after 30 seconds".to_string()),
    }
}

/// 浏览 Agent 市场
#[tauri::command]
pub async fn browse_agent_market(state: State<'_, AppState>, agent_id: String) -> Result<crate::models::MarketResponse, String> {
    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    let Some(sender) = sender else {
        return Err("Message sender not available".to_string());
    };

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<crate::models::MarketResponse, String>>();
    sender.send(crate::models::ListenerCommand::BrowseAgentMarket { response: tx })
        .map_err(|e| format!("Failed to queue browse agent market request: {}", e))?;

    match timeout(Duration::from_secs(30), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(err)) => Err(format!("Browse agent market response channel error: {}", err)),
        Err(_) => Err("Browse agent market timeout after 30 seconds".to_string()),
    }
}

/// 安装 Agent
#[tauri::command]
pub async fn install_agent(state: State<'_, AppState>, agent_id: String, name: String) -> Result<crate::models::InstallResponse, String> {
    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    let Some(sender) = sender else {
        return Err("Message sender not available".to_string());
    };

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<crate::models::InstallResponse, String>>();
    sender.send(crate::models::ListenerCommand::InstallAgent { name, response: tx })
        .map_err(|e| format!("Failed to queue install agent request: {}", e))?;

    match timeout(Duration::from_secs(60), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(err)) => Err(format!("Install agent response channel error: {}", err)),
        Err(_) => Err("Install agent timeout after 60 seconds".to_string()),
    }
}

/// 列出已安装的 Agent
#[tauri::command]
pub async fn list_installed_agents(state: State<'_, AppState>, agent_id: String) -> Result<crate::models::MarketResponse, String> {
    let (agent_exists, sender) = state.agent_manager.sender_of(&agent_id).await;
    if !agent_exists {
        return Err(format!("Agent {} not found", agent_id));
    }

    let Some(sender) = sender else {
        return Err("Message sender not available".to_string());
    };

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<crate::models::MarketResponse, String>>();
    sender.send(crate::models::ListenerCommand::ListInstalledAgents { response: tx })
        .map_err(|e| format!("Failed to queue list installed agents request: {}", e))?;

    match timeout(Duration::from_secs(30), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(err)) => Err(format!("List installed agents response channel error: {}", err)),
        Err(_) => Err("List installed agents timeout after 30 seconds".to_string()),
    }
}

/// 保存导出文件
#[tauri::command]
pub async fn save_export_file(
    app_handle: tauri::AppHandle,
    content: String,
    default_filename: String,
) -> Result<String, String> {
    use rfd::FileDialog;

    // 打开保存文件对话框
    let file_path = FileDialog::new()
        .set_file_name(&default_filename)
        .save_file();

    match file_path {
        Some(path) => {
            // 写入文件
            std::fs::write(&path, &content)
                .map_err(|e| format!("写入文件失败: {}", e))?;

            // 返回保存的文件路径
            Ok(path.to_string_lossy().to_string())
        }
        None => Err("用户取消了保存".to_string()),
    }
}

/// 获取本地 MCP 市场数据
#[tauri::command]
pub fn get_local_mcp_market(app_handle: tauri::AppHandle) -> Result<crate::models::MarketResponse, String> {
    // 尝试从资源目录读取 market-mcp.json
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    let market_file = resource_path.join("market-mcp.json");
    
    if !market_file.exists() {
        // 如果文件不存在，返回空列表
        return Ok(crate::models::MarketResponse {
            success: true,
            error: None,
            items: Some(serde_json::json!([])),
        });
    }
    
    let content = std::fs::read_to_string(&market_file)
        .map_err(|e| format!("Failed to read market file: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse market JSON: {}", e))?;
    
    let items = json.get("items").cloned().unwrap_or(serde_json::json!([]));
    
    Ok(crate::models::MarketResponse {
        success: true,
        error: None,
        items: Some(items),
    })
}

/// 获取本地 Agent 市场数据
#[tauri::command]
pub fn get_local_agent_market(app_handle: tauri::AppHandle) -> Result<crate::models::MarketResponse, String> {
    // 尝试从资源目录读取 market-agents.json
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    let market_file = resource_path.join("market-agents.json");
    
    if !market_file.exists() {
        // 如果文件不存在，返回空列表
        return Ok(crate::models::MarketResponse {
            success: true,
            error: None,
            items: Some(serde_json::json!([])),
        });
    }
    
    let content = std::fs::read_to_string(&market_file)
        .map_err(|e| format!("Failed to read market file: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse market JSON: {}", e))?;
    
    let items = json.get("items").cloned().unwrap_or(serde_json::json!([]));
    
    Ok(crate::models::MarketResponse {
        success: true,
        error: None,
        items: Some(items),
    })
}
