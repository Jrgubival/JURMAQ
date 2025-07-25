#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SETUP PARA EJECUTABLE JURMAQ
Configuración para crear el ejecutable del sistema
Usuario: Jrgubival
Fecha: 2025-07-25 00:49:49 UTC
"""

import sys
import os
from cx_Freeze import setup, Executable

# Información de la aplicación
APP_NAME = "JURMAQ"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "Sistema Integral de Gestión Empresarial"
APP_AUTHOR = "Jrgubival"
APP_COPYRIGHT = "© 2025 Jrgubival - Todos los derechos reservados"

# Configuración del ejecutable principal
base = None
if sys.platform == "win32":
    base = "Win32GUI"  # Para ocultar la consola en Windows

# Archivos adicionales a incluir
include_files = [
    ("resources/", "resources/"),
    ("templates/", "templates/"),
    ("data/", "data/"),
    ("documents/", "documents/"),
    ("config/", "config/"),
    ("README.md", "README.md"),
    ("requirements.txt", "requirements.txt")
]

# Paquetes a incluir
packages = [
    "PyQt5.QtCore",
    "PyQt5.QtGui", 
    "PyQt5.QtWidgets",
    "sqlite3",
    "datetime",
    "json",
    "os",
    "sys",
    "hashlib",
    "shutil",
    "modules",
    "config",
    "utils",
    "ui"
]

# Módulos a incluir
includes = [
    "PyQt5.QtCore",
    "PyQt5.QtGui",
    "PyQt5.QtWidgets",
    "PyQt5.QtPrintSupport",
    "sqlite3",
    "datetime",
    "json"
]

# Módulos a excluir
excludes = [
    "tkinter",
    "matplotlib",
    "numpy",
    "scipy",
    "pandas"
]

# Opciones de build
build_options = {
    "packages": packages,
    "includes": includes,
    "excludes": excludes,
    "include_files": include_files,
    "include_msvcrt": True,
    "optimize": 2
}

# Configuración del ejecutable
executable = Executable(
    script="main.py",
    base=base,
    target_name="JURMAQ.exe",
    icon="resources/icons/app_icon.ico",  # Ícono de la aplicación
    copyright=APP_COPYRIGHT,
    trademarks=APP_COPYRIGHT
)

# Setup principal
setup(
    name=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    author=APP_AUTHOR,
    options={"build_exe": build_options},
    executables=[executable]
)