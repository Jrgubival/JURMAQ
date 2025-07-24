import os
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from .utils import COMPANY_INFO, FUEL_SUPPLIER, format_currency

def ensure_output_dir():
    """Ensure output directory exists."""
    output_dir = "output"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    return output_dir

def add_company_header(canvas, doc, title):
    """Add company header to PDF."""
    canvas.saveState()
    
    # Company logo (if exists)
    if os.path.exists("assets/logo.png"):
        try:
            canvas.drawImage("assets/logo.png", 50, doc.height - 80, width=100, height=50)
        except:
            pass
    
    # Company information
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(170, doc.height - 40, COMPANY_INFO['name'])
    
    canvas.setFont("Helvetica", 10)
    canvas.drawString(170, doc.height - 55, f"RUT: {COMPANY_INFO['rut']}")
    canvas.drawString(170, doc.height - 70, COMPANY_INFO['address'])
    canvas.drawString(170, doc.height - 85, f"Tel: {COMPANY_INFO['phone']} | Email: {COMPANY_INFO['email']}")
    
    # Document title
    canvas.setFont("Helvetica-Bold", 16)
    title_width = canvas.stringWidth(title, "Helvetica-Bold", 16)
    canvas.drawString((doc.width - title_width) / 2 + 50, doc.height - 120, title)
    
    # Line separator
    canvas.line(50, doc.height - 135, doc.width + 50, doc.height - 135)
    
    canvas.restoreState()

def add_company_footer(canvas, doc):
    """Add company footer to PDF."""
    canvas.saveState()
    
    # Footer line
    canvas.line(50, 80, doc.width + 50, 80)
    
    # Footer text
    canvas.setFont("Helvetica", 8)
    canvas.drawString(50, 65, f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    
    # Page number
    canvas.drawRightString(doc.width + 50, 65, f"Página {canvas.getPageNumber()}")
    
    canvas.restoreState()

def generate_order_pdf(order_id, order_data):
    """Generate PDF for purchase order."""
    output_dir = ensure_output_dir()
    filename = f"orden_compra_{order_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(output_dir, filename)
    
    # Create PDF document
    doc = SimpleDocTemplate(filepath, pagesize=A4, topMargin=150, bottomMargin=100)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=12,
        textColor=colors.darkblue
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )
    
    # Order information
    story.append(Paragraph(f"ORDEN DE COMPRA N° {order_id}", header_style))
    story.append(Spacer(1, 20))
    
    # Order details table
    order_details = [
        ['Fecha:', order_data.get('fecha', '')],
        ['Proveedor:', order_data.get('proveedor', '')],
        ['RUT Proveedor:', order_data.get('proveedor_rut', '')],
        ['Estado:', order_data.get('estado', '').title()],
        ['Tipo:', 'Combustible' if order_data.get('tipo') == 'combustible' else 'Normal']
    ]
    
    if order_data.get('tipo') == 'combustible':
        order_details.append(['Vehículo:', order_data.get('vehiculo', 'N/A')])
    
    details_table = Table(order_details, colWidths=[3*cm, 6*cm])
    details_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 20))
    
    # Items or fuel information
    if order_data.get('tipo') == 'combustible':
        # Fuel order details
        story.append(Paragraph("DETALLES DEL COMBUSTIBLE", header_style))
        
        fuel_data = [
            ['Descripción', 'Monto'],
            ['Combustible para vehículo', format_currency(order_data.get('monto_combustible', 0))]
        ]
        
        fuel_table = Table(fuel_data, colWidths=[12*cm, 4*cm])
        fuel_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(fuel_table)
        
        # Special note for fuel orders
        story.append(Spacer(1, 10))
        note_style = ParagraphStyle(
            'Note',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.red,
            leftIndent=20
        )
        story.append(Paragraph(
            f"<b>NOTA:</b> Esta orden de combustible está destinada específicamente al vehículo {order_data.get('vehiculo', 'indicado')} "
            f"y debe ser provista por {FUEL_SUPPLIER['name']} (RUT: {FUEL_SUPPLIER['rut']}).",
            note_style
        ))
        
    else:
        # Normal order items
        story.append(Paragraph("ITEMS DE LA ORDEN", header_style))
        
        items_data = [['Descripción', 'Cantidad', 'Precio Unit.', 'Subtotal']]
        
        total = 0
        for item in order_data.get('items', []):
            subtotal = item.get('subtotal', 0)
            total += subtotal
            items_data.append([
                item.get('descripcion', ''),
                str(item.get('cantidad', 0)),
                format_currency(item.get('precio_unitario', 0)),
                format_currency(subtotal)
            ])
        
        # Add total row
        items_data.append(['', '', 'TOTAL:', format_currency(total)])
        
        items_table = Table(items_data, colWidths=[8*cm, 2*cm, 3*cm, 3*cm])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(items_table)
    
    # Description
    if order_data.get('descripcion'):
        story.append(Spacer(1, 20))
        story.append(Paragraph("OBSERVACIONES", header_style))
        story.append(Paragraph(order_data.get('descripcion', ''), normal_style))
    
    # Signature section
    story.append(Spacer(1, 40))
    
    signature_data = [
        ['', ''],
        ['_________________________', '_________________________'],
        ['Solicitado por', 'Autorizado por'],
        [order_data.get('creado_por', ''), 'Administración']
    ]
    
    signature_table = Table(signature_data, colWidths=[8*cm, 8*cm])
    signature_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, 1), 20),
        ('BOTTOMPADDING', (0, 2), (-1, 2), 5),
    ]))
    story.append(signature_table)
    
    # Build PDF with header and footer
    def add_page_elements(canvas, doc):
        add_company_header(canvas, doc, f"ORDEN DE COMPRA N° {order_id}")
        add_company_footer(canvas, doc)
    
    doc.build(story, onFirstPage=add_page_elements, onLaterPages=add_page_elements)
    
    return filepath

