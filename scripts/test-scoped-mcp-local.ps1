param()
$ErrorActionPreference='Stop'
$mcpRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$mcpRun=[guid]::NewGuid().ToString('N')
$mcpStage=[IO.Path]::GetFullPath((Join-Path $mcpRepo "dist/scoped-mcp-$mcpRun"))
if(-not $mcpStage.StartsWith((Join-Path $mcpRepo 'dist')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid stage path'}
$mcpImage='mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'
$mcpNetwork=$null;$mcpBrowser=$null;$mcpDb=$null
function Invoke-McpDocker{& docker @args;if($LASTEXITCODE -ne 0){throw 'Scoped MCP fixture command failed'}}
New-Item -ItemType Directory -Path $mcpStage -Force | Out-Null
# Source allowlist only: no .env, profiles, .git, target volumes or deployment credentials.
foreach($folder in @('src','migrations','tests/mcp','mcp-browser-tests')){
 $dest=Join-Path $mcpStage $folder;New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $mcpRepo $folder) -Destination $dest -Recurse
}
foreach($file in @('package.json','package-lock.json','tsconfig.json','tsconfig.mcp-local.json','next-env.d.ts','vitest.mcp-local.config.ts','vitest.oauth-local.config.ts','playwright.mcp-local.config.ts','tests/integration/mcp-scoped.test.ts','tests/integration/mcp-oauth.test.ts','scripts/prepare-ux-test-container.mjs','scripts/migrate.mjs','scripts/migration-runner.mjs')){
 $dest=Join-Path $mcpStage $file;New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $mcpRepo $file) -Destination $dest
}
try{
 $mcpNetwork=(Invoke-McpDocker network create --internal "hermeneus-mcp-$mcpRun"|Select-Object -Last 1).Trim()
 if($mcpNetwork -notmatch '^[a-f0-9]{64}$'){throw 'Missing exact network identity'}
 $mcpDbName="mcp-db-$mcpRun"
 $mcpDb=(Invoke-McpDocker run --detach --rm --name $mcpDbName --network $mcpNetwork --tmpfs /var/lib/postgresql/data -e POSTGRES_USER=mcp_fixture -e POSTGRES_PASSWORD=mcp_fixture -e POSTGRES_DB=hermeneus_mcp_local_test postgres:17|Select-Object -Last 1).Trim()
 if($mcpDb -notmatch '^[a-f0-9]{64}$'){throw 'Missing exact database container identity'}
 $mcpBrowser=(Invoke-McpDocker run --detach --rm --init --name "mcp-browser-$mcpRun" --shm-size=512m --mount "type=bind,source=$mcpStage,target=/work" --mount 'type=volume,destination=/work/node_modules' --workdir /work -e "DATABASE_URL=postgresql://mcp_fixture:mcp_fixture@${mcpDbName}:5432/hermeneus_mcp_local_test" -e "TEST_DATABASE_URL=postgresql://mcp_fixture:mcp_fixture@${mcpDbName}:5432/hermeneus_mcp_local_test" -e HERMENEUS_MCP_DISPOSABLE=1 $mcpImage sleep infinity|Select-Object -Last 1).Trim()
 if($mcpBrowser -notmatch '^[a-f0-9]{64}$'){throw 'Missing exact browser container identity'}
 Invoke-McpDocker exec $mcpBrowser node scripts/prepare-ux-test-container.mjs
 Invoke-McpDocker network disconnect bridge $mcpBrowser
 Invoke-McpDocker network connect $mcpNetwork $mcpBrowser
 Invoke-McpDocker exec $mcpDb pg_isready -U mcp_fixture -d hermeneus_mcp_local_test
 Invoke-McpDocker exec $mcpBrowser node --input-type=module -e 'import{readFileSync}from"node:fs";import{spawnSync}from"node:child_process";import{dirname}from"node:path";const n=readFileSync(".fixture-node22","utf8").trim();for(const args of [["scripts/migrate.mjs"],["node_modules/vitest/vitest.mjs","run","--config","vitest.mcp-local.config.ts"],["node_modules/vitest/vitest.mjs","run","--config","vitest.oauth-local.config.ts"],["node_modules/@playwright/test/cli.js","test","--config","playwright.mcp-local.config.ts"]]){const r=spawnSync(n,args,{stdio:"inherit",env:{...process.env,PATH:dirname(n)+":"+process.env.PATH}});if(r.status!==0)process.exit(r.status??1)}'
 Write-Output "Scoped MCP evidence: $mcpStage/test-results/mcp-local"
}finally{
 foreach($container in @($mcpBrowser,$mcpDb)){if($container -match '^[a-f0-9]{64}$'){& docker stop $container|Out-Null}}
 if($mcpNetwork -match '^[a-f0-9]{64}$'){& docker network rm $mcpNetwork|Out-Null}
}
