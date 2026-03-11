# 安装 Rust 工具链的脚本
$env:PATH += ";C:\Users\Administrator\.cargo\bin"

Write-Host "正在安装 Rust 稳定版工具链..."
try {
    # 安装最小化的稳定版工具链
    rustup toolchain install stable --profile minimal
    Write-Host "Rust 稳定版工具链安装成功！"
    
    # 设置为默认工具链
    rustup default stable
    Write-Host "已设置稳定版为默认工具链！"
    
    # 验证安装
    Write-Host "验证安装..."
    rustc --version
    cargo --version
    
    Write-Host "Rust 安装和配置完成！"
} catch {
    Write-Host "安装过程中出现错误: $_"
}