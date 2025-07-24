from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QTableWidget, QTableWidgetItem, QPushButton,
                             QDialog, QFormLayout, QLineEdit, QComboBox,
                             QDateEdit, QDoubleSpinBox, QTextEdit, QMessageBox,
                             QFrame, QGroupBox, QTabWidget, QSpinBox,
                             QHeaderView, QAbstractItemView)
from PyQt5.QtCore import Qt, QDate, pyqtSignal
from PyQt5.QtGui import QFont
from datetime import datetime
import os

from .utils import db, generate_id, format_currency, COMPANY_INFO, FUEL_SUPPLIER
from .logs import LogManager
from .login import login_manager

class OrdenesCompraWidget(QWidget):
    """Widget for managing purchase orders."""
    
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
        
        title_label = QLabel("Gestión de Órdenes de Compra")
        title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #2c3e50;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # Action buttons
        self.new_order_btn = QPushButton("Nueva Orden")
        self.new_order_btn.clicked.connect(self.new_order)
        header_layout.addWidget(self.new_order_btn)
        
        self.new_fuel_btn = QPushButton("Orden Combustible")
        self.new_fuel_btn.clicked.connect(self.new_fuel_order)
        self.new_fuel_btn.setStyleSheet("background-color: #e67e22;")
        header_layout.addWidget(self.new_fuel_btn)
        
        self.edit_btn = QPushButton("Editar")
        self.edit_btn.clicked.connect(self.edit_order)
        self.edit_btn.setEnabled(False)
        header_layout.addWidget(self.edit_btn)
        
        self.delete_btn = QPushButton("Eliminar")
        self.delete_btn.clicked.connect(self.delete_order)
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
        
        filter_layout.addWidget(QLabel("Filtrar por:"))
        
        self.type_filter = QComboBox()
        self.type_filter.addItems(["Todos", "Normal", "Combustible"])
        self.type_filter.currentTextChanged.connect(self.apply_filters)
        filter_layout.addWidget(self.type_filter)
        
        self.status_filter = QComboBox()
        self.status_filter.addItems(["Todos", "Pendiente", "Aprobada", "Entregada", "Cancelada"])
        self.status_filter.currentTextChanged.connect(self.apply_filters)
        filter_layout.addWidget(self.status_filter)
        
        filter_layout.addStretch()
        
        layout.addWidget(filter_frame)
        
        # Orders table
        self.orders_table = QTableWidget()
        self.orders_table.setColumnCount(8)
        self.orders_table.setHorizontalHeaderLabels([
            "ID", "Fecha", "Tipo", "Proveedor", "Total", "Estado", "Vehículo", "Creado por"
        ])
        
        # Configure table
        header = self.orders_table.horizontalHeader()
        header.setStretchLastSection(True)
        self.orders_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.orders_table.setAlternatingRowColors(True)
        
        # Connect selection
        self.orders_table.itemSelectionChanged.connect(self.on_selection_changed)
        
        layout.addWidget(self.orders_table)
        
    def load_data(self):
        """Load purchase orders data."""
        orders = db.get_all_records('ordenes_compra')
        self.populate_table(orders)
        
    def populate_table(self, orders):
        """Populate the orders table."""
        self.orders_table.setRowCount(len(orders))
        
        for row, (order_id, order_data) in enumerate(orders.items()):
            self.orders_table.setItem(row, 0, QTableWidgetItem(order_id))
            self.orders_table.setItem(row, 1, QTableWidgetItem(order_data.get('fecha', '')))
            self.orders_table.setItem(row, 2, QTableWidgetItem(order_data.get('tipo', 'Normal')))
            self.orders_table.setItem(row, 3, QTableWidgetItem(order_data.get('proveedor', '')))
            self.orders_table.setItem(row, 4, QTableWidgetItem(format_currency(order_data.get('total', 0))))
            self.orders_table.setItem(row, 5, QTableWidgetItem(order_data.get('estado', 'Pendiente')))
            self.orders_table.setItem(row, 6, QTableWidgetItem(order_data.get('vehiculo', 'N/A')))
            self.orders_table.setItem(row, 7, QTableWidgetItem(order_data.get('creado_por', '')))
            
    def apply_filters(self):
        """Apply filters to the table."""
        type_filter = self.type_filter.currentText()
        status_filter = self.status_filter.currentText()
        
        orders = db.get_all_records('ordenes_compra')
        filtered_orders = {}
        
        for order_id, order_data in orders.items():
            # Type filter
            if type_filter != "Todos":
                if type_filter == "Normal" and order_data.get('tipo') == 'combustible':
                    continue
                elif type_filter == "Combustible" and order_data.get('tipo') != 'combustible':
                    continue
                    
            # Status filter
            if status_filter != "Todos":
                if order_data.get('estado', 'Pendiente').lower() != status_filter.lower():
                    continue
                    
            filtered_orders[order_id] = order_data
            
        self.populate_table(filtered_orders)
        
    def on_selection_changed(self):
        """Handle selection change."""
        has_selection = len(self.orders_table.selectedItems()) > 0
        self.edit_btn.setEnabled(has_selection)
        self.delete_btn.setEnabled(has_selection)
        self.pdf_btn.setEnabled(has_selection)
        
    def get_selected_order_id(self):
        """Get selected order ID."""
        current_row = self.orders_table.currentRow()
        if current_row >= 0:
            return self.orders_table.item(current_row, 0).text()
        return None
        
    def new_order(self):
        """Create new normal purchase order."""
        dialog = OrderDialog(order_type="normal")
        if dialog.exec_() == QDialog.Accepted:
            self.load_data()
            
    def new_fuel_order(self):
        """Create new fuel purchase order."""
        dialog = OrderDialog(order_type="combustible")
        if dialog.exec_() == QDialog.Accepted:
            self.load_data()
            
    def edit_order(self):
        """Edit selected order."""
        order_id = self.get_selected_order_id()
        if order_id:
            order_data = db.get_record('ordenes_compra', order_id)
            if order_data:
                dialog = OrderDialog(order_data=order_data, order_id=order_id)
                if dialog.exec_() == QDialog.Accepted:
                    self.load_data()
                    
    def delete_order(self):
        """Delete selected order."""
        order_id = self.get_selected_order_id()
        if order_id:
            reply = QMessageBox.question(
                self, 'Confirmar Eliminación',
                f'¿Está seguro que desea eliminar la orden {order_id}?',
                QMessageBox.Yes | QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                db.delete_record('ordenes_compra', order_id)
                
                user = login_manager.get_current_user()
                LogManager.log_delete(user['username'], 'ORDENES_COMPRA', 'ORDEN', order_id)
                
                QMessageBox.information(self, 'Éxito', 'Orden eliminada correctamente')
                self.load_data()
                
    def generate_pdf(self):
        """Generate PDF for selected order."""
        order_id = self.get_selected_order_id()
        if order_id:
            order_data = db.get_record('ordenes_compra', order_id)
            if order_data:
                try:
                    from .pdf_generator import generate_order_pdf
                    pdf_path = generate_order_pdf(order_id, order_data)
                    
                    user = login_manager.get_current_user()
                    LogManager.log_pdf_generation(user['username'], 'ORDEN_COMPRA', order_id)
                    
                    QMessageBox.information(self, 'PDF Generado', 
                                          f'PDF generado correctamente en: {pdf_path}')
                except Exception as e:
                    QMessageBox.critical(self, 'Error', f'Error al generar PDF: {str(e)}')

class OrderDialog(QDialog):
    """Dialog for creating/editing purchase orders."""
    
    def __init__(self, order_type="normal", order_data=None, order_id=None):
        super().__init__()
        self.order_type = order_type
        self.order_data = order_data
        self.order_id = order_id
        self.is_edit_mode = order_data is not None
        
        title = "Editar Orden" if self.is_edit_mode else "Nueva Orden de Compra"
        if order_type == "combustible":
            title += " (Combustible)"
            
        self.setWindowTitle(title)
        self.setModal(True)
        self.resize(600, 500)
        self.setup_ui()
        
        if self.is_edit_mode:
            self.load_order_data()
            
    def setup_ui(self):
        """Setup dialog user interface."""
        layout = QVBoxLayout(self)
        
        # Tab widget for organized form
        tab_widget = QTabWidget()
        
        # General information tab
        general_tab = QWidget()
        general_layout = QFormLayout(general_tab)
        
        # Supplier
        self.supplier_edit = QLineEdit()
        if self.order_type == "combustible":
            self.supplier_edit.setText(FUEL_SUPPLIER['name'])
            self.supplier_edit.setReadOnly(True)
        general_layout.addRow("Proveedor:", self.supplier_edit)
        
        # Supplier RUT
        self.supplier_rut_edit = QLineEdit()
        if self.order_type == "combustible":
            self.supplier_rut_edit.setText(FUEL_SUPPLIER['rut'])
            self.supplier_rut_edit.setReadOnly(True)
        general_layout.addRow("RUT Proveedor:", self.supplier_rut_edit)
        
        # Date
        self.date_edit = QDateEdit()
        self.date_edit.setDate(QDate.currentDate())
        self.date_edit.setCalendarPopup(True)
        general_layout.addRow("Fecha:", self.date_edit)
        
        # Status
        self.status_combo = QComboBox()
        self.status_combo.addItems(["Pendiente", "Aprobada", "Entregada", "Cancelada"])
        general_layout.addRow("Estado:", self.status_combo)
        
        # Vehicle (for fuel orders)
        if self.order_type == "combustible":
            self.vehicle_combo = QComboBox()
            self.load_vehicles()
            general_layout.addRow("Vehículo:", self.vehicle_combo)
            
            # Fuel amount
            self.fuel_amount_spin = QDoubleSpinBox()
            self.fuel_amount_spin.setRange(0, 9999999)
            self.fuel_amount_spin.setDecimals(0)
            self.fuel_amount_spin.setSuffix(" pesos")
            general_layout.addRow("Monto Combustible:", self.fuel_amount_spin)
            
        # Description
        self.description_edit = QTextEdit()
        self.description_edit.setMaximumHeight(100)
        general_layout.addRow("Descripción:", self.description_edit)
        
        tab_widget.addTab(general_tab, "Información General")
        
        # Items tab (for normal orders)
        if self.order_type == "normal":
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
            
            tab_widget.addTab(items_tab, "Items")
            
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
        save_btn.clicked.connect(self.save_order)
        save_btn.setStyleSheet("background-color: #27ae60;")
        button_layout.addWidget(save_btn)
        
        layout.addWidget(button_frame)
        
        # Initialize with empty item for normal orders
        if self.order_type == "normal":
            self.add_item()
            
    def load_vehicles(self):
        """Load vehicles for fuel orders."""
        vehicles = db.get_all_records('vehiculos')
        self.vehicle_combo.addItem("Seleccionar vehículo...", "")
        
        for vehicle_id, vehicle_data in vehicles.items():
            if vehicle_data.get('activo', True):
                display_text = f"{vehicle_data.get('patente', '')} - {vehicle_data.get('marca', '')} {vehicle_data.get('modelo', '')}"
                self.vehicle_combo.addItem(display_text, vehicle_id)
                
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
        """Calculate item and order totals."""
        order_total = 0
        
        if self.order_type == "normal":
            for row in range(self.items_table.rowCount()):
                qty_item = self.items_table.item(row, 1)
                price_item = self.items_table.item(row, 2)
                total_item = self.items_table.item(row, 3)
                
                if qty_item and price_item and total_item:
                    try:
                        qty = float(qty_item.text() or 0)
                        price = float(price_item.text() or 0)
                        total = qty * price
                        
                        total_item.setText(str(total))
                        order_total += total
                    except ValueError:
                        pass
        else:
            # Fuel order
            order_total = self.fuel_amount_spin.value()
            
        self.total_label.setText(format_currency(order_total))
        
    def load_order_data(self):
        """Load order data for editing."""
        if not self.order_data:
            return
            
        self.supplier_edit.setText(self.order_data.get('proveedor', ''))
        self.supplier_rut_edit.setText(self.order_data.get('proveedor_rut', ''))
        
        # Date
        date_str = self.order_data.get('fecha', '')
        if date_str:
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                self.date_edit.setDate(QDate(date_obj))
            except ValueError:
                pass
                
        self.status_combo.setCurrentText(self.order_data.get('estado', 'Pendiente'))
        self.description_edit.setPlainText(self.order_data.get('descripcion', ''))
        
        if self.order_type == "combustible":
            vehicle_id = self.order_data.get('vehiculo_id', '')
            for i in range(self.vehicle_combo.count()):
                if self.vehicle_combo.itemData(i) == vehicle_id:
                    self.vehicle_combo.setCurrentIndex(i)
                    break
                    
            self.fuel_amount_spin.setValue(self.order_data.get('monto_combustible', 0))
        else:
            # Load items
            items = self.order_data.get('items', [])
            for item in items:
                self.add_item()
                row = self.items_table.rowCount() - 1
                
                self.items_table.setItem(row, 0, QTableWidgetItem(item.get('descripcion', '')))
                self.items_table.setItem(row, 1, QTableWidgetItem(str(item.get('cantidad', 1))))
                self.items_table.setItem(row, 2, QTableWidgetItem(str(item.get('precio_unitario', 0))))
                
        self.calculate_totals()
        
    def save_order(self):
        """Save order data."""
        if not self.validate_form():
            return
            
        order_data = {
            'tipo': self.order_type,
            'proveedor': self.supplier_edit.text(),
            'proveedor_rut': self.supplier_rut_edit.text(),
            'fecha': self.date_edit.date().toString('yyyy-MM-dd'),
            'estado': self.status_combo.currentText().lower(),
            'descripcion': self.description_edit.toPlainText()
        }
        
        user = login_manager.get_current_user()
        order_data['creado_por'] = user['username'] if user else 'unknown'
        
        if self.order_type == "combustible":
            vehicle_id = self.vehicle_combo.currentData()
            order_data['vehiculo_id'] = vehicle_id
            order_data['vehiculo'] = self.vehicle_combo.currentText().split(' - ')[0] if vehicle_id else ''
            order_data['monto_combustible'] = self.fuel_amount_spin.value()
            order_data['total'] = self.fuel_amount_spin.value()
        else:
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
                    
            order_data['items'] = items
            order_data['total'] = total
            
        if self.is_edit_mode:
            db.update_record('ordenes_compra', self.order_id, order_data)
            LogManager.log_update(user['username'], 'ORDENES_COMPRA', 'ORDEN', self.order_id, order_data)
        else:
            order_id = generate_id('OC')
            db.add_record('ordenes_compra', order_id, order_data)
            LogManager.log_create(user['username'], 'ORDENES_COMPRA', 'ORDEN', order_id, order_data)
            
        self.accept()
        
    def validate_form(self):
        """Validate form data."""
        if not self.supplier_edit.text().strip():
            QMessageBox.warning(self, 'Error de Validación', 'El proveedor es obligatorio')
            return False
            
        if self.order_type == "combustible":
            if not self.vehicle_combo.currentData():
                QMessageBox.warning(self, 'Error de Validación', 'Debe seleccionar un vehículo')
                return False
                
            if self.fuel_amount_spin.value() <= 0:
                QMessageBox.warning(self, 'Error de Validación', 'El monto debe ser mayor a 0')
                return False
        else:
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