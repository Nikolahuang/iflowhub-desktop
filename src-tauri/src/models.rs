use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::oneshot;

// Agent 状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub agent_type: String,
    pub status: AgentStatus,
    pub workspace_path: String,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

// 消息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

// 工具调用
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub status: String,
    pub arguments: Option<serde_json::Value>,
    pub output: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct PlanEntry {
    pub(crate) content: String,
    pub(crate) status: String,
}

// MCP 市场项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpMarketItem {
    pub name: String,
    pub description: String,
    pub version: Option<String>,
    pub author: Option<String>,
    pub category: Option<String>,
    pub installed: bool,
}

// Agent 市场项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMarketItem {
    pub name: String,
    pub description: String,
    pub agent_type: Option<String>,
    pub category: Option<String>,
    pub installed: bool,
}

// 市场响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketResponse {
    pub success: bool,
    pub error: Option<String>,
    pub items: Option<serde_json::Value>,
}

// 安装响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResponse {
    pub success: bool,
    pub error: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug)]
pub(crate) enum ListenerCommand {
    UserPrompt {
        content: String,
        session_id: Option<String>,
    },
    CancelPrompt,
    SetModel {
        model: String,
        response: oneshot::Sender<Result<String, String>>,
    },
    SetThink {
        enable: bool,
        config: String,
        response: oneshot::Sender<Result<bool, String>>,
    },
    BrowseMcpMarket {
        response: oneshot::Sender<Result<MarketResponse, String>>,
    },
    InstallMcp {
        name: String,
        response: oneshot::Sender<Result<InstallResponse, String>>,
    },
    ListInstalledMcp {
        response: oneshot::Sender<Result<MarketResponse, String>>,
    },
    BrowseAgentMarket {
        response: oneshot::Sender<Result<MarketResponse, String>>,
    },
    InstallAgent {
        name: String,
        response: oneshot::Sender<Result<InstallResponse, String>>,
    },
    ListInstalledAgents {
        response: oneshot::Sender<Result<MarketResponse, String>>,
    },
}

pub(crate) type MessageSender = UnboundedSender<ListenerCommand>;

// 连接响应
#[derive(Serialize)]
pub struct ConnectResponse {
    pub success: bool,
    pub port: u16,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelOption {
    pub label: String,
    pub value: String,
}
