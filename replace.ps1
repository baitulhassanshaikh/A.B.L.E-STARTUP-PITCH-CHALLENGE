$idx = Get-Content 'd:\gift\index.html' -Raw
$replacement = Get-Content 'd:\gift\scratch_lower.html' -Raw

$startMarker = '  <!-- WRAPPER FOR MAIN CONTENT SECTIONS -->'
$endMarker = '        <!-- FOOTER -->'

$startPos = $idx.IndexOf($startMarker)
$endPos = $idx.IndexOf($endMarker)

if ($startPos -ge 0 -and $endPos -gt $startPos) {
    $before = $idx.Substring(0, $startPos)
    $after = $idx.Substring($endPos)
    $newContent = $before + $replacement + "`r`n" + $after
    [System.IO.File]::WriteAllText('d:\gift\index.html', $newContent, [System.Text.Encoding]::UTF8)
    Remove-Item 'd:\gift\scratch_lower.html' -Force
    Write-Output 'Success replacing lower section'
} else {
    Write-Error "Markers not found. startPos: $startPos, endPos: $endPos"
}
