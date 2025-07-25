#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUILD JURMAQ CON CODIFICACIÓN CORREGIDA
Solución al error de UTF-8
Usuario: Jrgubival
Fecha: 2025-07-25 01:14:35 UTC
"""

import os
import sys
import subprocess
import shutil

def main():
    print("🔥 JURMAQ BUILD - CODIFICACIÓN CORREGIDA")
    print("=" * 50)
    
    # 1. Instalar dependencias
    print("1. Instalando dependencias...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "cx_Freeze", "PyQt5", "--quiet"], 
                      check=True, encoding='utf-8')
        print("✅ Dependencias instaladas")
    except Exception as e:
        print(f"⚠️ Error instalando dependencias: {e}")
    
    # 2. Limpiar
    print("2. Limpiando builds anteriores...")
    for folder in ["build", "dist"]:
        if os.path.exists(folder):
            try:
                shutil.rmtree(folder)
                print(f"🗑️ {folder} eliminado")
            except Exception as e:
                print(f"⚠️ Error eliminando {folder}: {e}")
    
    # 3. Crear main.py básico
    print("3. Creando main.py...")
    main_content = """#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
from PyQt5.QtWidgets import QApplication, QMessageBox

def main():
    app = QApplication(sys.argv)
    
    msg = QMessageBox()
    msg.setWindowTitle("JURMAQ v1.0")
    msg.setText("JURMAQ Sistema de Gestion\\n\\nSistema funcionando correctamente!")
    msg.setInformativeText("Desarrollado por: Jrgubival")
    msg.exec_()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
"""
    
    # Escribir con codificación UTF-8 explícita
    with open("main.py", "w", encoding='utf-8') as f:
        f.write(main_content)
    print("✅ main.py creado")
    
    # 4. Crear setup con codificación correcta
    print("4. Creando setup.py corregido...")
    setup_content = """#!/usr/bin/env python3
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
"""
    
    # Escribir setup con codificación UTF-8
    with open("setup_fixed.py", "w", encoding='utf-8') as f:
        f.write(setup_content)
    print("✅ setup_fixed.py creado")
    
    # 5. Ejecutar build
    print("5. Ejecutando build...")
    try:
        # Usar encoding UTF-8 en el subprocess
        result = subprocess.run(
            [sys.executable, "setup_fixed.py", "build"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=180
        )
        
        if result.returncode == 0:
            print("✅ BUILD EXITOSO!")
            
            # Buscar ejecutable
            exe_found = False
            for root, dirs, files in os.walk("build"):
                for file in files:
                    if file == "JURMAQ.exe":
                        exe_path = os.path.join(root, file)
                        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
                        
                        print(f"🎉 EJECUTABLE CREADO:")
                        print(f"   📁 Ubicacion: {exe_path}")
                        print(f"   📊 Tamaño: {size_mb:.1f} MB")
                        
                        # Crear carpeta de distribución
                        dist_folder = "JURMAQ_Final"
                        if os.path.exists(dist_folder):
                            shutil.rmtree(dist_folder)
                        
                        shutil.copytree(root, dist_folder)
                        print(f"   📦 Distribucion: {dist_folder}/")
                        
                        exe_found = True
                        break
                if exe_found:
                    break
            
            if not exe_found:
                print("❌ No se encontro JURMAQ.exe")
                return False
            
            return True
            
        else:
            print("❌ Error en build:")
            if result.stderr:
                print("STDERR:", result.stderr)
            if result.stdout:
                print("STDOUT:", result.stdout)
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Build timeout (mas de 3 minutos)")
        return False
    except Exception as e:
        print(f"❌ Error en build: {e}")
        return False

if __name__ == "__main__":
    success = main()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 EXITO! Ejecutable creado en 'JURMAQ_Final/'")
        print("🚀 Para probar: ejecute JURMAQ_Final/JURMAQ.exe")
    else:
        print("❌ Build fallo. Revise errores arriba.")
    print("=" * 50)
    
    input("\nPresione Enter para salir...")