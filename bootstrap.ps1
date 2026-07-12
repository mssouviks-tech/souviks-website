Write-Host "Bootstrap script is working!"

New-Item -ItemType Directory -Force -Path config,gui,core,providers,assets,downloads,database

New-Item -ItemType File -Force -Path `
app.py, `
requirements.txt, `
README.md

Write-Host "Files created successfully."