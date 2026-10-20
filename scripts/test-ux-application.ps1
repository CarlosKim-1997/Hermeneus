param([ValidatePattern('^[a-z][a-z0-9-]*\.spec\.ts$')][string[]]$Spec=@())
$ErrorActionPreference='Stop'
$uxAppRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
foreach($uxAppSpec in $Spec){if(-not (Test-Path -LiteralPath (Join-Path $uxAppRepo "e2e/$uxAppSpec") -PathType Leaf)){throw 'Unknown E2E specification'}}
$uxAppRun=[guid]::NewGuid().ToString('N')
$uxAppStage=[IO.Path]::GetFullPath((Join-Path $uxAppRepo "dist/ux-application-$uxAppRun"))
if(-not $uxAppStage.StartsWith((Join-Path $uxAppRepo 'dist')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid stage path'}
$uxAppImage='mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'
$uxAppNetwork=$null;$uxAppBrowser=$null;$uxAppDb=$null
function Invoke-UxAppDocker{& docker @args;if($LASTEXITCODE -ne 0){throw 'Isolated UI application command failed'}}
New-Item -ItemType Directory -Path $uxAppStage -Force | Out-Null
foreach($uxAppFolder in @('src','migrations','e2e')){Copy-Item -LiteralPath (Join-Path $uxAppRepo $uxAppFolder) -Destination (Join-Path $uxAppStage $uxAppFolder) -Recurse}
foreach($uxAppFile in @('package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','playwright.config.ts','scripts/start-e2e-server.mjs','scripts/migrate.mjs','scripts/migration-runner.mjs','scripts/prepare-ux-test-container.mjs')){
 $uxAppDest=Join-Path $uxAppStage $uxAppFile;New-Item -ItemType Directory -Path (Split-Path $uxAppDest -Parent) -Force | Out-Null;Copy-Item -LiteralPath (Join-Path $uxAppRepo $uxAppFile) -Destination $uxAppDest
}
try{
 $uxAppNetwork=(Invoke-UxAppDocker network create --internal "hermeneus-ux-$uxAppRun" | Select-Object -Last 1).Trim();if($uxAppNetwork -notmatch '^[a-f0-9]{64}$'){throw 'Missing private network identity'}
 $uxAppDbName="ux-db-$uxAppRun"
 $uxAppDb=(Invoke-UxAppDocker run --detach --rm --name $uxAppDbName --network $uxAppNetwork --tmpfs /var/lib/postgresql/data -e POSTGRES_USER=ux_fixture -e POSTGRES_PASSWORD=ux_fixture -e POSTGRES_DB=hermeneus_ux_test postgres:17 | Select-Object -Last 1).Trim();if($uxAppDb -notmatch '^[a-f0-9]{64}$'){throw 'Missing disposable DB identity'}
 $uxAppBrowser=(Invoke-UxAppDocker run --detach --rm --init --name "ux-browser-$uxAppRun" --shm-size=512m --mount "type=bind,source=$uxAppStage,target=/work" --mount 'type=volume,destination=/work/node_modules' --workdir /work -e "DATABASE_URL=postgresql://ux_fixture:ux_fixture@${uxAppDbName}:5432/hermeneus_ux_test" -e "TEST_DATABASE_URL=postgresql://ux_fixture:ux_fixture@${uxAppDbName}:5432/hermeneus_ux_test" -e NEXT_TELEMETRY_DISABLED=1 -e "UX_APPLICATION_SPECS=$($Spec -join ',')" $uxAppImage sleep infinity | Select-Object -Last 1).Trim();if($uxAppBrowser -notmatch '^[a-f0-9]{64}$'){throw 'Missing browser identity'}
 Invoke-UxAppDocker exec $uxAppBrowser node scripts/prepare-ux-test-container.mjs
 Invoke-UxAppDocker network disconnect bridge $uxAppBrowser
 Invoke-UxAppDocker network connect $uxAppNetwork $uxAppBrowser
 Invoke-UxAppDocker exec $uxAppDb pg_isready -U ux_fixture -d hermeneus_ux_test
 Invoke-UxAppDocker exec $uxAppBrowser node --input-type=module -e 'import{readFileSync}from"node:fs";import{spawnSync}from"node:child_process";import{dirname}from"node:path";const n=readFileSync(".fixture-node22","utf8").trim();const specs=(process.env.UX_APPLICATION_SPECS||"").split(",").filter(Boolean);const r=spawnSync(n,["node_modules/@playwright/test/cli.js","test","--config","playwright.config.ts",...specs],{stdio:"inherit",env:{...process.env,PATH:dirname(n)+":"+process.env.PATH}});process.exit(r.status??1)'
 Write-Output "Application E2E evidence: $uxAppStage/test-results"
}finally{
 foreach($uxAppContainer in @($uxAppBrowser,$uxAppDb)){if($uxAppContainer -match '^[a-f0-9]{64}$'){& docker stop $uxAppContainer | Out-Null}}
 if($uxAppNetwork -match '^[a-f0-9]{64}$'){& docker network rm $uxAppNetwork | Out-Null}
}
