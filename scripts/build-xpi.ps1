param(
  [string]$Version = "0.1.0"
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
Copy-Item -LiteralPath (Join-Path $projectRoot "chrome/content/paperSummary.js") -Destination (Join-Path $packageDir "chrome/content")

if (Test-Path $xpiPath) {
  Remove-Item -LiteralPath $xpiPath -Force
}

Compress-Archive -Path (Join-Path $packageDir "*") -DestinationPath $xpiPath -Force

Write-Host "Built $xpiPath"
