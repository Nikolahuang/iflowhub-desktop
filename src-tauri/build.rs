fn main() {
    // Add MinGW to PATH for windres/gcc if needed
    if cfg!(target_os = "windows") {
        let mingw_paths = [
            r"G:\iflow-clihub\x86_64-15.2.0-release-posix-seh-ucrt-rt_v13-rev1\mingw64\bin",
            r"C:\msys64\mingw64\bin",
            r"C:\mingw64\bin",
        ];
        
        let current_path = std::env::var("PATH").unwrap_or_default();
        let mut path_parts: Vec<&str> = current_path.split(';').collect();
        
        for mingw_path in &mingw_paths {
            if std::path::Path::new(mingw_path).exists() && !current_path.contains(mingw_path) {
                path_parts.insert(0, *mingw_path);
            }
        }
        
        let new_path = path_parts.join(";");
        std::env::set_var("PATH", &new_path);
    }
    
    tauri_build::build()
}
