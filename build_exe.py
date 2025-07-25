#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SCRIPT AUTOMATIZADO PARA CREAR EJECUTABLE JURMAQ
Script que automatiza todo el proceso de creación del .exe
Usuario: Jrgubival
Fecha: 2025-07-25 00:49:49 UTC
"""

import os
import sys
import shutil
import subprocess
from datetime import datetime
import zipfile

class JURMAQBuilder:
    """Constructor automatizado del ejecutable JURMAQ"""
    
    def __init__(self):
        self.app_name = "JURMAQ"
        self.version = "1.0.0"
        self.build_dir = "build"
        self.dist_dir = "dist"
        self.temp_dir = "temp_build"
        
    def print_step(self, step, message):
        """Imprimir paso del proceso"""
        print(f"\n{'='*60}")
        print(f"🔧 PASO {step}: {message}")
        print(f"{'='*60}")
        
    def check_requirements(self):
        """Verificar requerimientos para el build"""
        self.print_step(1, "VERIFICANDO REQUERIMIENTOS")
        
        required_packages = [
            "cx_Freeze",
            "PyQt5"
        ]
        
        missing_packages = []
        
        for package in required_packages:
            try:
                __import__(package)
                print(f"✅ {package} - OK")
            except ImportError:
                missing_packages.append(package)
                print(f"❌ {package} - FALTANTE")
        
        if missing_packages:
            print(f"\n⚠️ Instale los paquetes faltantes:")
            for package in missing_packages:
                print(f"   pip install {package}")
            return False
            
        print("✅ Todos los requerimientos están disponibles")
        return True
        
    def create_icon(self):
        """Crear ícono de la aplicación"""
        self.print_step(2, "PREPARANDO ÍCONO DE LA APLICACIÓN")
        
        # Crear directorio de recursos si no existe
        resources_dir = "resources/icons"
        os.makedirs(resources_dir, exist_ok=True)
        
        # Si no existe el ícono, crear uno básico
        icon_path = f"{resources_dir}/app_icon.ico"
        if not os.path.exists(icon_path):
            print("📝 Creando ícono básico...")
            # Aquí podrías usar PIL para crear un ícono básico
            # Por ahora, solo indicamos que se necesita
            print(f"⚠️ Coloque el archivo app_icon.ico en {resources_dir}/")
            print("   Puede convertir una imagen PNG a ICO online")
        else:
            print(f"✅ Ícono encontrado: {icon_path}")
            
    def clean_build(self):
        """Limpiar directorios de build anteriores"""
        self.print_step(3, "LIMPIANDO BUILDS ANTERIORES")
        
        dirs_to_clean = [self.build_dir, self.dist_dir, self.temp_dir]
        
        for dir_name in dirs_to_clean:
            if os.path.exists(dir_name):
                shutil.rmtree(dir_name)
                print(f"🗑️ Eliminado: {dir_name}")
            else:
                print(f"✅ {dir_name} - Ya estaba limpio")
                
    def prepare_files(self):
        """Preparar archivos necesarios"""
        self.print_step(4, "PREPARANDO ARCHIVOS")
        
        # Crear directorios necesarios
        required_dirs = [
            "resources/icons",
            "resources/images", 
            "resources/sounds",
            "templates",
            "data",
            "documents",
            "reports"
        ]
        
        for dir_name in required_dirs:
            os.makedirs(dir_name, exist_ok=True)
            print(f"📁 Directorio: {dir_name}")
            
        # Crear archivos básicos si no existen
        basic_files = {
            "README.md": self.create_readme_content(),
            "requirements.txt": self.create_requirements_content(),
            "VERSION": f"{self.version}\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        }
        
        for filename, content in basic_files.items():
            if not os.path.exists(filename):
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"📄 Creado: {filename}")
            else:
                print(f"✅ Existe: {filename}")
                
    def create_readme_content(self):
        """Crear contenido del README"""
        return f"""# {self.app_name} v{self.version}

## Sistema Integral de Gestión Empresarial

### Descripción
Sistema completo de gestión desarrollado específicamente para empresas de construcción e ingeniería.

### Módulos Incluidos
- 🏠 Dashboard Principal
- 📊 Presupuestos y Cotizaciones  
- 🛒 Órdenes de Compra
- 💰 Remuneraciones
- 🚜 Rental de Maquinaria
- 🚛 Gestión Vehicular
- 💳 Cuentas por Pagar
- 📦 Stock e Inventario
- 📋 Gestión Documental
- 🔔 Sistema de Notificaciones
- ⚙️ Configuración Avanzada

