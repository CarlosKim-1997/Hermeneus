param()
$ErrorActionPreference='Stop'
$uxRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$uxRun=[guid]::NewGuid().ToString('N')
$uxStage=[IO.Path]::GetFullPath((Join-Path $uxRepo "dist/ux-verify-$uxRun"))
if (-not $uxStage.StartsWith((Join-Path $uxRepo 'dist')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid stage path'}
$uxImage='mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'
$uxContainer=$null
function Invoke-UxDocker { & docker @args; if($LASTEXITCODE -ne 0){throw 'UX Docker command failed'} }
$uxFiles=@('package.json','package-lock.json','playwright.ux.config.ts','scripts/start-ux-preview.mjs','scripts/prepare-ux-test-container.mjs',
'src/app/components/ui-dates.ts','src/app/globals.css','src/app/theme.css','src/app/reference-ui.css','src/app/error.tsx','src/app/loading.tsx','src/app/not-found.tsx',
'src/handoff/schema.ts','src/portable/proposal.ts','src/portable/sender-prompt.ts','src/portable/receiver-packet.ts','src/portable/jcs.ts','src/receiver/external/verifier.ts')
$uxFiles+=@(Get-ChildItem -LiteralPath (Join-Path $uxRepo 'src/app/components') -Filter '*.tsx' | ForEach-Object { 'src/app/components/'+$_.Name })
$uxFiles+=@(Get-ChildItem -LiteralPath (Join-Path $uxRepo 'scripts/ux-preview') -File | ForEach-Object { 'scripts/ux-preview/'+$_.Name })
$uxFiles+=@(Get-ChildItem -LiteralPath (Join-Path $uxRepo 'ux-tests') -Filter '*.ts' | ForEach-Object { 'ux-tests/'+$_.Name })
New-Item -ItemType Directory -Path $uxStage -Force | Out-Null
foreach($uxFile in $uxFiles){$uxDestination=Join-Path $uxStage $uxFile;New-Item -ItemType Directory -Path (Split-Path $uxDestination -Parent) -Force | Out-Null;Copy-Item -LiteralPath (Join-Path $uxRepo $uxFile) -Destination $uxDestination}
try{
  $uxOutput=Invoke-UxDocker run --detach --rm --init --name "hermeneus-ux-$uxRun" --shm-size=512m --mount "type=bind,source=$uxStage,target=/work" --mount 'type=volume,destination=/work/node_modules' --workdir /work $uxImage sleep infinity
  $uxContainer=($uxOutput | Select-Object -Last 1).Trim();if($uxContainer -notmatch '^[a-f0-9]{64}$'){throw 'Missing exact container identity'}
  Invoke-UxDocker exec $uxContainer node scripts/prepare-ux-test-container.mjs
  Invoke-UxDocker network disconnect bridge $uxContainer
  Invoke-UxDocker exec $uxContainer node --input-type=module -e 'import{readFileSync}from"node:fs";import{spawnSync}from"node:child_process";import{dirname}from"node:path";const n=readFileSync(".fixture-node22","utf8").trim();const r=spawnSync(n,["node_modules/@playwright/test/cli.js","test","--config","playwright.ux.config.ts"],{stdio:"inherit",env:{...process.env,PATH:dirname(n)+":"+process.env.PATH}});process.exit(r.status??1)'
  Write-Output "UX evidence: $uxStage/test-results/ux"
}finally{if($uxContainer -match '^[a-f0-9]{64}$'){& docker stop $uxContainer | Out-Null}}
