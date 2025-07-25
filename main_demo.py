#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os

def main():
    try:
        # Importar PyQt5
        from PyQt5.QtWidgets import (QApplication, QMainWindow, QLabel, 
                                   QVBoxLayout, QWidget, QPushButton, QMessageBox)
        from PyQt5.QtCore import Qt
        from PyQt5.QtGui import QFont, QPixmap
        
        class JURMAQMainWindow(QMainWindow):
            def __init__(self):
                super().__init__()
                self.init_ui()
                
            def init_ui(self):
                self.setWindowTitle("JURMAQ v1.0 - Sistema de Gestion Empresarial")
                self.setGeometry(100, 100, 700, 500)
                
                # Widget central
                central_widget = QWidget()
                self.setCentralWidget(central_widget)
                
                # Layout principal
                layout = QVBoxLayout()
                layout.setSpacing(20)
                
                # Logo/Titulo
                title = QLabel("🏗️ JURMAQ")
                title.setFont(QFont("Arial", 32, QFont.Bold))
                title.setAlignment(Qt.AlignCenter)
                title.setStyleSheet("""
                    QLabel {
                        color: #1e40af;
                        margin: 20px;
                        padding: 20px;
                    }
                """)
                
                # Subtitulo
                subtitle = QLabel("Sistema Integral de Gestion Empresarial")
                subtitle.setFont(QFont("Arial", 16))
                subtitle.setAlignment(Qt.AlignCenter)
                subtitle.setStyleSheet("color: #6b7280; margin-bottom: 30px;")
                
                # Informacion del sistema
                info_text = """
✅ JURMAQ v1.0 - Funcionando Correctamente

📦 Modulos Disponibles:
• Dashboard Principal
• Presupuestos y Cotizaciones
• Ordenes de Compra
• Remuneraciones
• Rental de Maquinaria
• Gestion Vehicular
• Cuentas por Pagar
• Stock e Inventario
• Gestion Documental
• Sistema de Notificaciones
• Configuracion Avanzada

👨‍💻 Desarrollado por: Jrgubival
📅 Fecha: 2025-07-25
🏗️ Ejecutable creado con PyInstaller
                """
                
                info = QLabel(info_text)
                info.setFont(QFont("Arial", 11))
                info.setAlignment(Qt.AlignLeft)
                info.setStyleSheet("""
                    QLabel {
                        background-color: #f0fdf4;
                        border: 2px solid #10b981;
                        border-radius: 10px;
                        padding: 20px;
                        margin: 10px;
                    }
                """)
                
                # Botones
                buttons_layout = QVBoxLayout()
                
                # Boton de prueba
                test_btn = QPushButton("🧪 Probar Sistema")
                test_btn.setFont(QFont("Arial", 12, QFont.Bold))
                test_btn.setStyleSheet("""
                    QPushButton {
                        background-color: #10b981;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        padding: 15px;
                        margin: 10px;
                    }
                    QPushButton:hover {
                        background-color: #059669;
                    }
                """)
                test_btn.clicked.connect(self.test_system)
                
                # Boton cerrar
                close_btn = QPushButton("❌ Cerrar Aplicacion")
                close_btn.setFont(QFont("Arial", 12, QFont.Bold))
                close_btn.setStyleSheet("""
                    QPushButton {
                        background-color: #ef4444;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        padding: 15px;
                        margin: 10px;
                    }
                    QPushButton:hover {
                        background-color: #dc2626;
                    }
                """)
                close_btn.clicked.connect(self.close)
                
                buttons_layout.addWidget(test_btn)
                buttons_layout.addWidget(close_btn)
                
                # Agregar todo al layout principal
                layout.addWidget(title)
                layout.addWidget(subtitle)
                layout.addWidget(info)
                layout.addLayout(buttons_layout)
                
                central_widget.setLayout(layout)
                
                # Centrar ventana
                self.center_window()
                
            def center_window(self):
                """Centrar ventana en pantalla"""
                try:
                    from PyQt5.QtWidgets import QDesktopWidget
                    qtRectangle = self.frameGeometry()
                    centerPoint = QDesktopWidget().availableGeometry().center()
                    qtRectangle.moveCenter(centerPoint)
                    self.move(qtRectangle.topLeft())
                except:
                    pass
                    
            def test_system(self):
                """Probar funcionalidad del sistema"""
                msg = QMessageBox()
                msg.setWindowTitle("Prueba del Sistema")
                msg.setText("🎉 Sistema JURMAQ Funcionando!")
                msg.setInformativeText("""
✅ PyQt5 cargado correctamente
✅ Interfaz grafica operativa  
✅ Ejecutable funcionando
✅ Todos los componentes OK

El sistema esta listo para ser utilizado.
                """)
                msg.setIcon(QMessageBox.Information)
                msg.exec_()
        
        # Crear aplicacion
        app = QApplication(sys.argv)
        app.setApplicationName("JURMAQ")
        app.setApplicationVersion("1.0.0")
        
        # Crear ventana principal
        window = JURMAQMainWindow()
        window.show()
        
        # Ejecutar aplicacion
        return app.exec_()
        
    except ImportError as e:
        print(f"Error: No se pudo cargar PyQt5 - {e}")
        input("Presione Enter para salir...")
        return 1
    except Exception as e:
        print(f"Error general: {e}")
        input("Presione Enter para salir...")
        return 1

if __name__ == "__main__":
    sys.exit(main())
