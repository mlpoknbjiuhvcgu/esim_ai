param([switch]$Clean)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Clean) {
    Remove-Item -Recurse -Force build, dist, "esim_app.spec" -ErrorAction SilentlyContinue
}

$pyinstaller = "C:\Users\user\AppData\Local\Programs\Python\Python314\Scripts\pyinstaller.exe"

& $pyinstaller `
    --name esim_app `
    --onedir `
    --console `
    --noconfirm `
    --collect-all gradio `
    --collect-all gradio_client `
    --collect-all hf_gradio `
    --collect-all safehttpx `
    --collect-all groovy `
    app.py

Write-Host ""
Write-Host "Build complete: dist\esim_app\esim_app.exe"
