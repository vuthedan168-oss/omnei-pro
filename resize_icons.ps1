Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Dell\.gemini\antigravity-ide\brain\8dec8892-6de3-4a9f-aafc-d3d3554caf49\.user_uploaded\media_1791373441686.png"
$targets = @("c:\Users\Dell\Documents\codevip\omnei", "c:\Users\Dell\Documents\codevip\getcookiefplus")

$srcImg = [System.Drawing.Image]::FromFile($srcPath)

# 1. Copy banner
foreach ($t in $targets) {
    Copy-Item -Path $srcPath -Destination (Join-Path $t "brand_banner.png") -Force
}

# 2. Crop centered square (size = height = 559)
$size = [Math]::Min($srcImg.Width, $srcImg.Height)
$cropX = [int](($srcImg.Width - $size) / 2)
$cropY = [int](($srcImg.Height - $size) / 2)
$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $size, $size)

$squareBmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($squareBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($srcImg, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

function SaveResized($bmp, $outPath, $w, $h) {
    $resized = New-Object System.Drawing.Bitmap($w, $h)
    $gr = [System.Drawing.Graphics]::FromImage($resized)
    $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gr.DrawImage($bmp, 0, 0, $w, $h)
    $gr.Dispose()
    $resized.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
}

foreach ($t in $targets) {
    SaveResized $squareBmp (Join-Path $t "icon_128.png") 128 128
    SaveResized $squareBmp (Join-Path $t "icon_48.png") 48 48
    SaveResized $squareBmp (Join-Path $t "icon.png") 16 16
    SaveResized $squareBmp (Join-Path $t "brand_logo.png") 256 256
}

$squareBmp.Dispose()
$srcImg.Dispose()
Write-Output "SUCCESS: All icons resized and saved!"