def generate_budget_pdf(budget_id, budget_data):
    """Generate PDF for budget/quote."""
    output_dir = ensure_output_dir()
    filename = f"presupuesto_{budget_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(output_dir, filename)
    
    # Create PDF document
    doc = SimpleDocTemplate(filepath, pagesize=A4, topMargin=150, bottomMargin=100)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=12,
        textColor=colors.darkblue
    )
    
    # Budget information
    story.append(Paragraph(f"PRESUPUESTO N° {budget_id}", header_style))
    story.append(Spacer(1, 20))
    
    # Client and budget details
    details = [
        ['Fecha:', budget_data.get('fecha', '')],
        ['Cliente:', budget_data.get('cliente', '')],
        ['RUT Cliente:', budget_data.get('cliente_rut', '')],
        ['Contacto:', budget_data.get('contacto', '')],
        ['Teléfono:', budget_data.get('telefono', '')],
        ['Email:', budget_data.get('email', '')],
        ['Estado:', budget_data.get('estado', '').title()],
        ['Vigencia:', f"{budget_data.get('vigencia', 30)} días"]
    ]
    
    details_table = Table(details, colWidths=[3*cm, 8*cm])
    details_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 20))
    
    # Items
    story.append(Paragraph("DETALLES DEL PRESUPUESTO", header_style))
    
    items_data = [['Descripción', 'Cantidad', 'Precio Unit.', 'Subtotal']]
    
    total = 0
    for item in budget_data.get('items', []):
        subtotal = item.get('subtotal', 0)
        total += subtotal
        items_data.append([
            item.get('descripcion', ''),
            str(item.get('cantidad', 0)),
            format_currency(item.get('precio_unitario', 0)),
            format_currency(subtotal)
        ])
    
    # Add total row
    items_data.append(['', '', 'TOTAL:', format_currency(total)])
    
    items_table = Table(items_data, colWidths=[8*cm, 2*cm, 3*cm, 3*cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
        ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(items_table)
    
    # Observations
    if budget_data.get('observaciones'):
        story.append(Spacer(1, 20))
        story.append(Paragraph("OBSERVACIONES", header_style))
        story.append(Paragraph(budget_data.get('observaciones', ''), styles['Normal']))
    
    # Terms and conditions
    story.append(Spacer(1, 20))
    story.append(Paragraph("TÉRMINOS Y CONDICIONES", header_style))
    
    terms = [
        "• El presente presupuesto tiene una vigencia de 30 días desde la fecha de emisión.",
        "• Los precios incluyen materiales y mano de obra según especificaciones.",
        "• Cualquier modificación al proyecto original será cotizada por separado.",
        "• El pago se realizará según cronograma acordado.",
        "• La empresa se compromete a cumplir con todas las normativas vigentes."
    ]
    
    for term in terms:
        story.append(Paragraph(term, styles['Normal']))
    
    # Digital signature
    story.append(Spacer(1, 30))
    
    # Add signature image if exists
    signature_section = []
    if os.path.exists("assets/firma.png"):
        try:
            story.append(Paragraph("Atentamente,", styles['Normal']))
            story.append(Spacer(1, 10))
            
            # Create table for signature
            sig_data = [[''], ['']]  # Empty cells for signature image
            sig_table = Table(sig_data, colWidths=[6*cm], rowHeights=[40, 20])
            
            # We'll add the signature image programmatically
            story.append(sig_table)
            
            story.append(Paragraph("Jorge Ubilla Rivera", styles['Normal']))
            story.append(Paragraph("Gerente General", styles['Normal']))
            story.append(Paragraph(COMPANY_INFO['name'], styles['Normal']))
        except:
            pass
    else:
        signature_data = [
            ['', ''],
            ['_________________________', ''],
            ['Jorge Ubilla Rivera', ''],
            ['Gerente General', '']
        ]
        
        signature_table = Table(signature_data, colWidths=[8*cm, 8*cm])
        signature_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, 1), 20),
            ('BOTTOMPADDING', (0, 2), (-1, 2), 5),
        ]))
        story.append(signature_table)
    
    # Build PDF
    def add_page_elements(canvas, doc):
        add_company_header(canvas, doc, f"PRESUPUESTO N° {budget_id}")
        add_company_footer(canvas, doc)
        
        # Add signature image if it exists
        if os.path.exists("assets/firma.png"):
            try:
                # Calculate position for signature (this is approximate)
                canvas.drawImage("assets/firma.png", 50, 150, width=120, height=60)
            except:
                pass
    
    doc.build(story, onFirstPage=add_page_elements, onLaterPages=add_page_elements)
    
    return filepath

