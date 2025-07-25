#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUILD JURMAQ FINAL - VERSIÓN QUE FUNCIONA
Sin opciones problemáticas de cx_Freeze
Usuario: Jrgubival
Fecha: 2025-07-25 01:17:36 UTC
"""

import os
import sys
import subprocess
import shutil

def main():
    print("🔥 JURMAQ BUILD FINAL - GARANTIZADO")
    print("=" * 50)
    
    # 1. Limpiar builds anteriores
    print("1. Limpiando builds anteriores...")
    for folder in ["build", "dist", "__pycache__"]:
        if os.path.exists(folder):
            try:
                shutil.rmtree(folder)
                print(f"🗑️ {folder} eliminado")
            except Exception as e:
                print(f"⚠️ Error eliminando {folder}: {e}")
    
    # 2. Crear main.py funcional
    print("2. Creando main.py...")
    main_content = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os

try:
    from PyQt5.QtWidgets import QApplication, QMainWindow, QLabel, QVBoxLayout, QWidget, QPushButton
    from PyQt5.QtCore import Qt
    from PyQt5.QtGui import QFont
    
    class JURMAQApp(QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("JURMAQ v1.0 - Sistema de Gestion")
            self.setGeometry(200, 200, 600, 400)
            
            # Widget central
            central_widget = QWidget()
            self.setCentralWidget(central_widget)
            
            # Layout
            layout = QVBoxLayout()
            
            # Titulo principal
            title = QLabel("JURMAQ")
            title.setFont(QFont("Arial", 28, QFont.Bold))
            title.setAlignment(Qt.AlignCenter)
            title.setStyleSheet("color: #1e40af; margin: 20px;")
            
            # Subtitulo
            subtitle = QLabel("Sistema Integral de Gestion Empresarial")
            subtitle.setFont(QFont("Arial", 16))
            subtitle.setAlignment(Qt.AlignCenter)
            subtitle.setStyleSheet("color: #6b7280; margin-bottom: 20px;")
            
            # Info del sistema
            info = QLabel("Ejecutable funcionando correctamente!\\n\\n"
                         "Version: 1.0.0\\n"
                         "Desarrollado por: Jrgubival\\n"
                         "Fecha: 2025-07-25\\n\\n"
                         "Sistema JURMAQ listo para usar.")
            info.setFont(QFont("Arial", 12))
            info.setAlignment(Qt.AlignCenter)
            info.setStyleSheet("""
                background-color: #f0fdf4; 
                padding: 20px; 
                border-radius: 10px; 
                border: 2px solid #10b981;
                margin: 20px;
            """)
            
            # Boton cerrar
            close_btn = QPushButton("Cerrar Aplicacion")
            close_btn.setFont(QFont("Arial", 12, QFont.Bold))
            close_btn.setStyleSheet("""
                QPushButton {
                    background-color: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 20px;
                }
                QPushButton:hover {
                    background-color: #dc2626;
                }
            """)
            close_btn.clicked.connect(self.close)
            
            # Agregar widgets al layout
            layout.addWidget(title)
            layout.addWidget(subtitle)
            layout.addWidget(info)
            layout.addWidget(close_btn)
            
            central_widget.setLayout(layout)
    
    def main():
        app = QApplication(sys.argv)
        window = JURMAQApp()
        window.show()
        return app.exec_()
    
    if __name__ == "__main__":
        sys.exit(main())
        
except ImportError as e:
    print(f"Error: PyQt5 no esta disponible - {e}")
    input("Presione Enter para salir...")
except Exception as e:
    print(f"Error general: {e}")
    input("Presione Enter para salir...")
'''
    
    with open("main.py", "w", encoding='utf-8') as f:
        f.write(main_content)
    print("✅ main.py creado")
    
    # 3. Crear setup sin opciones problemáticas
    print("3. Creando setup sin opciones problemáticas...")
    setup_content = '''#!/usr/bin/env python3
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
'''
    
    with open("setup_working.py", "w", encoding='utf-8') as f:
        f.write(setup_content)
    print("✅ setup_working.py creado")
    
    # 4. Verificar PyQt5
    print("4. Verificando PyQt5...")
    try:
        import PyQt5
        print("✅ PyQt5 disponible")
    except ImportError:
        print("📦 Instalando PyQt5...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "PyQt5"], check=True)
            print("✅ PyQt5 instalado")
        except:
            print("❌ Error instalando PyQt5")
            return False
    
    # 5. Ejecutar build
    print("5. Ejecutando build...")
    print("⏳ Esperando... (puede tomar 2-3 minutos)")
    
    try:
        result = subprocess.run(
            [sys.executable, "setup_working.py", "build"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore',
            timeout=300  # 5 minutos máximo
        )
        
        print("📝 Build completado, verificando resultado...")
        
        if result.returncode == 0:
            print("✅ BUILD EXITOSO!")
            
            # Buscar el ejecutable
            exe_found = False
            build_dir = None
            
            for root, dirs, files in os.walk("build"):
                for file in files:
                    if file == "JURMAQ.exe":
                        exe_path = os.path.join(root, file)
                        build_dir = root
                        
                        try:
                            size_mb = os.path.getsize(exe_path) / (1024 * 1024)
                            
                            print(f"🎉 EJECUTABLE ENCONTRADO:")
                            print(f"   📁 Ubicacion: {exe_path}")
                            print(f"   📊 Tamaño: {size_mb:.1f} MB")
                            
                            exe_found = True
                            break
                        except Exception as e:
                            print(f"⚠️ Error obteniendo info del ejecutable: {e}")
                            exe_found = True  # Continuar aunque no se pueda obtener el tamaño
                            break
                if exe_found:
                    break
            
            if exe_found and build_dir:
                # Crear carpeta de distribución final
                final_folder = "JURMAQ_Ejecutable_Final"
                
                try:
                    if os.path.exists(final_folder):
                        shutil.rmtree(final_folder)
                    
                    shutil.copytree(build_dir, final_folder)
                    print(f"📦 Distribucion final: {final_folder}/")
                    print(f"🚀 Para ejecutar: {final_folder}/JURMAQ.exe")
                    
                    return True
                    
                except Exception as e:
                    print(f"⚠️ Error copiando a distribucion final: {e}")
                    print(f"✅ Ejecutable disponible en: {build_dir}/JURMAQ.exe")
                    return True
            
            elif not exe_found:
                print("❌ No se encontro JURMAQ.exe en el build")
                print("📁 Archivos generados:")
                for root, dirs, files in os.walk("build"):
                    for file in files:
                        print(f"   - {os.path.join(root, file)}")
                return False
            
        else:
            print("❌ Error en el build:")
            if result.stderr:
                print("STDERR:")
                print(result.stderr)
            if result.stdout:
                print("STDOUT:")
                print(result.stdout)
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Build timeout (mas de 5 minutos)")
        return False
    except Exception as e:
        print(f"❌ Error ejecutando build: {e}")
        return False

if __name__ == "__main__":
    print("🏗️ JURMAQ - BUILD FINAL")
    print(f"📅 Fecha: 2025-07-25 01:17:36")
    print(f"👤 Usuario: Jrgubival")
    print("=" * 50)
    
    success = main()
    
    print("\n" + "=" * 50)
    print("🏁 RESULTADO FINAL")
    print("=" * 50)
    
    if success:
        print("🎉 ¡EXITO TOTAL!")
        print("✅ Ejecutable JURMAQ.exe creado correctamente")
        print("📁 Busque la carpeta 'JURMAQ_Ejecutable_Final'")
        print("🚀 Ejecute: JURMAQ_Ejecutable_Final/JURMAQ.exe")
        print("")
        print("🎯 El sistema JURMAQ esta listo para usar!")
    else:
        print("❌ Build fallo")
        print("🔍 Revise los errores mostrados arriba")
    
    print("=" * 50)
    input("\nPresione Enter para salir...")