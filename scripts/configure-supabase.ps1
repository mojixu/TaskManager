param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseAnonKey
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectRoot

$envLocal = @"
VITE_SUPABASE_URL=$SupabaseUrl
VITE_SUPABASE_ANON_KEY=$SupabaseAnonKey
"@

Set-Content -LiteralPath '.env.local' -Value $envLocal -Encoding UTF8
npx.cmd supabase link --project-ref $ProjectRef

Write-Host '.env.local written and Supabase project linked.' -ForegroundColor Green
Write-Host 'Next: run `npx.cmd supabase db push` and deploy the Edge Function after secrets are set.' -ForegroundColor Yellow
