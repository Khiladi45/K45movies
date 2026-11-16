@echo off
setlocal
pushd "%~dp0" || exit /b 1
if not exist "node_modules\next\dist\bin\next" (
  call npm ci
  if errorlevel 1 goto :failed
)
if not exist ".next\BUILD_ID" (
  call npm run build
  if errorlevel 1 goto :failed
)
call npm run start:local
if errorlevel 1 goto :failed
popd
exit /b 0

:failed
popd
exit /b 1
