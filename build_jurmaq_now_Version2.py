#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUILD JURMAQ INMEDIATO - TODO EN UNO
Script que crea el ejecutable sin problemas
Usuario: Jrgubival
Fecha: 2025-07-25 01:08:15 UTC
"""

import os
import sys
import subprocess
import shutil

def main():
    print("🏗️ JURMAQ - BUILD INMEDIATO")
    print("=" * 40)
    
    # 1. Instalar dependencias
    print("1. Instalando dependencias...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "cx_Freeze", "PyQt5", "--quiet"], check=True)
        print("✅ Dependencias instaladas")
    except:
        print("⚠️ Error instalando dependencias (continuando...)")
    
    # 2. Limpiar
    print("2. Limpiando...")
    for folder in ["build", "dist"]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
    
    # 3. Crear main.py si no existe
    if not os.path.exists("main.py"):
        print("3. Creando main.py...")
        with open("main.py", "w") as f:
            f.write('''import sys
from PyQt5.QtWidgets import QApplication, QMessageBox

app = QApplication(sys.argv)
msg = QMessageBox()
msg.setWindowTitle("JURMAQ v1.0")  
msg.setText("🏗️ JURMAQ Sistema de Gestión\\n\\n✅ Funcionando correctamente!")
msg.exec_()
sys.exit()
''')
    
    # 4. Crear setup directo
    print("4. Creando setup...")
    setup_code = '''
import sys
from cx_Freeze import setup, Executable

base = "Win32GUI" if sys.platform == "win32" else None

setup(
    name="JURMAQ",
    version="1.0.0", 
    description="Sistema de Gestión",
    executables=[Executable("main.py", base=base, target_name="JURMAQ.exe")],
    options={
        "build_exe": {
            "packages": ["PyQt5.QtCore", "PyQt5.QtGui", "PyQt5.QtWidgets"],
            "include_msvcrt": True
        }
    }
)
'''
    
    with open("setup_now.py", "w") as f:
        f.write(setup_code)
    
    # 5. Build
    print("5. Creando ejecutable...")
    result = subprocess.run([sys.executable, "setup_now.py", "build"], 
                          capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ BUILD EXITOSO!")
        
        # Buscar ejecutable
        for root, dirs, files in os.walk("build"):
            if "JURMAQ.exe" in files:
                exe_path = os.path.join(root, "JURMAQ.exe")
                print(f"🎉 Ejecutable: {exe_path}")
                print(f"📊 Tamaño: {os.path.getsize(exe_path)/(1024*1024):.1f} MB")
                return True
        
        print("❌ Ejecutable no encontrado")
        return False
    else:
        print("❌ Error en build:")
        print(result.stderr)
        return False

if __name__ == "__main__":
    if main():
        print("\n🎉 ¡JURMAQ.exe creado exitosamente!")
    else:
        print("\n❌ Error en el build")
    input("Presione Enter para salir...")