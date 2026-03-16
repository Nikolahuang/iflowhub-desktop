// iFlow Workspace - Tauri Backend
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::Manager;

mod agents;
mod artifact;
mod commands;
mod dialog;
mod git;
mod history;
mod manager;
mod model_resolver;
mod models;
mod router;
mod runtime_env;
mod skills;
mod state;
mod storage;

use artifact::{read_html_artifact, resolve_html_artifact_path};
use commands::{
    browse_agent_market, browse_mcp_market, connect_iflow, disconnect_agent, get_local_agent_market,
    get_local_mcp_market, get_popular_skills_cmd, install_agent, install_mcp, install_skill, list_installed_agents,
    list_installed_mcp, list_installed_skills, save_export_file, search_skills, send_message, send_long_message,
    shutdown_all_agents, stop_message, switch_agent_model, toggle_agent_think, uninstall_skill, upload_skill,
};
use dialog::pick_folder;
use git::{list_git_changes, load_git_file_diff};
use history::{
    clear_iflow_history_sessions, delete_iflow_history_session, list_iflow_history_sessions,
    load_iflow_history_messages,
};
use model_resolver::list_available_models;
use state::AppState;
use storage::{load_storage_snapshot, save_storage_snapshot};

fn main() {
    let app = tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            connect_iflow,
            send_message,
            send_long_message,
            stop_message,
            switch_agent_model,
            toggle_agent_think,
            list_available_models,
            list_iflow_history_sessions,
            load_iflow_history_messages,
            delete_iflow_history_session,
            clear_iflow_history_sessions,
            list_git_changes,
            load_git_file_diff,
            resolve_html_artifact_path,
            read_html_artifact,
            disconnect_agent,
            load_storage_snapshot,
            save_storage_snapshot,
            pick_folder,
            browse_mcp_market,
            install_mcp,
            list_installed_mcp,
            browse_agent_market,
            install_agent,
            list_installed_agents,
            save_export_file,
            get_local_mcp_market,
            get_local_agent_market,
            // Skills 相关命令
            search_skills,
            list_installed_skills,
            install_skill,
            get_popular_skills_cmd,
            upload_skill,
            uninstall_skill,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    let cleanup_done = Arc::new(AtomicBool::new(false));

    app.run(move |app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) && cleanup_done
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            let state = app_handle.state::<AppState>();
            tauri::async_runtime::block_on(shutdown_all_agents(&state));
        }
    });
}