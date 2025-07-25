#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUILD JURMAQ COMPLETO - CON TODOS LOS MÓDULOS
Crea el ejecutable con el sistema completo funcional
Usuario: Jrgubival
Fecha: 2025-07-25 01:32:40 UTC
"""

import os
import sys
import subprocess
import shutil

def main():
    print("🏗️ CREANDO JURMAQ COMPLETO FUNCIONAL")
    print("=" * 50)
    
    # 1. Renombrar main.py anterior
    if os.path.exists("main.py"):
        try:
            shutil.move("main.py", "main_demo.py")
            print("📁 main.py anterior guardado como main_demo.py")
        except:
            pass
    
    # 2. Usar el main completo
    if os.path.exists("main_completo.py"):
        shutil.copy("main_completo.py", "main.py")
        print("✅ main_completo.py configurado como main.py")
    else:
        print("❌ main_completo.py no encontrado")
        return False
    
    # 3. Limpiar builds anteriores
    print("🧹 Limpiando builds anteriores...")
    for folder in ["build", "dist", "JURMAQ_Final", "__pycache__"]:
        if os.path.exists(folder):
            try:
                if os.path.isdir(folder):
                    shutil.rmtree(folder)
                else:
                    os.remove(folder)
            except:
                pass
    
    # 4. Crear ejecutable con PyInstaller
    print("🔨 Creando ejecutable completo...")
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--windowed", 
        "--name=JURMAQ_Completo",
        "--distpath=JURMAQ_Sistema_Completo",
        "--clean",
        "--noconfirm",
        "main.py"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0:
            exe_path = "JURMAQ_Sistema_Completo/JURMAQ_Completo.exe"
            
            if os.path.exists(exe_path):
                size_mb = os.path.getsize(exe_path) / (1024 * 1024)
                
                print("🎉 ¡JURMAQ COMPLETO CREADO!")
                print(f"📁 Ubicación: {exe_path}")
                print(f"📊 Tamaño: {size_mb:.1f} MB")
                
                # Crear manual de usuario
                manual = """
JURMAQ v1.0 - MANUAL DE USUARIO
===============================

🔑 ACCESO AL SISTEMA:
Usuario: admin
Contraseña: admin123

📋 MÓDULOS DISPONIBLES:
• Dashboard - Panel principal con métricas
• Presupuestos - Gestión de presupuestos y cotizaciones
• Órdenes de Compra - Control de órdenes de compra
• Remuneraciones - Liquidación de sueldos
• Rental Maquinaria - Arriendo de maquinaria
• Vehículos - Gestión de flota vehicular
• Cuentas por Pagar - Control financiero
• Stock/Inventario - Control de materiales
• Documentos - Gestión documental
• Notificaciones - Sistema de alertas
• Configuración - Configuración del sistema

🚀 INSTRUCCIONES:
1. Ejecute JURMAQ_Completo.exe
2. Ingrese usuario: admin, contraseña: admin123
3. Navegue por los módulos usando el menú lateral
4. Cada módulo tiene funcionalidades específicas

👨‍💻 Desarrollado por: Jrgubival
📅 Fecha: 2025-07-25
🏗️ Versión: 1.0.0
                """
                
                with open("JURMAQ_Sistema_Completo/MANUAL_USUARIO.txt", "w", encoding='utf-8') as f:
                    f.write(manual)
                
                print("📖 Manual de usuario creado")
                return True
            else:
                print("❌ Ejecutable no encontrado")
                return False
        else:
            print("❌ Error en PyInstaller:")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = main()
    
    if success:
        print("\n🎉 ¡ÉXITO! JURMAQ COMPLETO LISTO")
        print("📁 Vaya a: JURMAQ_Sistema_Completo/")
        print("🚀 Ejecute: JURMAQ_Completo.exe")
        print("🔑 Usuario: admin | Contraseña: admin123")
    else:
        print("\n❌ Error creando JURMAQ completo")
    
    input("\nPresione Enter para salir...")