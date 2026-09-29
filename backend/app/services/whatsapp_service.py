import urllib.parse
from app.models.models import Bill, Business, Customer

class WhatsAppService:
    @staticmethod
    def clean_phone_number(phone: str) -> str:
        digits = "".join(filter(str.isdigit, phone or ""))
        if len(digits) == 10:
            return f"91{digits}"
        return digits

    @staticmethod
    def generate_bill_message(bill: Bill, business: Business) -> str:
        cust = bill.customer
        c_name = cust.name if cust else "Valued Customer"
        biz_name = business.name if business else "MilkFlow Dairy Services"
        biz_phone = business.phone if business else ""
        upi_id = business.upi_id if business and business.upi_id else ""
        period_str = f"{bill.period_start.strftime('%B %Y')}"

        msg = (
            f"Namaste {c_name} ji 🙏\n\n"
            f"Here is your milk delivery statement from *{biz_name}* for *{period_str}*:\n\n"
            f"🥛 *Total Milk Delivered:* {bill.total_quantity:.1f} L\n"
            f"💵 *Milk Charges:* ₹{bill.milk_total_amount:,.2f}\n"
        )
        if bill.previous_balance and bill.previous_balance > 0:
            msg += f"📂 *Previous Balance:* ₹{bill.previous_balance:,.2f}\n"
        if bill.discount_amount and bill.discount_amount > 0:
            msg += f"🎁 *Discount:* -₹{bill.discount_amount:,.2f}\n"
        if bill.additional_charges and bill.additional_charges > 0:
            msg += f"➕ *Extra Charges:* ₹{bill.additional_charges:,.2f}\n"

        msg += f"💳 *Payments Received:* ₹{bill.amount_paid:,.2f}\n"
        msg += "━━━━━━━━━━━━━━━━━━━━\n"
        msg += f"⚡ *Net Balance Due: ₹{bill.balance_remaining:,.2f}*\n"
        msg += "━━━━━━━━━━━━━━━━━━━━\n\n"

        if bill.balance_remaining > 0 and upi_id:
            msg += f"📲 *Pay via UPI:* {upi_id}\n\n"
        
        msg += f"Thank you for choosing fresh & pure milk! 🥛✨\n*{biz_name}*"
        if biz_phone:
            msg += f"\n📞 Contact: {biz_phone}"

        return msg

    @staticmethod
    def generate_bill_url(bill: Bill, business: Business) -> str:
        phone = WhatsAppService.clean_phone_number(bill.customer.phone if bill.customer else "")
        msg = WhatsAppService.generate_bill_message(bill, business)
        encoded_msg = urllib.parse.quote(msg)
        return f"https://wa.me/{phone}?text={encoded_msg}"

    @staticmethod
    def generate_reminder_message(customer: Customer, balance: float, business: Business) -> str:
        biz_name = business.name if business else "MilkFlow Dairy"
        biz_phone = business.phone if business else ""
        upi_id = business.upi_id if business and business.upi_id else ""

        msg = (
            f"Namaste {customer.name} ji 🙏\n\n"
            f"This is a gentle payment reminder from *{biz_name}*.\n"
            f"Your current outstanding milk balance is *₹{balance:,.2f}*.\n\n"
        )
        if upi_id:
            msg += f"📲 You can settle conveniently via UPI: *{upi_id}*\n\n"
        
        msg += f"Please ignore if already paid. Thank you! 🥛\n*{biz_name}*"
        if biz_phone:
            msg += f"\n📞 {biz_phone}"

        return msg

    @staticmethod
    def generate_reminder_url(customer: Customer, balance: float, business: Business) -> str:
        phone = WhatsAppService.clean_phone_number(customer.phone)
        msg = WhatsAppService.generate_reminder_message(customer, balance, business)
        encoded_msg = urllib.parse.quote(msg)
        return f"https://wa.me/{phone}?text={encoded_msg}"
