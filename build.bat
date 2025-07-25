@echo off
REM Script automatizado para crear ejecutable JURMAQ
REM Usuario: Jrgubival
REM Fecha: 2025-07-25 00:49:49 UTC

echo ===================================
echo 🏗️  JURMAQ BUILD SCRIPT v1.0
echo ===================================
echo 👨‍💻 Usuario: Jrgubival
echo 📅 Fecha: %date% %time%
echo ===================================

REM Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python no está instalado o no está en PATH
    pause
    exit /b 1
)

echo ✅ Python encontrado

REM Instalar dependencias si es necesario
echo 📦 Verificando dependencias...
pip install cx_Freeze PyQt5 --quiet

REM Ejecutar build script
echo 🔨 Iniciando proceso de build...
python build_exe.py

if %errorlevel% equ 0 (
    echo ✅ Build completado exitosamente
    echo 📦 Busque el ejecutable en la carpeta 'dist'
) else (
    echo ❌ Error durante el build
)

echo.
echo ===================================
echo Build finalizado
echo ===================================
pause