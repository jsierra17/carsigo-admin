# Uninstall VS Code extensions not used by the carsigo-admin stack.
#
# Stack kept: Vue 3, Vite, Tailwind, Express/Node, Flutter/Dart, Firebase,
# OpenCode, AI assistants and Git utilities.
#
# Usage:
#   1. Close every VS Code window.
#   2. Open a standalone PowerShell window.
#   3. Run:
#      powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-unused-vscode-extensions.ps1
#
# Reinstall a single extension later with:
#   code --install-extension <publisher.extension>
#
# The script is safe to re-run: extensions already removed are reported at the end.

$codeCli = (Get-Command code -ErrorAction SilentlyContinue).Source
if (-not $codeCli) {
    $codeCli = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
        "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $codeCli) {
    throw "VS Code CLI not found. Run 'Shell Command: Install code command in PATH' first."
}

if (Get-Process Code -ErrorAction SilentlyContinue) {
    Write-Warning "VS Code is running. Close it before running this script."
    return
}

$extensions = @(
    # PHP / Laravel / Livewire
    "bmewburn.vscode-intelephense-client"
    "brapifra.phpserver"
    "cierra.livewire-vscode"
    "codingyu.laravel-goto-view"
    "devsense.composer-php-vscode"
    "devsense.intelli-php-vscode"
    "devsense.phptools-vscode"
    "devsense.profiler-php-vscode"
    "junstyle.php-cs-fixer"
    "kokororin.vscode-phpfmt"
    "m4tr1ck.livewire-goto-updated-3"
    "mehedidracula.php-namespace-resolver"
    "mihailurakov.php-server-vars-snippets"
    "mrchetan.laravel-goto-config"
    "mrchetan.vscode-php-array-symbols"
    "muath-ye.composer-intelephense"
    "onecentlin.laravel5-snippets"
    "onecentlin.laravel-blade"
    "pizca.livewire-jump"
    "porifa.laravel-intelephense"
    "primafuture.open-php-html-js-in-browser"
    "robberphex.php-debug"
    "ryannaddy.laravel-artisan"
    "sandaruwangunathilake.laravel-eloquent-model-attributes"
    "shufo.vscode-blade-formatter"
    "teodorovillanueva.php-live-server"
    "tiansin.php-debug"
    "walkme.php-extension-pack"
    "xdebug.php-debug"
    "xdebug.php-pack"
    "zobo.php-intellisense"

    # Python / ML / Jupyter
    "076923.python-image-preview"
    "batisteo.vscode-django"
    "benjamin-simmonds.pythoncpp-debug"
    "did1335.opencv-intellisense"
    "donjayamanne.python-environment-manager"
    "donjayamanne.python-extension-pack"
    "etmoffat.pip-packages"
    "gsgupta.opencv-snippets"
    "joephilip.pythondjangocodesnippet"
    "johnguo.simply-view-image-for-python-opencv-debugging"
    "kevinrose.vsc-python-indent"
    "ms-python.black-formatter"
    "ms-python.debugpy"
    "ms-python.isort"
    "ms-python.python"
    "ms-python.vscode-pylance"
    "ms-python.vscode-python-envs"
    "ms-toolsai.jupyter"
    "ms-toolsai.jupyter-keymap"
    "ms-toolsai.jupyter-renderers"
    "ms-toolsai.vscode-jupyter-cell-tags"
    "njpwerner.autodocstring"
    "petersteiner.pip-installer"
    "simpletoolsdev.opencv-image"
    "slightc.pip-manager"
    "take-me1010.pykv-snippets"
    "vahidk.tensorflow-snippets"
    "wholroyd.jinja"

    # Java / C# / C++ / Swift
    "danielpinto8zz6.c-cpp-compile-run"
    "llvm-vs-code-extensions.lldb-dap"
    "ms-dotnettools.csdevkit"
    "ms-dotnettools.csharp"
    "ms-dotnettools.vscode-dotnet-runtime"
    "ms-vscode.cmake-tools"
    "ms-vscode.cpp-devtools"
    "ms-vscode.cpptools"
    "ms-vscode.cpptools-extension-pack"
    "ms-vscode.cpptools-themes"
    "swiftlang.swift-vscode"
    "twxs.cmake"
    "vscjava.vscode-gradle"

    # SQL / databases
    "cweijan.dbclient-jdbc"
    "cweijan.vscode-mysql-client2"
    "cweijan.vscode-postgresql-client2"
    "ms-mssql.data-workspace-vscode"
    "ms-mssql.mssql"
    "ms-mssql.sql-bindings-vscode"
    "ms-mssql.sql-database-projects-vscode"
    "ms-ossdata.vscode-pgsql"
    "mtxr.sqltools"
    "mtxr.sqltools-driver-mysql"
    "mtxr.sqltools-driver-pg"
    "qwtel.sqlite-viewer"
    "yy0931.vscode-sqlite3-editor"

    # Cloud / DevOps / containers
    "github.codespaces"
    "googlecloudtools.cloudcode"
    "googlecloudtools.datacloud"
    "hangxingliu.vscode-nginx-conf-hint"
    "jmmeessen.jenkins-declarative-support"
    "ms-azuretools.vscode-azure-mcp-server"
    "ms-azuretools.vscode-azureresourcegroups"
    "ms-azuretools.vscode-containers"
    "ms-azuretools.vscode-docker"
    "ms-vscode.vscode-node-azure-pack"
    "ms-vscode-remote.remote-containers"
    "shanoor.vscode-nginx"
    "teamsdevapp.vscode-ai-foundry"

    # Frontend noise (React, Expo, Alpine, Bootstrap, SCSS, live servers, old JS helpers)
    "adrianwilczynski.alpine-js-intellisense"
    "anbuselvanrocky.bootstrap5-vscode"
    "bhshawon.node-json-autocomplete"
    "brandonfowler.exe-runner"
    "christian-kohler.npm-intellisense"
    "cmstead.jsrefactor"
    "ecmel.vscode-html-css"
    "expo.vscode-expo-tools"
    "formulahendry.code-runner"
    "george-alisson.html-preview-vscode"
    "hansuxdev.bootstrap5-snippets"
    "hookyqr.minify"
    "janne252.fontawesome-autocomplete"
    "jasonnutter.search-node-modules"
    "leizongmin.node-module-intellisense"
    "miramac.vscode-exec-node"
    "mrmlnc.vscode-attrs-sorter"
    "mrmlnc.vscode-scss"
    "pranaygp.vscode-css-peek"
    "ritwickdey.liveserver"
    "rodrigovallades.es7-react-js-snippets"
    "solnurkarim.html-to-css-autocompletion"
    "steoates.autoimport"
    "swellaby.node-pack"
    "thekalinga.bootstrap4-vscode"
    "walkme.nodejs-extension-pack"
    "yandeu.five-server"
    "zignd.html-css-class-completion"

    # Data / office viewers
    "asadbek.sheetjs-demo"
    "builder.builder"
    "changkaiyan.tf2snippets"
    "cweijan.vscode-office"
    "haddiebakrie.material-kv"
    "insforge.insforge"
    "janisdd.vscode-edit-csv"
    "mrmlnc.vscode-doiuse"
    "randomfractalsinc.vscode-data-preview"
    "tomoki1207.pdf"
    "wushufen.auto-style"
    "xshrim.txt-syntax"

    # Unused utilities
    "alefragnani.project-manager"
    "intellsmi.comment-translate"
    "kisstkondoros.vscode-gutter-preview"
    "ms-edgedevtools.vscode-edge-devtools"
    "oderwat.indent-rainbow"
    "oxc.oxc-vscode"
    "pflannery.vscode-versionlens"
    "wscats.cors-browser"
    "ziyasal.vscode-open-in-github"
)

Write-Host ("About to uninstall {0} extensions. Press Ctrl+C to cancel." -f $extensions.Count) -ForegroundColor Yellow
Start-Sleep -Seconds 5

$failed = @()
foreach ($ext in $extensions) {
    Write-Host "Removing $ext" -ForegroundColor DarkGray
    & $codeCli --uninstall-extension $ext 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { $failed += $ext }
}

Write-Host ""
Write-Host ("Done. Removed {0} of {1}." -f ($extensions.Count - $failed.Count), $extensions.Count) -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host ("Not removed ({0}):" -f $failed.Count) -ForegroundColor DarkYellow
    $failed | ForEach-Object { Write-Host "  $_" }
}

Write-Host ""
Write-Host "Remaining extensions:" -ForegroundColor Cyan
& $codeCli --list-extensions
