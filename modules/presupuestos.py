from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QTableWidget, QTableWidgetItem, QPushButton,
                             QDialog, QFormLayout, QLineEdit, QComboBox,
                             QDateEdit, QDoubleSpinBox, QTextEdit, QMessageBox,
                             QFrame, QTabWidget, QSpinBox, QHeaderView, QAbstractItemView)
from PyQt5.QtCore import Qt, QDate
from PyQt5.QtGui import QFont
from datetime import datetime

from .utils import db, generate_id, format_currency
from .logs import LogManager
from .login import login_manager

class PresupuestosWidget(QWidget):
    """Widget for managing budgets/quotes."""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.load_data()
        
    def setup_ui(self):
        """Setup user interface."""
        layout = QVBoxLayout(self)
        
        # Header
        header_frame = QFrame()
        header_layout = QHBoxLayout(header_frame)
        
        title_label = QLabel("Gestión de Presupuestos")
        title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Action buttons
        self.new_btn = QPushButton("Nuevo Presupuesto")
        self.new_btn.clicked.connect(self.new_budget)
        header_layout.addWidget(self.new_btn)
        
        self.edit_btn = QPushButton("Editar")
        self.edit_btn.clicked.connect(self.edit_budget)
        self.edit_btn.setEnabled(False)
        header_layout.addWidget(self.edit_btn)
        
        self.delete_btn = QPushButton("Eliminar")
        self.delete_btn.clicked.connect(self.delete_budget)
        self.delete_btn.setEnabled(False)
        self.delete_btn.setStyleSheet("background-color: #e74c3c;")
        header_layout.addWidget(self.delete_btn)
        
        self.pdf_btn = QPushButton("Generar PDF")
        self.pdf_btn.clicked.connect(self.generate_pdf)
        self.pdf_btn.setEnabled(False)
        self.pdf_btn.setStyleSheet("background-color: #27ae60;")
        header_layout.addWidget(self.pdf_btn)
        
        layout.addWidget(header_frame)
        
        # Filters
        filter_frame = QFrame()
        filter_layout = QHBoxLayout(filter_frame)
        
        filter_layout.addWidget(QLabel("Estado:"))
        self.status_filter = QComboBox()
        self.status_filter.addItems(["Todos", "Borrador", "Enviado", "Aprobado", "Rechazado"])
        self.status_filter.currentTextChanged.connect(self.apply_filters)
        filter_layout.addWidget(self.status_filter)
        
        filter_layout.addStretch()
        
        layout.addWidget(filter_frame)
        
        # Budgets table
        self.budgets_table = QTableWidget()
        self.budgets_table.setColumnCount(7)
        self.budgets_table.setHorizontalHeaderLabels([
            "ID", "Fecha", "Cliente", "Total", "Estado", "Vigencia", "Creado por"
        ])
        
        # Configure table
        header = self.budgets_table.horizontalHeader()
        header.setStretchLastSection(True)
        self.budgets_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.budgets_table.setAlternatingRowColors(True)
        
        # Connect selection
        self.budgets_table.itemSelectionChanged.connect(self.on_selection_changed)
        
        layout.addWidget(self.budgets_table)
        
    def load_data(self):
        """Load budgets data."""
        budgets = db.get_all_records('presupuestos')
        self.populate_table(budgets)
        
    def populate_table(self, budgets):
        """Populate the budgets table."""
        self.budgets_table.setRowCount(len(budgets))
        
        for row, (budget_id, budget_data) in enumerate(budgets.items()):
            self.budgets_table.setItem(row, 0, QTableWidgetItem(budget_id))
            self.budgets_table.setItem(row, 1, QTableWidgetItem(budget_data.get('fecha', '')))
            self.budgets_table.setItem(row, 2, QTableWidgetItem(budget_data.get('cliente', '')))
            self.budgets_table.setItem(row, 3, QTableWidgetItem(format_currency(budget_data.get('total', 0))))
            self.budgets_table.setItem(row, 4, QTableWidgetItem(budget_data.get('estado', 'Borrador')))
            
            vigencia = budget_data.get('vigencia', 30)
            self.budgets_table.setItem(row, 5, QTableWidgetItem(f"{vigencia} días"))
            self.budgets_table.setItem(row, 6, QTableWidgetItem(budget_data.get('creado_por', '')))
            
    def apply_filters(self):
        """Apply filters to the table."""
        status_filter = self.status_filter.currentText()
        
        budgets = db.get_all_records('presupuestos')
        filtered_budgets = {}
        
        for budget_id, budget_data in budgets.items():
            if status_filter != "Todos":
                if budget_data.get('estado', 'Borrador').lower() != status_filter.lower():
                    continue
                    
            filtered_budgets[budget_id] = budget_data
            
        self.populate_table(filtered_budgets)
        
    def on_selection_changed(self):
        """Handle selection change."""
        has_selection = len(self.budgets_table.selectedItems()) > 0
        self.edit_btn.setEnabled(has_selection)
        self.delete_btn.setEnabled(has_selection)
        self.pdf_btn.setEnabled(has_selection)
        
    def get_selected_budget_id(self):
        """Get selected budget ID."""
        current_row = self.budgets_table.currentRow()
        if current_row >= 0:
            return self.budgets_table.item(current_row, 0).text()
        return None
        
    def new_budget(self):
        """Create new budget."""
        dialog = BudgetDialog()
        if dialog.exec_() == QDialog.Accepted:
            self.load_data()
            
    def edit_budget(self):
        """Edit selected budget."""
        budget_id = self.get_selected_budget_id()
        if budget_id:
            budget_data = db.get_record('presupuestos', budget_id)
            if budget_data:
                dialog = BudgetDialog(budget_data=budget_data, budget_id=budget_id)
                if dialog.exec_() == QDialog.Accepted:
                    self.load_data()
                    
    def delete_budget(self):
        """Delete selected budget."""
        budget_id = self.get_selected_budget_id()
        if budget_id:
            reply = QMessageBox.question(
                self, 'Confirmar Eliminación',
                f'¿Está seguro que desea eliminar el presupuesto {budget_id}?',
                QMessageBox.Yes | QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                db.delete_record('presupuestos', budget_id)
                
                user = login_manager.get_current_user()
                LogManager.log_delete(user['username'], 'PRESUPUESTOS', 'PRESUPUESTO', budget_id)
                
                QMessageBox.information(self, 'Éxito', 'Presupuesto eliminado correctamente')
                self.load_data()
                
    def generate_pdf(self):
        """Generate PDF for selected budget."""
        budget_id = self.get_selected_budget_id()
        if budget_id:
            budget_data = db.get_record('presupuestos', budget_id)
            if budget_data:
                try:
                    from .pdf_generator import generate_budget_pdf
                    pdf_path = generate_budget_pdf(budget_id, budget_data)
                    
                    user = login_manager.get_current_user()
                    LogManager.log_pdf_generation(user['username'], 'PRESUPUESTO', budget_id)
                    
                    QMessageBox.information(self, 'PDF Generado', 
                                          f'PDF generado correctamente en: {pdf_path}')
                except Exception as e:
                    QMessageBox.critical(self, 'Error', f'Error al generar PDF: {str(e)}')

class BudgetDialog(QDialog):
    """Dialog for creating/editing budgets."""
    
    def __init__(self, budget_data=None, budget_id=None):
        super().__init__()
        self.budget_data = budget_data
        self.budget_id = budget_id
        self.is_edit_mode = budget_data is not None
        
        title = "Editar Presupuesto" if self.is_edit_mode else "Nuevo Presupuesto"
        self.setWindowTitle(title)
        self.setModal(True)
        self.resize(700, 600)
        self.setup_ui()
        
        if self.is_edit_mode:
            self.load_budget_data()
            
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QVBoxLayout(self)
        
        # Tab widget
        tab_widget = QTabWidget()
        
        # Client information tab
        client_tab = QWidget()
        client_layout = QFormLayout(client_tab)
        
        self.client_name_edit = QLineEdit()
        client_layout.addRow("Cliente:", self.client_name_edit)
        
        self.client_rut_edit = QLineEdit()
        client_layout.addRow("RUT Cliente:", self.client_rut_edit)
        
        self.contact_edit = QLineEdit()
        client_layout.addRow("Contacto:", self.contact_edit)
        
        self.phone_edit = QLineEdit()
        client_layout.addRow("Teléfono:", self.phone_edit)
        
        self.email_edit = QLineEdit()
        client_layout.addRow("Email:", self.email_edit)
        
        self.date_edit = QDateEdit()
        self.date_edit.setDate(QDate.currentDate())
        self.date_edit.setCalendarPopup(True)
        client_layout.addRow("Fecha:", self.date_edit)
        
        self.validity_spin = QSpinBox()
        self.validity_spin.setRange(1, 365)
        self.validity_spin.setValue(30)
        self.validity_spin.setSuffix(" días")
        client_layout.addRow("Vigencia:", self.validity_spin)
        
        self.status_combo = QComboBox()
        self.status_combo.addItems(["Borrador", "Enviado", "Aprobado", "Rechazado"])
        client_layout.addRow("Estado:", self.status_combo)
        
        tab_widget.addTab(client_tab, "Información del Cliente")
        
        # Items tab
        items_tab = QWidget()
        items_layout = QVBoxLayout(items_tab)
        
        # Items table
        self.items_table = QTableWidget()
        self.items_table.setColumnCount(4)
        self.items_table.setHorizontalHeaderLabels(["Descripción", "Cantidad", "Precio Unit.", "Total"])
        items_layout.addWidget(self.items_table)
        
        # Add item button
        add_item_btn = QPushButton("Agregar Item")
        add_item_btn.clicked.connect(self.add_item)
        items_layout.addWidget(add_item_btn)
        
        tab_widget.addTab(items_tab, "Items del Presupuesto")
        
        # Observations tab
        obs_tab = QWidget()
        obs_layout = QVBoxLayout(obs_tab)
        
        self.observations_edit = QTextEdit()
        self.observations_edit.setPlaceholderText("Observaciones adicionales, términos y condiciones específicos...")
        obs_layout.addWidget(self.observations_edit)
        
        tab_widget.addTab(obs_tab, "Observaciones")
        
        layout.addWidget(tab_widget)
        
        # Total
        total_frame = QFrame()
        total_layout = QHBoxLayout(total_frame)
        total_layout.addStretch()
        
        total_layout.addWidget(QLabel("Total:"))
        self.total_label = QLabel("$0")
        self.total_label.setStyleSheet("font-size: 16px; font-weight: bold; color: #e74c3c;")
        total_layout.addWidget(self.total_label)
        
        layout.addWidget(total_frame)
        
        # Buttons
        button_frame = QFrame()
        button_layout = QHBoxLayout(button_frame)
        
        button_layout.addStretch()
        
        cancel_btn = QPushButton("Cancelar")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        save_btn = QPushButton("Guardar")
        save_btn.clicked.connect(self.save_budget)
        save_btn.setStyleSheet("background-color: #27ae60;")
        button_layout.addWidget(save_btn)
        
        layout.addWidget(button_frame)
        
        # Initialize with empty item
        self.add_item()
        
    def add_item(self):
        """Add new item row."""
        row = self.items_table.rowCount()
        self.items_table.insertRow(row)
        
        # Description
        desc_item = QTableWidgetItem("")
        self.items_table.setItem(row, 0, desc_item)
        
        # Quantity
        qty_item = QTableWidgetItem("1")
        self.items_table.setItem(row, 1, qty_item)
        
        # Unit price
        price_item = QTableWidgetItem("0")
        self.items_table.setItem(row, 2, price_item)
        
        # Total (calculated)
        total_item = QTableWidgetItem("0")
        total_item.setFlags(total_item.flags() & ~Qt.ItemIsEditable)
        self.items_table.setItem(row, 3, total_item)
        
        # Connect signals for automatic calculation
        self.items_table.itemChanged.connect(self.calculate_totals)
        
    def calculate_totals(self):
        """Calculate item and budget totals."""
        total = 0
        
        for row in range(self.items_table.rowCount()):
            qty_item = self.items_table.item(row, 1)
            price_item = self.items_table.item(row, 2)
            total_item = self.items_table.item(row, 3)
            
            if qty_item and price_item and total_item:
                try:
                    qty = float(qty_item.text() or 0)
                    price = float(price_item.text() or 0)
                    item_total = qty * price
                    
                    total_item.setText(str(item_total))
                    total += item_total
                except ValueError:
                    pass
                    
        self.total_label.setText(format_currency(total))
        
    def load_budget_data(self):
        """Load budget data for editing."""
        if not self.budget_data:
            return
            
        self.client_name_edit.setText(self.budget_data.get('cliente', ''))
        self.client_rut_edit.setText(self.budget_data.get('cliente_rut', ''))
        self.contact_edit.setText(self.budget_data.get('contacto', ''))
        self.phone_edit.setText(self.budget_data.get('telefono', ''))
        self.email_edit.setText(self.budget_data.get('email', ''))
        
        # Date
        date_str = self.budget_data.get('fecha', '')
        if date_str:
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                self.date_edit.setDate(QDate(date_obj))
            except ValueError:
                pass
                
        self.validity_spin.setValue(self.budget_data.get('vigencia', 30))
        self.status_combo.setCurrentText(self.budget_data.get('estado', 'Borrador'))
        self.observations_edit.setPlainText(self.budget_data.get('observaciones', ''))
        
        # Load items
        items = self.budget_data.get('items', [])
        for item in items:
            self.add_item()
            row = self.items_table.rowCount() - 1
            
            self.items_table.setItem(row, 0, QTableWidgetItem(item.get('descripcion', '')))
            self.items_table.setItem(row, 1, QTableWidgetItem(str(item.get('cantidad', 1))))
            self.items_table.setItem(row, 2, QTableWidgetItem(str(item.get('precio_unitario', 0))))
            
        self.calculate_totals()
        
    def save_budget(self):
        """Save budget data."""
        if not self.validate_form():
            return
            
        budget_data = {
            'cliente': self.client_name_edit.text(),
            'cliente_rut': self.client_rut_edit.text(),
            'contacto': self.contact_edit.text(),
            'telefono': self.phone_edit.text(),
            'email': self.email_edit.text(),
            'fecha': self.date_edit.date().toString('yyyy-MM-dd'),
            'vigencia': self.validity_spin.value(),
            'estado': self.status_combo.currentText().lower(),
            'observaciones': self.observations_edit.toPlainText()
        }
        
        user = login_manager.get_current_user()
        budget_data['creado_por'] = user['username'] if user else 'unknown'
        
        # Save items
        items = []
        total = 0
        
        for row in range(self.items_table.rowCount()):
            desc_item = self.items_table.item(row, 0)
            qty_item = self.items_table.item(row, 1)
            price_item = self.items_table.item(row, 2)
            
            if desc_item and desc_item.text().strip():
                item = {
                    'descripcion': desc_item.text(),
                    'cantidad': float(qty_item.text() or 0),
                    'precio_unitario': float(price_item.text() or 0)
                }
                item['subtotal'] = item['cantidad'] * item['precio_unitario']
                items.append(item)
                total += item['subtotal']
                
        budget_data['items'] = items
        budget_data['total'] = total
        
        if self.is_edit_mode:
            db.update_record('presupuestos', self.budget_id, budget_data)
            LogManager.log_update(user['username'], 'PRESUPUESTOS', 'PRESUPUESTO', self.budget_id, budget_data)
        else:
            budget_id = generate_id('PPTO')
            db.add_record('presupuestos', budget_id, budget_data)
            LogManager.log_create(user['username'], 'PRESUPUESTOS', 'PRESUPUESTO', budget_id, budget_data)
            
        self.accept()
        
    def validate_form(self):
        """Validate form data."""
        if not self.client_name_edit.text().strip():
            QMessageBox.warning(self, 'Error de Validación', 'El nombre del cliente es obligatorio')
            return False
            
        # Validate items
        has_items = False
        for row in range(self.items_table.rowCount()):
            desc_item = self.items_table.item(row, 0)
            if desc_item and desc_item.text().strip():
                has_items = True
                break
                
        if not has_items:
            QMessageBox.warning(self, 'Error de Validación', 'Debe agregar al menos un item')
            return False
            
        return True