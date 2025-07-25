#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from cx_Freeze import setup, Executable

# Configuracion base
base = None
if sys.platform == "win32":
    base = "Win32GUI"

# Ejecutable
executable = Executable(
    script="main.py",
    base=base,
    target_name="JURMAQ.exe"
)

# Setup
setup(
    name="JURMAQ",
    version="1.0.0",
    description="Sistema de Gestion",
    executables=[executable],
    options={
        "build_exe": {
            "packages": ["PyQt5.QtCore", "PyQt5.QtGui", "PyQt5.QtWidgets"],
            "include_msvcrt": True,
            "optimize": 1
        }
    }
)
