<#
.SYNOPSIS
    Regenerates leaderboard-data.js from the Matsumi Excel workbook.

.DESCRIPTION
    Reads the .xlsx file directly (Excel does not need to be installed or closed),
    finds the header row, converts every lap time to milliseconds, sorts the runs
    fastest-first and writes the ranked list to leaderboard-data.js.

    Recognised column headers (case-insensitive, first match wins):
      Car     - "Car", "Build", "Vehicle" or "Model"        (required)
      Time    - anything containing "Time" or "Lap"          (required)
      Class   - "Class"                                      (required unless combined)
      PI      - "PI"                                         (required unless combined)
      Class/PI combined, e.g. "S2 822" - a header containing both "Class" and "PI"
      Status  - anything containing "Status"                 (optional)
      Notes   - anything containing "Note" or "Comment"      (optional)
      Drive   - anything containing "Drive", e.g. Drivetrain (optional; AWD / RWD / FWD)
      Date    - anything containing "Date"                   (optional)

    Times may be typed as text ("2:18.066") or stored as real Excel times.
    Rows with no car or no time are skipped and listed in the output.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\Update-Leaderboard.ps1 -Workbook "C:\path\JS_Matsumi_Leaderboard.xlsx"

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\Update-Leaderboard.ps1 -Workbook .\board.xlsx -Sheet "Matsumi"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Workbook,
    [string]$Sheet,
    [string]$Out = (Join-Path (Split-Path -Parent $PSScriptRoot) "leaderboard-data.js")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
$invariant = [System.Globalization.CultureInfo]::InvariantCulture
$ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
$relNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

function Read-ZipXml($zip, [string]$path) {
    $entry = $zip.GetEntry($path)
    if (-not $entry) { return $null }
    $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
    try { $doc = New-Object System.Xml.XmlDocument; $doc.LoadXml($reader.ReadToEnd()); return $doc }
    finally { $reader.Dispose() }
}

function Get-ColumnIndex([string]$cellRef) {
    $letters = ($cellRef -replace '[0-9]', '').ToUpperInvariant()
    $index = 0
    foreach ($ch in $letters.ToCharArray()) { $index = $index * 26 + ([int]$ch - 64) }
    return $index
}

function ConvertTo-Milliseconds($value) {
    if ($null -eq $value) { return $null }
    $text = "$value".Trim()
    if ($text -eq "") { return $null }
    if ($text -match '^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,3}))?$') {
        $minutes = if ($Matches[1]) { [int]$Matches[1] } else { 0 }
        $fraction = if ($Matches[3]) { [int]($Matches[3].PadRight(3, "0")) } else { 0 }
        return ($minutes * 60 + [int]$Matches[2]) * 1000 + $fraction
    }
    $number = 0.0
    if ([double]::TryParse($text, [System.Globalization.NumberStyles]::Float, $invariant, [ref]$number)) {
        # Real Excel times are fractions of a day; larger numbers are treated as seconds.
        if ($number -lt 1) { return [int64][math]::Round($number * 86400000) }
        return [int64][math]::Round($number * 1000)
    }
    return $null
}

function Format-LapTime([int64]$ms) {
    $minutes = [math]::Floor($ms / 60000)
    $seconds = [math]::Floor(($ms % 60000) / 1000)
    return "{0}:{1:00}.{2:000}" -f $minutes, $seconds, ($ms % 1000)
}

