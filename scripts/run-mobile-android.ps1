[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("emulator", "physical-usb")]
    [string]$Mode,

    [string]$DeviceId,

    [string]$BackendOrigin = "http://127.0.0.1:5050",

    [switch]$PrepareOnly,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$FlutterArguments
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-AdbPath {
    $candidates = @()
    if ($env:ANDROID_SDK_ROOT) {
        $candidates += Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe"
    }
    if ($env:ANDROID_HOME) {
        $candidates += Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
    }
    if ($env:LOCALAPPDATA) {
        $candidates += Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
    }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $command = Get-Command adb -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
        return $command.Source
    }

    throw "ADB was not found. Install Android SDK Platform-Tools or set ANDROID_SDK_ROOT."
}

function Resolve-FlutterPath {
    $command = Get-Command flutter -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) {
        throw "Flutter was not found on PATH."
    }
    return $command.Source
}

function Get-ConnectedAndroidDevices {
    param([Parameter(Mandatory = $true)][string]$AdbPath)

    $output = @(& $AdbPath devices)
    if ($LASTEXITCODE -ne 0) {
        throw "ADB could not list connected devices."
    }

    $devices = @(
        foreach ($line in $output) {
            if ($line -match '^([^\s]+)\s+device(?:\s|$)') {
                [PSCustomObject]@{
                    Serial = $Matches[1]
                    IsEmulator = $Matches[1].StartsWith("emulator-", [System.StringComparison]::OrdinalIgnoreCase)
                }
            }
        }
    )

    return $devices
}

function Select-AndroidDevice {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$Devices,
        [Parameter(Mandatory = $true)][string]$SelectedMode,
        [string]$RequestedDeviceId
    )

    $modeDevices = @(
        if ($SelectedMode -eq "emulator") {
            $Devices | Where-Object { $_.IsEmulator }
        } else {
            $Devices | Where-Object { -not $_.IsEmulator }
        }
    )

    if ($RequestedDeviceId) {
        $match = @($modeDevices | Where-Object { $_.Serial -eq $RequestedDeviceId })
        if ($match.Count -ne 1) {
            throw "Device '$RequestedDeviceId' is not a connected $SelectedMode target. Run 'adb devices' and retry."
        }
        return $match[0]
    }

    if ($modeDevices.Count -eq 0) {
        if ($SelectedMode -eq "emulator") {
            throw "No Android emulator is connected. Start one with a stable API image, wait for it to boot, and retry."
        }
        throw "No physical Android device is connected. Enable USB debugging, accept the trust prompt, and retry."
    }

    if ($modeDevices.Count -gt 1) {
        $serials = ($modeDevices | ForEach-Object { $_.Serial }) -join ", "
        throw "More than one $SelectedMode target is connected ($serials). Retry with -DeviceId <serial>."
    }

    return $modeDevices[0]
}

$parsedOrigin = $null
$isValidOrigin = [Uri]::TryCreate(
    $BackendOrigin,
    [UriKind]::Absolute,
    [ref]$parsedOrigin
)
if (-not $isValidOrigin -or
    ($parsedOrigin.Scheme -ne "http" -and $parsedOrigin.Scheme -ne "https") -or
    $parsedOrigin.UserInfo -or
    ($parsedOrigin.AbsolutePath -ne "/") -or
    $parsedOrigin.Query -or
    $parsedOrigin.Fragment) {
    throw "BackendOrigin must be an HTTP(S) origin without /api/v1, credentials, query, or fragment."
}

$loopbackHosts = @("localhost", "127.0.0.1", "::1")
if ($parsedOrigin.Host -notin $loopbackHosts) {
    throw "The emulator/USB helper expects a backend on this computer. Use a loopback BackendOrigin such as http://127.0.0.1:5050."
}

$healthUri = [Uri]::new($parsedOrigin, "/health")
try {
    $healthResponse = Invoke-WebRequest -UseBasicParsing -Uri $healthUri -TimeoutSec 5
    if ($healthResponse.StatusCode -ne 200) {
        throw "HTTP $($healthResponse.StatusCode)"
    }
} catch {
    throw "Bike Buddy backend health check failed at $healthUri. Start MongoDB and the backend before launching Flutter. $($_.Exception.Message)"
}

$adbPath = Resolve-AdbPath
$flutterPath = Resolve-FlutterPath
$devices = @(Get-ConnectedAndroidDevices -AdbPath $adbPath)
$target = Select-AndroidDevice -Devices $devices -SelectedMode $Mode -RequestedDeviceId $DeviceId

$deviceHost = if ($Mode -eq "emulator") { "10.0.2.2" } else { "127.0.0.1" }
$deviceOriginBuilder = [UriBuilder]::new(
    $parsedOrigin.Scheme,
    $deviceHost,
    $parsedOrigin.Port
)
$deviceOrigin = $deviceOriginBuilder.Uri.GetLeftPart([UriPartial]::Authority)

if ($Mode -eq "physical-usb") {
    $portMapping = "tcp:$($parsedOrigin.Port)"
    & $adbPath -s $target.Serial reverse $portMapping $portMapping
    if ($LASTEXITCODE -ne 0) {
        throw "ADB reverse failed for $($target.Serial). Reconnect the phone and accept its USB debugging prompt."
    }

    $reverseRules = @(& $adbPath -s $target.Serial reverse --list)
    if ($LASTEXITCODE -ne 0 -or -not ($reverseRules -match "tcp:$($parsedOrigin.Port)\s+tcp:$($parsedOrigin.Port)")) {
        throw "ADB did not confirm the port $($parsedOrigin.Port) reverse for $($target.Serial)."
    }
}

Write-Host "Backend health: OK ($healthUri)" -ForegroundColor Green
Write-Host "Android target: $($target.Serial)" -ForegroundColor Cyan
Write-Host "Flutter API origin: $deviceOrigin" -ForegroundColor Cyan

if ($PrepareOnly) {
    Write-Host "Preflight complete. No app was launched."
    return
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $repositoryRoot "frontend\mobile"
Push-Location $mobileRoot
try {
    & $flutterPath run -d $target.Serial "--dart-define=API_BASE_URL=$deviceOrigin" @FlutterArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Flutter exited with code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
