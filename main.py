#!/usr/bin/env python3
"""
JURMAQ System - Constructora Jorge Ubilla Rivera E.I.R.L.
Main application entry point.
"""

import sys
import os
import logging
from datetime import datetime

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QTabWidget, QLabel, QLineEdit, 
                             QPushButton, QTableWidget, QTableWidgetItem,
                             QMessageBox, QDialog, QFormLayout, QTextEdit,
                             QComboBox, QDateEdit, QSpinBox, QDoubleSpinBox,
                             QFrame, QScrollArea, QGroupBox, QGridLayout,
                             QSplitter, QMenuBar, QStatusBar, QHeaderView)
from PyQt5.QtCore import Qt, QDate, QTimer, pyqtSignal
from PyQt5.QtGui import QFont, QPixmap, QIcon

from modules.login import login_manager
from modules.logs import LogManager
from modules.utils import COMPANY_INFO, format_currency
from modules.dashboard import DashboardWidget
from modules.ordenes_compra import OrdenesCompraWidget
from modules.presupuestos import PresupuestosWidget
from modules.vehiculos import VehiculosWidget
from modules.personal import PersonalWidget

class LoginDialog(QDialog):
    """Login dialog for user authentication."""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("JURMAQ - Iniciar Sesión")
        self.setFixedSize(400, 300)
        self.setModal(True)
        self.setup_ui()
        
    def setup_ui(self):
        layout = QVBoxLayout()
        
        # Logo area
        logo_frame = QFrame()
        logo_frame.setFrameStyle(QFrame.Box)
        logo_frame.setFixedHeight(100)
        logo_layout = QVBoxLayout(logo_frame)
        
        company_label = QLabel(COMPANY_INFO['name'])
        company_label.setAlignment(Qt.AlignCenter)
        company_label.setStyleSheet("font-weight: bold; font-size: 12px; color: #2c3e50;")
        logo_layout.addWidget(company_label)
        
        layout.addWidget(logo_frame)
        
        # Login form
        form_layout = QFormLayout()
        
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Ingrese su usuario")
        form_layout.addRow("Usuario:", self.username_input)
        
        self.password_input = QLineEdit()
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.setPlaceholderText("Ingrese su contraseña")
        form_layout.addRow("Contraseña:", self.password_input)
        
        layout.addLayout(form_layout)
        
        # Login button
        self.login_button = QPushButton("Iniciar Sesión")
        self.login_button.clicked.connect(self.authenticate)
        self.login_button.setStyleSheet("""
            QPushButton {
                background-color: #3498db;
                color: white;
                border: none;
                padding: 10px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #2980b9;
            }
        """)
        layout.addWidget(self.login_button)
        
        # Default credentials info
        info_label = QLabel("Usuarios por defecto:\nadmin/admin123, secretaria/secre123, operador/opera123")
        info_label.setStyleSheet("color: #7f8c8d; font-size: 10px;")
        info_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(info_label)
        
        # Connect Enter key to login
        self.password_input.returnPressed.connect(self.authenticate)
        
        self.setLayout(layout)
        
    def authenticate(self):
        username = self.username_input.text().strip()
        password = self.password_input.text()
        
        if not username or not password:
            QMessageBox.warning(self, "Error", "Por favor ingrese usuario y contraseña")
            return
            
        if login_manager.authenticate(username, password):
            self.accept()
        else:
            QMessageBox.critical(self, "Error de Autenticación", 
                               "Usuario o contraseña incorrectos")
            self.password_input.clear()
            self.username_input.setFocus()

