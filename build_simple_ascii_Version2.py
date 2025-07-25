#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import subprocess
import shutil

print("JURMAQ BUILD SIMPLE - SIN CARACTERES ESPECIALES")
print("=" * 60)

# Limpiar
print("Limpiando...")
for folder in ["build", "dist"]:
    if os.path.exists(folder):
        shutil.rmtree(folder)

# Crear main.py simple
print("Creando main.py...")
with open("main.py", "w", encoding="ascii", errors="ignore") as f:
    f.write("""import sys
from PyQt5.QtWidgets import QApplication, QMessageBox

app = QApplication(sys.argv)
msg = QMessageBox()
msg.setWindowTitle("JURMAQ v1.0")
msg.setText("JURMAQ Sistema funcionando!")
msg.exec_()
sys.exit()
""")

# Crear setup simple
print("Creando setup...")
with open("setup.py", "w", encoding="ascii", errors="ignore") as f:
    f.write("""import sys
from cx_Freeze import setup, Executable

base = "Win32GUI" if sys.platform == "win32" else None

setup(
    name="JURMAQ",
    version="1.0.0",
    executables=[Executable("main.py", base=base, target_name="JURMAQ.exe")],
    options={"build_exe": {"packages": ["PyQt5.QtCore", "PyQt5.QtGui", "PyQt5.QtWidgets"]}}
)
""")

# Build
print("Ejecutando build...")
result = subprocess.run([sys.executable, "setup.py", "build"], 
                       capture_output=True, text=True)

if result.returncode == 0:
    print("BUILD EXITOSO!")
    
    # Buscar ejecutable
    for root, dirs, files in os.walk("build"):
        if "JURMAQ.exe" in files:
            exe_path = os.path.join(root, "JURMAQ.exe")
            print(f"Ejecutable: {exe_path}")
            print(f"Tamaño: {os.path.getsize(exe_path)/(1024*1024):.1f} MB")
            break
else:
    print("ERROR:", result.stderr)

input("Presione Enter...")