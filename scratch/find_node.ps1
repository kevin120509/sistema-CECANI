$paths = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe",
    "$env:APPDATA\npm\node.exe",
    "$env:LOCALAPPDATA\Programs\node\node.exe",
    "$env:USERPROFILE\.fnm\node-versions",
    "$env:LOCALAPPDATA\fnm\node-versions"
)

foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Output "FOUND PATH: $path"
    }
}

Write-Output "Searching LOCALAPPDATA..."
Get-ChildItem -Path "$env:LOCALAPPDATA" -Filter "node.exe" -Recurse -Depth 4 -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Output "FOUND: $($_.FullName)"
}

Write-Output "Searching APPDATA..."
Get-ChildItem -Path "$env:APPDATA" -Filter "node.exe" -Recurse -Depth 4 -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Output "FOUND: $($_.FullName)"
}
