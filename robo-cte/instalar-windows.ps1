#Requires -RunAsAdministrator

$serviceName = "RoboCTeSpeedFlow"
$displayName = "Robo de Captura de CT-e - SpeedFlow Logistics"
$roboPath = (Get-Location).Path
$nodePath = (Get-Command node).Source

if (!(Test-Path "$roboPath\index.js")) {
    Write-Error "index.js nao encontrado em $roboPath. Execute este script dentro da pasta do robo."
    exit 1
}

if (!(Test-Path "$roboPath\config.json")) {
    Write-Error "config.json nao encontrado. Copie e edite config.exemplo.json primeiro."
    exit 1
}

$nssmPath = "C:\nssm\nssm.exe"
if (!(Test-Path $nssmPath)) {
    $nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue)?.Source
}

if (!$nssmPath) {
    Write-Error "NSSM nao encontrado. Baixe em https://nssm.cc/download e coloque o nssm.exe em C:\nssm\ ou no PATH."
    exit 1
}

& $nssmPath install $serviceName $nodePath "$roboPath\index.js"
& $nssmPath set $serviceName DisplayName $displayName
& $nssmPath set $serviceName Description "Consulta a SEFAZ por CT-e usando certificado A1 e envia para o SpeedFlow Logistics"
& $nssmPath set $serviceName AppDirectory $roboPath
& $nssmPath set $serviceName Start SERVICE_AUTO_START
& $nssmPath set $serviceName ObjectName "LocalSystem"
& $nssmPath set $serviceName AppStdout "$roboPath\logs\robo-cte.log"
& $nssmPath set $serviceName AppStderr "$roboPath\logs\robo-cte.log"

Start-Service $serviceName
Write-Host "Servico '$serviceName' instalado e iniciado."
Write-Host "Logs em: $roboPath\logs\robo-cte.log"
Write-Host "Para remover: nssm remove $serviceName confirm"
