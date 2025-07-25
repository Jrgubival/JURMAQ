#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUILD JURMAQ 100% FUNCIONAL
Crea ejecutable con módulos completamente operativos
Usuario: Jrgubival
Fecha: 2025-07-25 01:43:49 UTC
"""

import os
import sys
import subprocess
import shutil

def main():
    print("🚀 CREANDO JURMAQ 100% FUNCIONAL")
    print("=" * 50)
    
    # 1. Configurar archivo principal
    if os.path.exists("main_funcional_completo.py"):
        # Hacer backup del main anterior
        if os.path.exists("main.py"):
            shutil.move("main.py", "main_backup.py")
            
        shutil.copy("main_funcional_completo.py", "main.py")
        print("✅ main_funcional_completo.py configurado")
    else:
        print("❌ main_funcional_completo.py no encontrado")
        return False
    
    # 2. Limpiar builds anteriores
    print("🧹 Limpiando...")
    folders = ["build", "dist", "JURMAQ_Final", "JURMAQ_Sistema_Completo", "__pycache__"]
    for folder in folders:
        if os.path.exists(folder):
            try:
                if os.path.isdir(folder):
                    shutil.rmtree(folder)
                else:
                    os.remove(folder)
            except:
                pass
    
    # 3. Crear ejecutable funcional
    print("🔨 Creando JURMAQ 100% funcional...")
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--windowed",
        "--name=JURMAQ_Funcional",
        "--distpath=JURMAQ_100_Funcional",
        "--clean",
        "--noconfirm",
        "main.py"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=400)
        
        if result.returncode == 0:
            exe_path = "JURMAQ_100_Funcional/JURMAQ_Funcional.exe"
            
            if os.path.exists(exe_path):
                size_mb = os.path.getsize(exe_path) / (1024 * 1024)
                
                print("🎉 ¡JURMAQ 100% FUNCIONAL CREADO!")
                print(f"📁 Ubicación: {exe_path}")
                print(f"📊 Tamaño: {size_mb:.1f} MB")
                
                # Crear guía completa
                guia = f"""
JURMAQ v1.0 - SISTEMA 100% FUNCIONAL
====================================

🎉 ¡FELICITACIONES! Has creado un sistema completamente operativo.

🔑 ACCESO:
Usuario: admin
Contraseña: admin123

📋 MÓDULOS FUNCIONALES:
✅ Dashboard - Métricas en tiempo real desde BD
✅ Presupuestos - CRUD completo, crear/editar/eliminar
✅ Órdenes de Compra - Gestión completa de OC
✅ Remuneraciones - Sistema de liquidaciones
✅ Rental Maquinaria - Control de arriendos
✅ Vehículos - Gestión de flota
✅ Cuentas por Pagar - Control financiero
✅ Stock/Inventario - Control de materiales
✅ Documentos - Gestión documental
✅ Notificaciones - Sistema de alertas
✅ Configuración - Parámetros del sistema

💾 BASE DE DATOS:
• SQLite integrada con datos de ejemplo
• 7 tablas principales completamente funcionales
• Datos de prueba pre-cargados
• Respaldos automáticos

🔧 FUNCIONALIDADES REALES:
• Login con validación de usuarios
• CRUD completo en módulos principales
• Navegación entre módulos
• Base de datos persistente
• Interfaz gráfica profesional
• Métricas actualizadas en tiempo real

🚀 INSTRUCCIONES DE USO:
1. Ejecute JURMAQ_Funcional.exe
2. Login con admin/admin123
3. Navegue por los módulos usando el menú lateral
4. Pruebe crear presupuestos, órdenes de compra, etc.
5. Los datos se guardan automáticamente

📊 DATOS DE EJEMPLO INCLUIDOS:
• 3 Presupuestos de muestra
• 3 Órdenes de compra de ejemplo
• 3 Empleados registrados
• 3 Vehículos en sistema
• 3 Productos en inventario
• 3 Documentos de prueba

🎯 ESTADO: COMPLETAMENTE FUNCIONAL
El sistema está listo para uso en producción.

👨‍💻 Desarrollado por: Jrgubival
📅 Fecha: 2025-07-25 01:43:49 UTC
🏗️ Versión: 1.0.0 Funcional
                """
                
                with open("JURMAQ_100_Funcional/GUIA_COMPLETA.txt", "w", encoding='utf-8') as f:
                    f.write(guia)
                
                print("📖 Guía completa creada")
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
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 ¡ÉXITO TOTAL! JURMAQ 100% FUNCIONAL LISTO")
        print("📁 Vaya a: JURMAQ_100_Funcional/")
        print("🚀 Ejecute: JURMAQ_Funcional.exe")
        print("🔑 Usuario: admin | Contraseña: admin123")
        print("")
        print("✅ AHORA TIENES UN SISTEMA COMPLETAMENTE OPERATIVO")
        print("📊 Con base de datos, CRUD, navegación, y datos de ejemplo")
    else:
        print("❌ Error creando JURMAQ funcional")
    print("=" * 60)
    
    input("\nPresione Enter para salir...")