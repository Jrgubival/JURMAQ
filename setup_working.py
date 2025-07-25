#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from cx_Freeze import setup, Executable

# Base para Windows (sin consola)
base = None
if sys.platform == "win32":
    base = "Win32GUI"

# Ejecutable
executable = Executable(
    script="main.py",
    base=base,
    target_name="JURMAQ.exe"
)

# Setup con opciones mínimas que funcionan
setup(
    name="JURMAQ",
    version="1.0.0",
    description="Sistema de Gestion JURMAQ",
    executables=[executable],
    options={
        "build_exe": {
            # Solo paquetes esenciales
            "packages": [
                "PyQt5.QtCore", 
                "PyQt5.QtGui", 
                "PyQt5.QtWidgets"
            ],
            # Excluir paquetes innecesarios
            "excludes": [
                "tkinter", 
                "unittest", 
                "test", 
                "distutils",
                "email",
                "html",
                "http",
                "urllib",
                "xml"
            ]
        }
    }
)