### Instalación
1. Ejecute JURMAQ.exe
2. Siga las instrucciones en pantalla
3. Configure su empresa en el módulo de configuración

### Soporte Técnico
Desarrollado por: Jrgubival
Fecha: {datetime.now().strftime('%Y-%m-%d')}

© 2025 - Todos los derechos reservados
"""

    def create_requirements_content(self):
        """Crear contenido de requirements"""
        return """PyQt5>=5.15.0
cx_Freeze>=6.8
sqlite3
datetime
json
os
sys
hashlib
shutil
"""

    def build_executable(self):
        """Crear el ejecutable"""
        self.print_step(5, "CREANDO EJECUTABLE")
        
        print("🔨 Ejecutando cx_Freeze...")
        
        try:
            # Ejecutar setup.py para crear el ejecutable
            result = subprocess.run([
                sys.executable, "setup.py", "build"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print("✅ Ejecutable creado exitosamente")
                print(result.stdout)
            else:
                print("❌ Error creando ejecutable:")
                print(result.stderr)
                return False
                
        except Exception as e:
            print(f"❌ Error durante el build: {str(e)}")
            return False
            
        return True
        
    def post_build_tasks(self):
        """Tareas post-build"""
        self.print_step(6, "TAREAS POST-BUILD")
        
        # Encontrar el directorio de build
        build_subdir = None
        if os.path.exists(self.build_dir):
            for item in os.listdir(self.build_dir):
                if item.startswith("exe."):
                    build_subdir = os.path.join(self.build_dir, item)
                    break
                    
        if not build_subdir or not os.path.exists(build_subdir):
            print("❌ No se encontró el directorio de build")
            return False
            
        print(f"📁 Directorio de build: {build_subdir}")
        
        # Crear directorio de distribución
        os.makedirs(self.dist_dir, exist_ok=True)
        
        # Copiar archivos adicionales necesarios
        additional_files = [
            "data/jurmaq.db",
            "README.md",
            "VERSION"
        ]
        
        for file_path in additional_files:
            if os.path.exists(file_path):
                dest_path = os.path.join(build_subdir, os.path.basename(file_path))
                shutil.copy2(file_path, dest_path)
                print(f"📄 Copiado: {file_path}")
                
        # Crear base de datos vacía si no existe
        db_path = os.path.join(build_subdir, "jurmaq.db")
        if not os.path.exists(db_path):
            print("💾 Creando base de datos inicial...")
            self.create_initial_database(db_path)
            
        return True
        
    def create_initial_database(self, db_path):
        """Crear base de datos inicial"""
        try:
            import sqlite3
            
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Crear tabla de usuarios básica
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    nombre TEXT NOT NULL,
                    email TEXT,
                    tipo_usuario TEXT DEFAULT 'Administrador',
                    estado TEXT DEFAULT 'Activo',
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ultimo_acceso DATETIME
                )
            """)
            
            # Insertar usuario administrador por defecto
            cursor.execute("""
                INSERT OR IGNORE INTO usuarios (usuario, password, nombre, tipo_usuario)
                VALUES ('admin', 'admin123', 'Administrador', 'Administrador')
            """)
            
            conn.commit()
            conn.close()
            
            print("✅ Base de datos inicial creada")
            
        except Exception as e:
            print(f"❌ Error creando BD: {str(e)}")
            
    def create_installer_package(self):
        """Crear paquete de instalación"""
        self.print_step(7, "CREANDO PAQUETE DE INSTALACIÓN")
        
        # Encontrar directorio de build
        build_subdir = None
        if os.path.exists(self.build_dir):
            for item in os.listdir(self.build_dir):
                if item.startswith("exe."):
                    build_subdir = os.path.join(self.build_dir, item)
                    break
                    
        if not build_subdir:
            print("❌ No se encontró el build para empaquetar")
            return False
            
        # Crear ZIP de distribución
        zip_name = f"{self.app_name}_v{self.version}_{datetime.now().strftime('%Y%m%d')}.zip"
        zip_path = os.path.join(self.dist_dir, zip_name)
        
        print(f"📦 Creando paquete: {zip_name}")
        
        try:
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(build_subdir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arc_name = os.path.relpath(file_path, build_subdir)
                        zipf.write(file_path, arc_name)
                        
            print(f"✅ Paquete creado: {zip_path}")
            
            # Obtener tamaño del paquete
            size_mb = os.path.getsize(zip_path) / (1024 * 1024)
            print(f"📊 Tamaño del paquete: {size_mb:.1f} MB")
            
            return True
            
        except Exception as e:
            print(f"❌ Error creando paquete: {str(e)}")
            return False
            
    def generate_build_report(self):
        """Generar reporte del build"""
        self.print_step(8, "GENERANDO REPORTE DE BUILD")
        
        report_content = f"""
# REPORTE DE BUILD - {self.app_name} v{self.version}

## Información General
- **Aplicación:** {self.app_name}
- **Versión:** {self.version}  
- **Fecha de Build:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **Usuario:** Jrgubival
- **Plataforma:** {sys.platform}
- **Python:** {sys.version}

## Archivos Generados
"""
        
        # Listar archivos en dist
        if os.path.exists(self.dist_dir):
            report_content += "\n### Directorio de Distribución:\n"
            for item in os.listdir(self.dist_dir):
                item_path = os.path.join(self.dist_dir, item)
                if os.path.isfile(item_path):
                    size_mb = os.path.getsize(item_path) / (1024 * 1024)
                    report_content += f"- **{item}** ({size_mb:.1f} MB)\n"
                    
        # Listar archivos en build
        if os.path.exists(self.build_dir):
            for item in os.listdir(self.build_dir):
                if item.startswith("exe."):
                    build_path = os.path.join(self.build_dir, item)
                    report_content += f"\n### Directorio de Build: {item}\n"
                    
                    # Contar archivos
                    file_count = 0
                    total_size = 0
                    
                    for root, dirs, files in os.walk(build_path):
                        file_count += len(files)
                        for file in files:
                            file_path = os.path.join(root, file)
                            if os.path.exists(file_path):
                                total_size += os.path.getsize(file_path)
                                
                    total_size_mb = total_size / (1024 * 1024)
                    report_content += f"- **Total de archivos:** {file_count}\n"
                    report_content += f"- **Tamaño total:** {total_size_mb:.1f} MB\n"
                    
        report_content += f"""
## Instrucciones de Instalación

1. **Extraer el paquete ZIP**
   - Descomprima {self.app_name}_v{self.version}_*.zip en una carpeta

2. **Ejecutar la aplicación**
   - Ejecute JURMAQ.exe desde la carpeta extraída

3. **Primera configuración**
   - Usuario: admin
   - Contraseña: admin123
   - Configure su empresa en el módulo de configuración

## Soporte Técnico
- **Desarrollador:** Jrgubival
- **Fecha de desarrollo:** Julio 2025
- **Tecnologías:** Python 3.7+, PyQt5, SQLite

---
© 2025 Jrgubival - Todos los derechos reservados
"""
        
        # Guardar reporte
        report_path = os.path.join(self.dist_dir, "BUILD_REPORT.md")
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
            
        print(f"📄 Reporte guardado: {report_path}")
        
    def build_all(self):
        """Proceso completo de build"""
        print(f"""
🏗️  INICIANDO BUILD DE {self.app_name} v{self.version}
{'='*60}
🕐 Inicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
👨‍💻 Usuario: Jrgubival
{'='*60}
        """)
        
        start_time = datetime.now()
        
        # Ejecutar pasos del build
        steps = [
            ("Verificar requerimientos", self.check_requirements),
            ("Preparar ícono", self.create_icon),
            ("Limpiar builds anteriores", self.clean_build),
            ("Preparar archivos", self.prepare_files),
            ("Crear ejecutable", self.build_executable),
            ("Tareas post-build", self.post_build_tasks),
            ("Crear paquete", self.create_installer_package),
            ("Generar reporte", self.generate_build_report)
        ]
        
        success_count = 0
        
        for step_name, step_func in steps:
            try:
                if step_func():
                    success_count += 1
                else:
                    print(f"❌ Falló: {step_name}")
                    break
            except Exception as e:
                print(f"❌ Error en {step_name}: {str(e)}")
                break
                
        end_time = datetime.now()
        duration = end_time - start_time
        
        print(f"""
{'='*60}
🏁 BUILD COMPLETADO
{'='*60}
✅ Pasos exitosos: {success_count}/{len(steps)}
⏱️ Duración: {duration}
🕐 Finalizado: {end_time.strftime('%Y-%m-%d %H:%M:%S')}
{'='*60}
        """)
        
        if success_count == len(steps):
            print("🎉 ¡BUILD EXITOSO! El ejecutable está listo.")
            print(f"📦 Busque el archivo en la carpeta '{self.dist_dir}'")
        else:
            print("❌ Build incompleto. Revise los errores arriba.")
            
        return success_count == len(steps)

def main():
    """Función principal"""
    builder = JURMAQBuilder()
    return builder.build_all()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)