function ConvertTo-JsonString([string]$text) {
    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    foreach ($ch in $text.ToCharArray()) {
        switch ($ch) {
            '"' { [void]$builder.Append('\"') }
            '\' { [void]$builder.Append('\\') }
            "`n" { [void]$builder.Append('\n') }
            "`r" { [void]$builder.Append('\r') }
            "`t" { [void]$builder.Append('\t') }
            default {
                if ([int]$ch -lt 32) { [void]$builder.AppendFormat('\u{0:x4}', [int]$ch) }
                else { [void]$builder.Append($ch) }
            }
        }
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

$workbookPath = (Resolve-Path -LiteralPath $Workbook).Path
# FileShare.ReadWrite lets this run while the workbook is still open in Excel.
$stream = New-Object System.IO.FileStream($workbookPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Read)

try {
    # Locate the worksheet XML: workbook.xml names the sheets, its .rels file maps them to paths.
    $book = Read-ZipXml $zip "xl/workbook.xml"
    $nsm = New-Object System.Xml.XmlNamespaceManager($book.NameTable)
    $nsm.AddNamespace("x", $ns)
    $nsm.AddNamespace("r", $relNs)
    $sheets = @($book.SelectNodes("//x:sheets/x:sheet", $nsm))
    if ($Sheet) {
        $sheetNode = $sheets | Where-Object { $_.GetAttribute("name") -eq $Sheet } | Select-Object -First 1
        if (-not $sheetNode) { throw "Sheet '$Sheet' not found. Sheets in this workbook: $(($sheets | ForEach-Object { $_.GetAttribute('name') }) -join ', ')" }
    } else {
        $sheetNode = $sheets[0]
    }
    $relId = $sheetNode.GetAttribute("id", $relNs)
    $rels = Read-ZipXml $zip "xl/_rels/workbook.xml.rels"
    $target = ($rels.DocumentElement.ChildNodes | Where-Object { $_.GetAttribute("Id") -eq $relId }).GetAttribute("Target")
    $sheetPath = if ($target.StartsWith("/")) { $target.TrimStart("/") } else { "xl/" + $target }

    # Shared strings hold most text cells. Rich-text runs are joined; phonetic hints are ignored.
    $sharedStrings = New-Object System.Collections.Generic.List[string]
    $sst = Read-ZipXml $zip "xl/sharedStrings.xml"
    if ($sst) {
        $sstNs = New-Object System.Xml.XmlNamespaceManager($sst.NameTable)
        $sstNs.AddNamespace("x", $ns)
        foreach ($si in $sst.SelectNodes("//x:si", $sstNs)) {
            $sharedStrings.Add((($si.SelectNodes("x:t | x:r/x:t", $sstNs) | ForEach-Object { $_.InnerText }) -join ""))
        }
    }

    $sheetXml = Read-ZipXml $zip $sheetPath
    $sheetNs = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $sheetNs.AddNamespace("x", $ns)

    $rows = foreach ($rowNode in $sheetXml.SelectNodes("//x:sheetData/x:row", $sheetNs)) {
        $cells = @{}
        foreach ($c in $rowNode.SelectNodes("x:c", $sheetNs)) {
            $type = $c.GetAttribute("t")
            $v = $c.SelectSingleNode("x:v", $sheetNs)
            $value = switch ($type) {
                "s" { if ($v) { $sharedStrings[[int]$v.InnerText] } }
                "inlineStr" { (($c.SelectNodes("x:is/x:t | x:is/x:r/x:t", $sheetNs) | ForEach-Object { $_.InnerText }) -join "") }
                default { if ($v) { $v.InnerText } }
            }
            $cells[(Get-ColumnIndex $c.GetAttribute("r"))] = $value
        }
        [pscustomobject]@{ Number = [int]$rowNode.GetAttribute("r"); Cells = $cells; IsText = $true }
    }
} finally {
    $zip.Dispose()
    $stream.Dispose()
}

# Find the header row: the first row with a "car"-style heading.
$carPattern = '^(car|build|vehicle|model)\b'
$headerRow = $rows | Where-Object { $_.Cells.Values | Where-Object { "$_".Trim() -match $carPattern } } | Select-Object -First 1
if (-not $headerRow) { throw "Couldn't find a header row with a 'Car' or 'Build' column in sheet '$($sheetNode.GetAttribute('name'))'." }

$columns = @{}
foreach ($key in ($headerRow.Cells.Keys | Sort-Object)) {
    $heading = "$($headerRow.Cells[$key])".Trim().ToLowerInvariant()
    $field = $null
    if ($heading -match $carPattern) { $field = "car" }
    elseif ($heading -match 'class' -and $heading -match '\bpi\b') { $field = "classpi" }
    elseif ($heading -match 'class') { $field = "class" }
    elseif ($heading -match '^pi\b|\bpi$|performance index') { $field = "pi" }
    elseif ($heading -match 'status') { $field = "status" }
    elseif ($heading -match 'note|comment') { $field = "notes" }
    elseif ($heading -match 'drive') { $field = "drive" }
    elseif ($heading -match 'date') { $field = "date" }
    elseif ($heading -match 'time|lap') { $field = "time" }
    if ($field -and -not $columns.ContainsKey($field)) { $columns[$field] = $key }
}

$haveClass = $columns.ContainsKey("classpi") -or ($columns.ContainsKey("class") -and $columns.ContainsKey("pi"))
if (-not $columns.ContainsKey("time") -or -not $haveClass) {
    $found = ($headerRow.Cells.Values | Where-Object { "$_".Trim() -ne "" }) -join ", "
    throw "Missing a Time, Class or PI column. Headers found in row $($headerRow.Number): $found"
}

$runs = New-Object System.Collections.Generic.List[object]
$skipped = New-Object System.Collections.Generic.List[string]
foreach ($row in ($rows | Where-Object { $_.Number -gt $headerRow.Number })) {
    $car = "$($row.Cells[$columns.car])"
    $ms = ConvertTo-Milliseconds $row.Cells[$columns.time]
    if ($car.Trim() -eq "" -and $null -eq $ms) { continue }   # blank row
    if ($car.Trim() -eq "" -or $null -eq $ms) {
        $skipped.Add("row $($row.Number): car='$car' time='$($row.Cells[$columns.time])'")
        continue
    }

    if ($columns.ContainsKey("classpi")) {
        $combined = "$($row.Cells[$columns.classpi])".Trim()
        if ($combined -notmatch '^([A-Za-z]\d?)\s*(\d{3,4})$') { $skipped.Add("row $($row.Number): couldn't read class/PI '$combined'"); continue }
        $class = $Matches[1].ToUpperInvariant(); $pi = [int]$Matches[2]
    } else {
        $class = "$($row.Cells[$columns.class])".Trim().ToUpperInvariant()
        $piNumber = 0.0
        if (-not [double]::TryParse("$($row.Cells[$columns.pi])".Trim(), [System.Globalization.NumberStyles]::Float, $invariant, [ref]$piNumber)) {
            $skipped.Add("row $($row.Number): couldn't read PI '$($row.Cells[$columns.pi])'"); continue
        }
        $pi = [int][math]::Round($piNumber)
    }

    $run = [ordered]@{
        car = $car
        class = $class
        pi = $pi
        time = Format-LapTime $ms
        ms = $ms
        status = if ($columns.ContainsKey("status")) { "$($row.Cells[$columns.status])" } else { "" }
        notes = if ($columns.ContainsKey("notes")) { "$($row.Cells[$columns.notes])" } else { "" }
    }
    if ($columns.ContainsKey("drive") -and "$($row.Cells[$columns.drive])".Trim() -ne "") {
        $run.drive = "$($row.Cells[$columns.drive])".Trim().ToUpperInvariant()
    }
    if ($columns.ContainsKey("date") -and "$($row.Cells[$columns.date])".Trim() -ne "") {
        $rawDate = "$($row.Cells[$columns.date])".Trim()
        $serial = 0.0
        $run.date = if ([double]::TryParse($rawDate, [System.Globalization.NumberStyles]::Float, $invariant, [ref]$serial)) {
            [DateTime]::FromOADate($serial).ToString("yyyy-MM-dd", $invariant)
        } else { $rawDate }
    }
    $run.sourceRow = $row.Number
    $runs.Add($run)
}

if ($runs.Count -eq 0) { throw "No runs found below the header row." }

# Fastest first; the spreadsheet row breaks exact ties so reruns are stable.
$sorted = @($runs | Sort-Object -Property @{ Expression = { $_.ms } }, @{ Expression = { $_.sourceRow } })
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("// Read-only snapshot of Jess's Matsumi Excel leaderboard.")
$lines.Add("// Generated by tools/Update-Leaderboard.ps1 - edit the workbook and re-run it rather than hand-editing ranks.")
$lines.Add("window.JS_LEADERBOARD = [")
for ($i = 0; $i -lt $sorted.Count; $i++) {
    $run = $sorted[$i]
    $run.rank = $i + 1
    $fields = foreach ($name in $run.Keys) {
        $value = $run[$name]
        $json = if ($value -is [string]) { ConvertTo-JsonString $value } else { [string]::Format($invariant, "{0}", $value) }
        "    `"$name`": $json"
    }
    $lines.Add("  {")
    $lines.Add(($fields -join ",`n"))
    $lines.Add($(if ($i -lt $sorted.Count - 1) { "  }," } else { "  }" }))
}
$lines.Add("];")

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Out, (($lines -join "`n") + "`n"), $utf8NoBom)

$classSummary = ($sorted | Group-Object { $_["class"] } | ForEach-Object { "$($_.Name) $($_.Count)" }) -join ", "
Write-Host "Wrote $($sorted.Count) runs to $Out"
Write-Host "Classes: $classSummary"
Write-Host "Fastest: $($sorted[0].car) $($sorted[0].time)"
if ($skipped.Count) {
    Write-Warning "$($skipped.Count) row(s) skipped:"
    $skipped | ForEach-Object { Write-Warning "  $_" }
}
