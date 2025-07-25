#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SISTEMA INTEGRAL DE GESTIÓN JURMAQ
Sistema completo de gestión empresarial para construcción e ingeniería
Usuario: Jrgubival
Fecha: 2025-07-25 00:47:55 UTC
"""

import sys
import os
from datetime import datetime

# Información del sistema
__title__ = "JURMAQ"
__description__ = "Sistema Integral de Gestión Empresarial"
__version__ = "1.0.0"
__author__ = "Jrgubival"
__email__ = "jrgubival@jurmaq.com"
__license__ = "Propietario"
__copyright__ = f"© 2025 {__author__} - Todos los derechos reservados"
__build_date__ = "2025-07-25"
__python_requires__ = ">=3.7"

# Información de módulos
MODULES_COUNT = 12
DATABASE_VERSION = "1.0"
UI_FRAMEWORK = "PyQt5"

# Metadatos del sistema
SYSTEM_INFO = {
    'name': __title__,
    'version': __version__,
    'description': __description__,
    'author': __author__,
    'build_date': __build_date__,
    'python_requires': __python_requires__,
    'framework': UI_FRAMEWORK,
    'database_version': DATABASE_VERSION,
    'modules_count': MODULES_COUNT,
    'license': __license__,
    'copyright': __copyright__
}

# Funcionalidades principales
FEATURES = [
    "🏠 Dashboard Principal con métricas en tiempo real",
    "📊 Módulo de Presupuestos y Cotizaciones",
    "🛒 Control de Órdenes de Compra y Combustible", 
    "💰 Sistema de Remuneraciones y Liquidaciones",
    "🚜 Rental de Maquinaria Pesada",
    "🚛 Gestión Integral de Flota Vehicular",
    "💳 Control de Cuentas por Pagar",
    "📦 Inventario y Control de Stock",
    "📋 Sistema de Gestión Documental",
    "🔔 Sistema Inteligente de Notificaciones",
    "👥 Gestión de Usuarios y Permisos",
    "⚙️ Configuración Avanzada del Sistema"
]

# Requerimientos del sistema
REQUIREMENTS = [
    "PyQt5>=5.15.0",
    "sqlite3",
    "datetime", 
    "json",
    "os",
    "sys",
    "hashlib",
    "shutil"
]

def get_system_info():
    """Obtener información completa del sistema"""
    return SYSTEM_INFO

def get_version():
    """Obtener versión del sistema"""
    return __version__

def get_features():
    """Obtener lista de características"""
    return FEATURES

def get_requirements():
    """Obtener lista de requerimientos"""
    return REQUIREMENTS

def check_requirements():
    """Verificar requerimientos del sistema"""
    missing_requirements = []
    
    try:
        import PyQt5
        from PyQt5 import QtWidgets, QtCore, QtGui
    except ImportError:
        missing_requirements.append("PyQt5")
    
    # Verificar versión de Python
    if sys.version_info < (3, 7):
        missing_requirements.append(f"Python >= 3.7 (actual: {sys.version})")
    
    return missing_requirements

def get_installation_info():
    """Obtener información de instalación"""
    return {
        'install_path': os.path.dirname(os.path.abspath(__file__)),
        'python_version': sys.version,
        'platform': sys.platform,
        'executable': sys.executable,
        'missing_requirements': check_requirements()
    }

def print_welcome_message():
    """Mostrar mensaje de bienvenida"""
    print("=" * 60)
    print(f"🏗️  {__title__} v{__version__}")
    print(f"📋  {__description__}")
    print(f"👨‍💻  Desarrollado por: {__author__}")
    print(f"📅  Fecha: {__build_date__}")
    print("=" * 60)
    print(f"📦  Módulos disponibles: {MODULES_COUNT}")
    print(f"🛠️  Framework: {UI_FRAMEWORK}")
    print(f"💾  Base de datos: SQLite v{DATABASE_VERSION}")
    print("=" * 60)
    
    # Verificar requerimientos
    missing = check_requirements()
    if missing:
        print("⚠️  Requerimientos faltantes:")
        for req in missing:
            print(f"   ❌ {req}")
    else:
        print("✅  Todos los requerimientos están instalados")
    
    print("=" * 60)

def main():
    """Función principal para ejecutar JURMAQ"""
    print_welcome_message()
    
    # Verificar requerimientos
    missing = check_requirements()
    if missing:
        print("\n❌ No se puede ejecutar JURMAQ. Instale los requerimientos faltantes.")
        return False
    
    try:
        # Importar y ejecutar la aplicación principal
        from main import main as run_jurmaq
        print("\n🚀 Iniciando JURMAQ...")
        run_jurmaq()
        return True
        
    except ImportError as e:
        print(f"\n❌ Error importando módulos: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Error ejecutando JURMAQ: {e}")
        return False

# Información para desarrollo
DEV_INFO = {
    'development_start': "2025-07-24",
    'development_end': "2025-07-25", 
    'total_development_time': "2 días",
    'lines_of_code': "~20,000",
    'files_count': "~80",
    'modules_implemented': 12,
    'database_tables': "~25",
    'ui_components': "~50"
}

def get_dev_info():
    """Obtener información de desarrollo"""
    return DEV_INFO

# Exportar elementos principales
__all__ = [
    '__version__',
    '__author__', 
    '__title__',
    '__description__',
    'SYSTEM_INFO',
    'FEATURES',
    'REQUIREMENTS',
    'get_system_info',
    'get_version',
    'get_features',
    'get_requirements',
    'check_requirements',
    'get_installation_info',
    'print_welcome_message',
    'main'
]

# Auto-ejecutar mensaje de bienvenida al importar
if __name__ == "__main__":
    main()
else:
    # Solo mostrar info básica al importar como módulo
    print(f"📦 {__title__} v{__version__} cargado")