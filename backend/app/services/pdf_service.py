import io
import urllib.parse
from datetime import date
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image as RLImage
from app.models.models import Bill, Business

class PDFService:
    @staticmethod
    def generate_bill_pdf(bill: Bill, business: Business) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom typography styles
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=20,
            textColor=colors.HexColor('#065f46'),  # Emerald dark
            leading=24,
            spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#4b5563'),
            leading=14
        )
        heading_style = ParagraphStyle(
            'HeadingStyle',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=12,
            textColor=colors.HexColor('#1f2937'),
            leading=16,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            textColor=colors.HexColor('#374151'),
            leading=13
        )
        bold_body_style = ParagraphStyle(
            'BoldBodyStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9.5,
            textColor=colors.HexColor('#111827'),
            leading=13
        )
        accent_total_style = ParagraphStyle(
            'AccentTotalStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=colors.HexColor('#047857'),
            leading=18
        )

        story = []

        # Business Header & Invoice Meta (2-column layout)
        biz_name = business.name if business else "Shree Krishna Dairy"
        biz_owner = f"Owner: {business.owner_name}" if business and business.owner_name else ""
        biz_phone = f"Phone: {business.phone}" if business and business.phone else ""
        biz_addr = business.address if business and business.address else ""
        biz_upi = f"UPI: {business.upi_id}" if business and business.upi_id else ""

        biz_header = Paragraph(
            f"<b>{biz_name}</b><br/>{biz_owner}<br/>{biz_addr}<br/>{biz_phone}<br/>{biz_upi}",
            subtitle_style
        )

        inv_meta = Paragraph(
            f"<b><font size=16 color='#065f46'>MONTHLY MILK INVOICE</font></b><br/><br/>"
            f"<b>Invoice #:</b> {bill.bill_number}<br/>"
            f"<b>Period:</b> {bill.period_start.strftime('%d %b %Y')} - {bill.period_end.strftime('%d %b %Y')}<br/>"
            f"<b>Date:</b> {bill.created_at.strftime('%d %b %Y')}<br/>"
            f"<b>Status:</b> <font color='{'#059669' if bill.status == 'paid' else '#dc2626'}'>{bill.status.upper()}</font>",
            subtitle_style
        )

        header_table = Table([[biz_header, inv_meta]], colWidths=[300, 240])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(header_table)
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#10b981'), spaceBefore=8, spaceAfter=14))

        # Bill To (Customer Details)
        cust = bill.customer
        c_name = cust.name if cust else "Valued Customer"
        c_code = cust.customer_code if cust else ""
        c_phone = cust.phone if cust else ""
        c_address = cust.address if cust else ""
        c_area = cust.area if cust else ""

        cust_info = [
            [
                Paragraph(f"<b>BILL TO:</b>", heading_style),
                Paragraph(f"<b>CUSTOMER ID:</b> {c_code}", bold_body_style)
            ],
            [
                Paragraph(f"<b>{c_name}</b><br/>{c_address}<br/>Area: {c_area}<br/>Phone: {c_phone}", body_style),
                Paragraph(f"<b>Delivery Slot:</b> {cust.default_delivery_time.capitalize() if cust else 'Morning'}", body_style)
            ]
        ]
        cust_table = Table(cust_info, colWidths=[360, 180])
        cust_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(cust_table)
        story.append(Spacer(1, 14))

        # Itemized Breakdown Table
        headers = [
            Paragraph("<b>Product & Rate Breakdown</b>", bold_body_style),
            Paragraph("<b>Rate</b>", bold_body_style),
            Paragraph("<b>Total Qty</b>", bold_body_style),
            Paragraph("<b>Amount (INR)</b>", bold_body_style)
        ]
        table_rows = [headers]

        if bill.items:
            for itm in bill.items:
                p_name = itm.product.name if itm.product else "Milk Product"
                desc = itm.rate_period_description or f"{p_name}"
                table_rows.append([
                    Paragraph(f"<b>{p_name}</b><br/><font size=8 color='#6b7280'>{desc}</font>", body_style),
                    Paragraph(f"₹{itm.rate:.2f}", body_style),
                    Paragraph(f"{itm.total_quantity:.2f} {itm.product.unit if itm.product else 'L'}", body_style),
                    Paragraph(f"₹{itm.total_amount:,.2f}", bold_body_style)
                ])
        else:
            table_rows.append([
                Paragraph(f"Milk Deliveries ({bill.period_start.strftime('%b %d')} - {bill.period_end.strftime('%b %d')})", body_style),
                Paragraph("—", body_style),
                Paragraph(f"{bill.total_quantity:.2f} L", body_style),
                Paragraph(f"₹{bill.milk_total_amount:,.2f}", bold_body_style)
            ])

        items_table = Table(table_rows, colWidths=[270, 80, 90, 100])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecfdf5')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 14))

        # Financial Summary Calculation Table
        summary_rows = [
            ["Subtotal (Current Milk Sold):", f"₹{bill.milk_total_amount:,.2f}"],
        ]
        if bill.previous_balance and bill.previous_balance > 0:
            summary_rows.append(["Previous Outstanding Balance:", f"₹{bill.previous_balance:,.2f}"])
        if bill.additional_charges and bill.additional_charges > 0:
            summary_rows.append(["Additional Charges:", f"₹{bill.additional_charges:,.2f}"])
        if bill.discount_amount and bill.discount_amount > 0:
            summary_rows.append(["Special Discount:", f"- ₹{bill.discount_amount:,.2f}"])
        
        summary_rows.append(["Total Bill Amount:", f"₹{bill.total_due:,.2f}"])
        summary_rows.append(["Payments Received:", f"₹{bill.amount_paid:,.2f}"])
        summary_rows.append(["NET BALANCE DUE:", f"₹{bill.balance_remaining:,.2f}"])

        formatted_summary = []
        for idx, (label, val) in enumerate(summary_rows):
            is_final = (idx == len(summary_rows) - 1)
            is_total = (label == "Total Bill Amount:")
            
            lbl_style = accent_total_style if is_final else (bold_body_style if is_total else body_style)
            val_style = accent_total_style if is_final else (bold_body_style if is_total else body_style)
            formatted_summary.append([Paragraph(label, lbl_style), Paragraph(val, val_style)])

        summary_table = Table(formatted_summary, colWidths=[200, 120])
        summary_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (0, -2), (1, -2), 1, colors.HexColor('#9ca3af')),
            ('BACKGROUND', (0, -1), (1, -1), colors.HexColor('#f0fdf4')),
        ]))

        # Wrap in right-aligned container
        outer_summary = Table([["", summary_table]], colWidths=[220, 320])
        outer_summary.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ]))
        story.append(outer_summary)
        story.append(Spacer(1, 15))

        # Dynamic NPCI UPI QR Code Generation
        qr_flowable = None
        upi_str = business.upi_id if business and business.upi_id else None
        if upi_str and bill.balance_remaining > 0:
            try:
                import qrcode
                pa = upi_str.strip()
                pn = urllib.parse.quote(business.name.strip() if business.name else "MilkFlow")
                am = f"{bill.balance_remaining:.2f}"
                tn = urllib.parse.quote(f"MilkBill-{bill.bill_number}")
                upi_uri = f"upi://pay?pa={pa}&pn={pn}&am={am}&tn={tn}&cu=INR"

                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_M,
                    box_size=3,
                    border=1,
                )
                qr.add_data(upi_uri)
                qr.make(fit=True)
                img = qr.make_image(fill_color="#065f46", back_color="white")
                
                qr_buf = io.BytesIO()
                img.save(qr_buf, format="PNG")
                qr_buf.seek(0)
                qr_flowable = RLImage(qr_buf, width=64, height=64)
            except Exception:
                qr_flowable = None

        # Payment & Footer Note layout (with QR code on the left if available)
        footer_text = (
            f"<b>Payment Instructions:</b> Please scan the QR code to pay instantly via <b>Google Pay, PhonePe, or Paytm</b>.<br/>"
            f"UPI VPA: <b>{upi_str or 'Authorized Dairy UPI / Cash'}</b> • Due: <b>₹{bill.balance_remaining:,.2f}</b><br/>"
            f"Thank you for choosing fresh, pure dairy every morning! For queries or delivery adjustments, call {biz_phone}."
        )

        if qr_flowable:
            qr_caption = Paragraph("<font size=7 color='#065f46'><b>SCAN TO PAY</b></font>", subtitle_style)
            qr_box = Table([[qr_flowable], [qr_caption]], colWidths=[70])
            qr_box.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
                ('TOPPADDING', (0, 0), (-1, -1), 1),
            ]))
            footer_table = Table([[qr_box, Paragraph(footer_text, subtitle_style)]], colWidths=[80, 460])
            footer_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('PADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(footer_table)
        else:
            story.append(Paragraph(footer_text, subtitle_style))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
