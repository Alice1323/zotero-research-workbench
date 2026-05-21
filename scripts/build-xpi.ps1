param(
  [string]$Version = "0.2.0"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $projectRoot "dist"
$packageDir = Join-Path $distDir "package"
$xpiPath = Join-Path $distDir "zotero-research-workbench-$Version.xpi"

if (Test-Path $packageDir) {
  Remove-Item -LiteralPath $packageDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $packageDir "chrome/content") | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot "manifest.json") -Destination $packageDir
Copy-Item -LiteralPath (Join-Path $projectRoot "bootstrap.js") -Destination $packageDir
Copy-Item -LiteralPath (Join-Path $projectRoot "chrome/content/researchPanel.xhtml") -Destination (Join-Path $packageDir "chrome/content")
Copy-Item -LiteralPath (Join-Path $projectRoot "chrome/content/workbenchPlugin.mjs") -Destination (Join-Path $packageDir "chrome/content")
Copy-Item -LiteralPath (Join-Path $projectRoot "chrome/content/providerConnection.js") -Destination (Join-Path $packageDir "chrome/content")
Copy-Item -LiteralPath (Join-Path $projectRoot "chrome/content/providerSettings.js") -Destination (Join-Path $packageDir "chrome/content")
Copy-Item -LiteralPath (Join-Path $projectRoot "chrome/content/readingContext.js") -Destination (Join-Path $packageDir "chrome/content")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/providerChatCompletion.js") -Destination (Join-Path $packageDir "chrome/content/providerChatCompletion.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/llmRuntimeGuard.js") -Destination (Join-Path $packageDir "chrome/content/llmRuntimeGuard.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/workbenchSnapshot.js") -Destination (Join-Path $packageDir "chrome/content/workbenchSnapshot.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/workbenchRuntimeStore.js") -Destination (Join-Path $packageDir "chrome/content/workbenchRuntimeStore.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/zoteroNoteWriter.js") -Destination (Join-Path $packageDir "chrome/content/zoteroNoteWriter.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/webDavClient.js") -Destination (Join-Path $packageDir "chrome/content/webDavClient.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/clipboardWriter.js") -Destination (Join-Path $packageDir "chrome/content/clipboardWriter.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/workbenchFileRuntime.js") -Destination (Join-Path $packageDir "chrome/content/workbenchFileRuntime.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/workbenchFileIo.js") -Destination (Join-Path $packageDir "chrome/content/workbenchFileIo.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/workbenchSelectedPaper.js") -Destination (Join-Path $packageDir "chrome/content/workbenchSelectedPaper.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/workbenchFetchRuntime.js") -Destination (Join-Path $packageDir "chrome/content/workbenchFetchRuntime.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "chrome/content/paperSummary.js") -Destination (Join-Path $packageDir "chrome/content")

if (Test-Path $xpiPath) {
  Remove-Item -LiteralPath $xpiPath -Force
}

Compress-Archive -Path (Join-Path $packageDir "*") -DestinationPath $xpiPath -Force

Write-Host "Built $xpiPath"