def generate_payroll_pdf(employee_id, payroll_data):
    """Generate PDF for payroll slip."""
    output_dir = ensure_output_dir()
    filename = f"liquidacion_{employee_id}_{payroll_data.get('periodo', '')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(output_dir, filename)
    
    # Create simple PDF with canvas for payroll
    from reportlab.pdfgen import canvas as pdf_canvas
    
    c = pdf_canvas.Canvas(filepath, pagesize=A4)
    width, height = A4
    
    # Header
    add_company_header(c, type('obj', (object,), {'width': width - 100, 'height': height - 50})(), 
                      f"LIQUIDACIÓN DE SUELDO - {payroll_data.get('periodo', '')}")
    
    # Employee information
    y_pos = height - 180
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y_pos, "DATOS DEL EMPLEADO")
    
    y_pos -= 25
    c.setFont("Helvetica", 10)
    c.drawString(50, y_pos, f"Nombre: {payroll_data.get('empleado_nombre', '')}")
    y_pos -= 15
    c.drawString(50, y_pos, f"RUT: {payroll_data.get('empleado_rut', '')}")
    y_pos -= 15
    c.drawString(50, y_pos, f"Cargo: {payroll_data.get('cargo', '')}")
    y_pos -= 15
    c.drawString(50, y_pos, f"Período: {payroll_data.get('periodo', '')}")
    
    # Payroll details
    y_pos -= 40
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y_pos, "LIQUIDACIÓN")
    
    y_pos -= 25
    c.setFont("Helvetica", 10)
    
    # Haberes
    c.drawString(50, y_pos, "HABERES")
    c.drawString(400, y_pos, "DESCUENTOS")
    y_pos -= 15
    
    c.drawString(50, y_pos, f"Sueldo Base: {format_currency(payroll_data.get('sueldo_base', 0))}")
    y_pos -= 15
    
    if payroll_data.get('bonos', 0) > 0:
        c.drawString(50, y_pos, f"Bonos: {format_currency(payroll_data.get('bonos', 0))}")
        y_pos -= 15
    
    # Descuentos
    y_pos_desc = height - 280
    if payroll_data.get('descuentos_previsionales', 0) > 0:
        c.drawString(400, y_pos_desc, f"Desc. Previsionales: {format_currency(payroll_data.get('descuentos_previsionales', 0))}")
        y_pos_desc -= 15
    
    if payroll_data.get('descuentos_otros', 0) > 0:
        c.drawString(400, y_pos_desc, f"Otros Descuentos: {format_currency(payroll_data.get('descuentos_otros', 0))}")
        y_pos_desc -= 15
    
    # Total
    y_pos = min(y_pos, y_pos_desc) - 30
    c.line(50, y_pos, width - 50, y_pos)
    y_pos -= 20
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y_pos, f"TOTAL HABERES: {format_currency(payroll_data.get('total_haberes', 0))}")
    c.drawString(400, y_pos, f"TOTAL DESCUENTOS: {format_currency(payroll_data.get('total_descuentos', 0))}")
    
    y_pos -= 25
    c.setFont("Helvetica-Bold", 14)
    c.drawString(200, y_pos, f"SUELDO LÍQUIDO: {format_currency(payroll_data.get('sueldo_liquido', 0))}")
    
    # Footer
    add_company_footer(c, type('obj', (object,), {'width': width - 100})())
    
    c.save()
    return filepath