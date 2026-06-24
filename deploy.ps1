# deploy.ps1 — empacota e faz upload para Hostinger
# Uso: .\deploy.ps1
# Requer: Node.js, 7-Zip (7z no PATH) ou usa Compress-Archive do PowerShell

$ErrorActionPreference = "Stop"
$VERSION = "v20"
$ZIP_NAME = "deploy-$VERSION.zip"
$DOMAIN   = "moventistickets.com.br"

Write-Host "==> Build de producao..." -ForegroundColor Cyan

# Remove .env.local temporariamente para que o build use .env.production
$envLocalPath = ".env.local"
$envLocalBackup = ".env.local.bak"
if (Test-Path $envLocalPath) {
    Rename-Item $envLocalPath $envLocalBackup
    Write-Host "    .env.local movido para backup (sera restaurado ao final)"
}

try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build falhou" }
} finally {
    # Restaura .env.local independente de falha
    if (Test-Path $envLocalBackup) {
        Rename-Item $envLocalBackup $envLocalPath
        Write-Host "    .env.local restaurado"
    }
}

Write-Host "==> Empacotando..." -ForegroundColor Cyan

# Remove zip anterior se existir
if (Test-Path $ZIP_NAME) { Remove-Item $ZIP_NAME }

# Cria zip com os arquivos necessarios (SEM .env.local)
Compress-Archive -Path `
    ".next", `
    "public", `
    "package.json", `
    "package-lock.json", `
    ".env.production" `
    -DestinationPath $ZIP_NAME

Write-Host "    Criado: $ZIP_NAME" -ForegroundColor Green

Write-Host ""
Write-Host "==> Proximo passo:" -ForegroundColor Yellow
Write-Host "    Acesse o hPanel da Hostinger > $DOMAIN > Node.js"
Write-Host "    Faca upload do arquivo: $ZIP_NAME"
Write-Host "    Clique em Deploy."
Write-Host ""
Write-Host "Ou use o Hostinger MCP para deploy automatico."