class MainWindow(QMainWindow):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle(f"JURMAQ - {COMPANY_INFO['name']}")
        self.setGeometry(100, 100, 1200, 800)
        
        # Check authentication
        if not self.authenticate_user():
            sys.exit()
            
        self.setup_ui()
        self.setup_menu()
        self.setup_status_bar()
        
        # Auto-logout timer (8 hours)
        self.logout_timer = QTimer()
        self.logout_timer.timeout.connect(self.auto_logout)
        self.logout_timer.start(8 * 60 * 60 * 1000)  # 8 hours in milliseconds
        
    def authenticate_user(self):
        """Authenticate user before opening main window."""
        login_dialog = LoginDialog()
        return login_dialog.exec_() == QDialog.Accepted
        
    def setup_ui(self):
        """Setup main user interface."""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        layout = QVBoxLayout(central_widget)
        
        # Header
        header = self.create_header()
        layout.addWidget(header)
        
        # Main tab widget
        self.tab_widget = QTabWidget()
        self.tab_widget.setTabPosition(QTabWidget.North)
        
        # Add tabs
        self.add_tabs()
        
        layout.addWidget(self.tab_widget)
        
    def create_header(self):
        """Create application header."""
        header_frame = QFrame()
        header_frame.setFrameStyle(QFrame.Box)
        header_frame.setFixedHeight(80)
        header_frame.setStyleSheet("background-color: #ecf0f1; border: 1px solid #bdc3c7;")
        
        header_layout = QHBoxLayout(header_frame)
        
        # Company info
        company_info = QVBoxLayout()
        company_name = QLabel(COMPANY_INFO['name'])
        company_name.setStyleSheet("font-weight: bold; font-size: 16px; color: #2c3e50;")
        
        company_details = QLabel(f"RUT: {COMPANY_INFO['rut']} | {COMPANY_INFO['phone']}")
        company_details.setStyleSheet("color: #7f8c8d; font-size: 12px;")
        
        company_info.addWidget(company_name)
        company_info.addWidget(company_details)
        header_layout.addLayout(company_info)
        
        header_layout.addStretch()
        
        # User info
        user = login_manager.get_current_user()
        if user:
            user_info = QVBoxLayout()
            user_name = QLabel(f"Usuario: {user['full_name']}")
            user_name.setStyleSheet("font-weight: bold; color: #2c3e50;")
            
            user_role = QLabel(f"Rol: {user['role'].title()}")
            user_role.setStyleSheet("color: #7f8c8d;")
            
            user_info.addWidget(user_name)
            user_info.addWidget(user_role)
            header_layout.addLayout(user_info)
            
        return header_frame
        
    def add_tabs(self):
        """Add all application tabs."""
        user = login_manager.get_current_user()
        if not user:
            return
            
        # Dashboard - available to all users
        self.dashboard = DashboardWidget()
        self.tab_widget.addTab(self.dashboard, "📊 Dashboard")
        
        # Órdenes de Compra - available to admin and secretaria
        if login_manager.has_permission('secretaria'):
            self.ordenes_compra = OrdenesCompraWidget()
            self.tab_widget.addTab(self.ordenes_compra, "🛒 Órdenes de Compra")
        
        # Presupuestos - available to admin and secretaria
        if login_manager.has_permission('secretaria'):
            self.presupuestos = PresupuestosWidget()
            self.tab_widget.addTab(self.presupuestos, "💰 Presupuestos")
        
        # Vehículos - available to all users (read-only for operador)
        self.vehiculos = VehiculosWidget()
        self.tab_widget.addTab(self.vehiculos, "🚗 Vehículos")
        
        # Personal - available to admin and secretaria
        if login_manager.has_permission('secretaria'):
            self.personal = PersonalWidget()
            self.tab_widget.addTab(self.personal, "👥 Personal")
        
        # Logs - admin only
        if login_manager.has_permission('admin'):
            self.logs = self.create_logs_tab()
            self.tab_widget.addTab(self.logs, "📋 Logs")
            
    def create_logs_tab(self):
        """Create logs viewing tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Filter controls
        filter_frame = QFrame()
        filter_layout = QHBoxLayout(filter_frame)
        
        filter_layout.addWidget(QLabel("Usuario:"))
        user_filter = QComboBox()
        user_filter.addItems(["Todos", "admin", "secretaria", "operador"])
        filter_layout.addWidget(user_filter)
        
        filter_layout.addWidget(QLabel("Módulo:"))
        module_filter = QComboBox()
        module_filter.addItems(["Todos", "AUTH", "ORDENES_COMPRA", "PRESUPUESTOS", 
                               "VEHICULOS", "PERSONAL", "PDF"])
        filter_layout.addWidget(module_filter)
        
        refresh_button = QPushButton("Actualizar")
        filter_layout.addWidget(refresh_button)
        
        filter_layout.addStretch()
        layout.addWidget(filter_frame)
        
        # Logs table
        logs_table = QTableWidget()
        logs_table.setColumnCount(5)
        logs_table.setHorizontalHeaderLabels(["Fecha/Hora", "Usuario", "Acción", "Módulo", "Detalles"])
        logs_table.horizontalHeader().setStretchLastSection(True)
        
        layout.addWidget(logs_table)
        
        def refresh_logs():
            user_filter_text = user_filter.currentText()
            module_filter_text = module_filter.currentText()
            
            filters = {}
            if user_filter_text != "Todos":
                filters['user'] = user_filter_text
            if module_filter_text != "Todos":
                filters['module'] = module_filter_text
                
            logs = LogManager.get_logs(**filters)
            
            logs_table.setRowCount(len(logs))
            for row, (log_id, log_data) in enumerate(logs.items()):
                logs_table.setItem(row, 0, QTableWidgetItem(log_data.get('timestamp', '')))
                logs_table.setItem(row, 1, QTableWidgetItem(log_data.get('user', '')))
                logs_table.setItem(row, 2, QTableWidgetItem(log_data.get('action', '')))
                logs_table.setItem(row, 3, QTableWidgetItem(log_data.get('module', '')))
                logs_table.setItem(row, 4, QTableWidgetItem(str(log_data.get('details', ''))))
        
        refresh_button.clicked.connect(refresh_logs)
        refresh_logs()  # Initial load
        
        return widget
        
    def setup_menu(self):
        """Setup application menu bar."""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu('Archivo')
        
        logout_action = file_menu.addAction('Cerrar Sesión')
        logout_action.triggered.connect(self.logout)
        
        exit_action = file_menu.addAction('Salir')
        exit_action.triggered.connect(self.close)
        
        # Help menu
        help_menu = menubar.addMenu('Ayuda')
        
        about_action = help_menu.addAction('Acerca de')
        about_action.triggered.connect(self.show_about)
        
    def setup_status_bar(self):
        """Setup status bar."""
        status_bar = self.statusBar()
        
        user = login_manager.get_current_user()
        if user:
            status_bar.showMessage(f"Conectado como: {user['full_name']} ({user['role']})")
            
    def logout(self):
        """Logout current user."""
        reply = QMessageBox.question(self, 'Cerrar Sesión', 
                                   '¿Está seguro que desea cerrar la sesión?',
                                   QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            login_manager.logout()
            self.close()
            
    def auto_logout(self):
        """Auto logout after session timeout."""
        QMessageBox.information(self, 'Sesión Expirada', 
                              'Su sesión ha expirado. Debe iniciar sesión nuevamente.')
        login_manager.logout()
        self.close()
        
    def show_about(self):
        """Show about dialog."""
        QMessageBox.about(self, 'Acerca de JURMAQ', 
                         f"""
                         <h2>Sistema JURMAQ</h2>
                         <p><b>{COMPANY_INFO['name']}</b></p>
                         <p>RUT: {COMPANY_INFO['rut']}</p>
                         <p>Dirección: {COMPANY_INFO['address']}</p>
                         <p>Teléfono: {COMPANY_INFO['phone']}</p>
                         <p>Email: {COMPANY_INFO['email']}</p>
                         <hr>
                         <p>Sistema de gestión integral para constructora.</p>
                         <p>Versión 1.0.0</p>
                         """)
        
    def closeEvent(self, event):
        """Handle application close event."""
        reply = QMessageBox.question(self, 'Salir', 
                                   '¿Está seguro que desea salir del sistema?',
                                   QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            login_manager.logout()
            event.accept()
        else:
            event.ignore()

def main():
    """Main application entry point."""
    app = QApplication(sys.argv)
    app.setApplicationName("JURMAQ")
    app.setApplicationVersion("1.0.0")
    
    # Set application style
    app.setStyleSheet("""
        QMainWindow {
            background-color: #f8f9fa;
        }
        QTabWidget::pane {
            border: 1px solid #bdc3c7;
            background-color: white;
        }
        QTabBar::tab {
            background-color: #ecf0f1;
            border: 1px solid #bdc3c7;
            padding: 8px 16px;
            margin-right: 2px;
        }
        QTabBar::tab:selected {
            background-color: white;
            border-bottom: none;
        }
        QTableWidget {
            border: 1px solid #bdc3c7;
            gridline-color: #ecf0f1;
        }
        QTableWidget::item {
            padding: 5px;
        }
        QPushButton {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
        }
        QPushButton:hover {
            background-color: #2980b9;
        }
        QPushButton:pressed {
            background-color: #21618c;
        }
    """)
    
    try:
        window = MainWindow()
        window.show()
        sys.exit(app.exec_())
    except Exception as e:
        logging.error(f"Application error: {e}")
        QMessageBox.critical(None, "Error", f"Error al iniciar la aplicación: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()