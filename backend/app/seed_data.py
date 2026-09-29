import random
from datetime import date, datetime, timedelta
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.models import (
    User, Business, Product, ProductPriceHistory, Customer, Subscription,
    CustomerPause, DeliveryRecord, Bill, BillItem, Payment, BusinessExpense, MilkProcurement
)
from app.services.billing_service import BillingService

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("Cleaning existing database records...")
    db.query(Payment).delete()
    db.query(BillItem).delete()
    db.query(Bill).delete()
    db.query(DeliveryRecord).delete()
    db.query(CustomerPause).delete()
    db.query(Subscription).delete()
    db.query(Customer).delete()
    db.query(ProductPriceHistory).delete()
    db.query(Product).delete()
    db.query(BusinessExpense).delete()
    db.query(MilkProcurement).delete()
    db.query(Business).delete()
    db.query(User).delete()
    db.commit()

    print("Seeding Users & Business Profile...")
    admin = User(
        email="admin@milkflow.com",
        password_hash=get_password_hash("password123"),
        full_name="Rajesh Sharma",
        phone="9876543210",
        role="admin",
        is_active=True
    )
    worker = User(
        email="worker@milkflow.com",
        password_hash=get_password_hash("worker123"),
        full_name="Santosh Jadhav",
        phone="9823456789",
        role="worker",
        is_active=True
    )
    db.add_all([admin, worker])
    db.commit()
    db.refresh(admin)
    db.refresh(worker)

    biz = Business(
        name="Shree Krishna Dairy & Milk Services",
        owner_name="Rajesh Sharma",
        phone="9876543210",
        alternate_phone="9822114455",
        address="Shop #4, Gokul Arcade, Kothrud, Pune, Maharashtra 411038",
        email="shreekrishna.dairy@gmail.com",
        currency="INR",
        currency_symbol="₹",
        billing_cycle="monthly_calendar",
        upi_id="shreekrishna@okaxis",
        invoice_prefix="SKD"
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)

    admin.business_id = biz.id
    worker.business_id = biz.id
    db.commit()

    print("Seeding Products & Price History...")
    today = date.today()
    sixty_days_ago = today - timedelta(days=60)
    fifteen_days_ago = today - timedelta(days=15)

    cow_milk = Product(
        name="Cow Milk (Desi / A2)",
        description="Fresh organic cow milk delivered daily morning",
        category="Milk",
        unit="Litre",
        default_price=60.0,
        is_active=True
    )
    buffalo_milk = Product(
        name="Buffalo Milk (Full Fat)",
        description="Creamy thick buffalo milk, 7% fat",
        category="Milk",
        unit="Litre",
        default_price=75.0,
        is_active=True
    )
    toned_milk = Product(
        name="Toned Milk",
        description="Pasteurized toned milk 3% fat",
        category="Milk",
        unit="Litre",
        default_price=54.0,
        is_active=True
    )
    curd = Product(
        name="Fresh Cow Curd (Dahi)",
        description="Pure thick cow milk set curd",
        category="Dairy",
        unit="Kilogram",
        default_price=80.0,
        is_active=True
    )
    paneer = Product(
        name="Fresh Malai Paneer",
        description="Soft fresh paneer made daily",
        category="Dairy",
        unit="Kilogram",
        default_price=360.0,
        is_active=True
    )
    db.add_all([cow_milk, buffalo_milk, toned_milk, curd, paneer])
    db.commit()
    for p in [cow_milk, buffalo_milk, toned_milk, curd, paneer]:
        db.refresh(p)

    # Cow Milk price history: ₹58 until 15 days ago, then ₹60
    hist_cow_old = ProductPriceHistory(
        product_id=cow_milk.id,
        price=58.0,
        effective_from=sixty_days_ago,
        effective_to=fifteen_days_ago - timedelta(days=1)
    )
    hist_cow_new = ProductPriceHistory(
        product_id=cow_milk.id,
        price=60.0,
        effective_from=fifteen_days_ago,
        effective_to=None
    )
    # Buffalo milk
    hist_buf = ProductPriceHistory(
        product_id=buffalo_milk.id,
        price=75.0,
        effective_from=sixty_days_ago,
        effective_to=None
    )
    # Curd
    hist_curd = ProductPriceHistory(
        product_id=curd.id,
        price=80.0,
        effective_from=sixty_days_ago,
        effective_to=None
    )
    db.add_all([hist_cow_old, hist_cow_new, hist_buf, hist_curd])
    db.commit()

    print("Seeding Customers & Subscriptions...")
    sample_customers = [
        ("Rahul Sharma", "9822012345", "Flat 402, Mayur Heights", "Kothrud", "morning", 1, 1.0, cow_milk.id, None),
        ("Amit Patil", "9822023456", "Bungalow 12, Swanand Park", "Kothrud", "morning", 2, 2.0, buffalo_milk.id, None),
        ("Priya Shah", "9822034567", "Row House 7, Anand Nagar", "Kothrud", "morning", 3, 0.5, cow_milk.id, 58.0), # custom rate
        ("Suresh Kulkarni", "9822045678", "Flat 101, Parijat Apts", "Karve Nagar", "morning", 4, 1.5, cow_milk.id, None),
        ("Neha Joshi", "9822056789", "Building C-3, Nisarg Enclave", "Karve Nagar", "morning", 5, 1.0, cow_milk.id, None),
        ("Vikram Deshmukh", "9822067890", "Plot 18, Sahakar Colony", "Shivajinagar", "morning", 6, 2.5, buffalo_milk.id, None),
        ("Sunita More", "9822078901", "Flat 504, Silver Oak", "Shivajinagar", "morning", 7, 1.0, cow_milk.id, None),
        ("Ramesh Gaikwad", "9822089012", "House 24, Prabhat Road", "Deccan", "morning", 8, 1.5, buffalo_milk.id, None),
        ("Anjali Chitale", "9822090123", "Flat 302, Chitale Villa", "Deccan", "both", 9, 2.0, cow_milk.id, None),
        ("Deepak Shinde", "9823011223", "Flat 12, Sagar Society", "Model Colony", "morning", 10, 1.0, toned_milk.id, None),
        ("Kavita Mehta", "9823022334", "Penthouse 901, Sky Gardens", "Model Colony", "morning", 11, 2.0, cow_milk.id, None),
        ("Mahesh Gokhale", "9823033445", "Bunglow 4, Rambaug Colony", "Kothrud", "morning", 12, 1.0, buffalo_milk.id, None),
        ("Swati Jadhav", "9823044556", "Flat 204, Yashoda Nivas", "Aundh", "morning", 13, 0.75, cow_milk.id, None),
        ("Ganesh Wagh", "9823055667", "Flat 601, Windsor Castle", "Aundh", "morning", 14, 1.5, cow_milk.id, None),
        ("Pooja Kadam", "9823066778", "Row House 2, Baner Park", "Baner", "morning", 15, 2.0, buffalo_milk.id, None),
        ("Sachin Bhalerao", "9823077889", "Flat 301, Aditya Residency", "Baner", "morning", 16, 1.0, cow_milk.id, None),
        ("Dr. Arvind Ranade", "9823088990", "Clinic & Res, Bhandarkar Rd", "Deccan", "morning", 17, 3.0, cow_milk.id, None),
        ("Smita Tambe", "9823099001", "Flat 103, Snehdeep Apts", "Karve Nagar", "morning", 18, 0.5, cow_milk.id, None),
    ]

    customers = []
    for idx, (c_name, c_phone, c_addr, c_area, slot, seq, qty, prod_id, cust_rate) in enumerate(sample_customers):
        c = Customer(
            customer_code=f"CUST-{idx+1:03d}",
            name=c_name,
            phone=c_phone,
            address=c_addr,
            area=c_area,
            default_delivery_time=slot,
            assigned_worker_id=worker.id if seq % 2 == 0 else admin.id,
            route_sequence=seq,
            status="active",
            start_date=sixty_days_ago
        )
        db.add(c)
        db.flush()
        customers.append(c)

        # Add primary milk subscription
        sub = Subscription(
            customer_id=c.id,
            product_id=prod_id,
            default_quantity=qty,
            unit="Litre",
            custom_rate=cust_rate,
            delivery_time="morning",
            is_active=True,
            start_date=sixty_days_ago
        )
        db.add(sub)

        # Add secondary subscription (curd) for some customers
        if idx in [1, 5, 8, 10, 14]:
            sub_curd = Subscription(
                customer_id=c.id,
                product_id=curd.id,
                default_quantity=0.5,
                unit="Kilogram",
                custom_rate=None,
                delivery_time="morning",
                is_active=True,
                start_date=sixty_days_ago
            )
            db.add(sub_curd)

    db.commit()
    for c in customers:
        db.refresh(c)

    print("Adding scheduled pause for Customer #4 (Suresh Kulkarni)...")
    # Suresh paused for 4 days last week
    pause_start = today - timedelta(days=10)
    pause_end = today - timedelta(days=7)
    db.add(CustomerPause(
        customer_id=customers[3].id,
        start_date=pause_start,
        end_date=pause_end,
        reason="Family vacation to Konkan",
        is_active=False
    ))
    db.commit()

    print("Seeding 60 Days of Realistic Delivery Records...")
    random.seed(42)

    all_delivery_records = []
    for day_offset in range(59, -1, -1):
        curr_date = today - timedelta(days=day_offset)
        
        for c in customers:
            # Check pause
            is_paused = (c.id == customers[3].id and pause_start <= curr_date <= pause_end)
            
            subs = db.query(Subscription).filter(Subscription.customer_id == c.id).all()
            for s in subs:
                applicable_rate = BillingService.get_applicable_rate(db, c.id, s.product_id, curr_date)
                
                if is_paused:
                    rec = DeliveryRecord(
                        customer_id=c.id,
                        product_id=s.product_id,
                        subscription_id=s.id,
                        delivery_date=curr_date,
                        delivery_time=s.delivery_time,
                        scheduled_quantity=s.default_quantity,
                        actual_quantity=0.0,
                        applied_rate=applicable_rate,
                        status="skipped",
                        skip_reason="Customer on vacation",
                        recorded_by_id=admin.id
                    )
                else:
                    # Random variations: 93% normal delivered, 4% extra milk (+0.5L), 3% skipped
                    rand_val = random.random()
                    if rand_val < 0.03:
                        rec = DeliveryRecord(
                            customer_id=c.id,
                            product_id=s.product_id,
                            subscription_id=s.id,
                            delivery_date=curr_date,
                            delivery_time=s.delivery_time,
                            scheduled_quantity=s.default_quantity,
                            actual_quantity=0.0,
                            applied_rate=applicable_rate,
                            status="skipped",
                            skip_reason=random.choice(["Customer out of town", "Had surplus milk", "Holiday"]),
                            recorded_by_id=admin.id
                        )
                    elif rand_val < 0.07:
                        # Extra milk
                        extra_qty = s.default_quantity + random.choice([0.5, 1.0])
                        rec = DeliveryRecord(
                            customer_id=c.id,
                            product_id=s.product_id,
                            subscription_id=s.id,
                            delivery_date=curr_date,
                            delivery_time=s.delivery_time,
                            scheduled_quantity=s.default_quantity,
                            actual_quantity=extra_qty,
                            applied_rate=applicable_rate,
                            status="delivered",
                            notes="Extra milk requested for guests",
                            recorded_by_id=admin.id
                        )
                    else:
                        # Normal
                        rec = DeliveryRecord(
                            customer_id=c.id,
                            product_id=s.product_id,
                            subscription_id=s.id,
                            delivery_date=curr_date,
                            delivery_time=s.delivery_time,
                            scheduled_quantity=s.default_quantity,
                            actual_quantity=s.default_quantity,
                            applied_rate=applicable_rate,
                            status="delivered",
                            recorded_by_id=admin.id
                        )
                all_delivery_records.append(rec)

    db.bulk_save_objects(all_delivery_records)
    db.commit()

    print("Generating Monthly Bills for Previous Month & Current Month...")
    # Previous Month
    prev_month_start = date(today.year, today.month - 1 if today.month > 1 else 12, 1)
    # End of prev month
    first_of_curr_month = date(today.year, today.month, 1)
    prev_month_end = first_of_curr_month - timedelta(days=1)

    for c in customers:
        bill = BillingService.create_or_update_bill(
            db=db,
            customer_id=c.id,
            period_start=prev_month_start,
            period_end=prev_month_end,
            generated_by_id=admin.id
        )

        # Most customers paid their previous month bill
        if random.random() < 0.8:
            # Full payment
            pay = Payment(
                receipt_number=f"RCP-{prev_month_start.year}-{random.randint(100, 999)}",
                customer_id=c.id,
                bill_id=bill.id,
                amount=bill.total_due,
                payment_date=prev_month_end + timedelta(days=random.randint(1, 5)),
                payment_method=random.choice(["upi", "cash", "bank_transfer"]),
                reference_number=f"UPI{random.randint(10000000, 99999999)}" if random.random() > 0.4 else None,
                recorded_by_id=admin.id
            )
            db.add(pay)
            bill.amount_paid = bill.total_due
            bill.balance_remaining = 0.0
            bill.status = "paid"
        else:
            # Partial payment
            part_amt = round(bill.total_due * 0.6, 2)
            pay = Payment(
                receipt_number=f"RCP-{prev_month_start.year}-{random.randint(100, 999)}",
                customer_id=c.id,
                bill_id=bill.id,
                amount=part_amt,
                payment_date=prev_month_end + timedelta(days=random.randint(2, 6)),
                payment_method="upi",
                recorded_by_id=admin.id
            )
            db.add(pay)
            bill.amount_paid = part_amt
            bill.balance_remaining = round(bill.total_due - part_amt, 2)
            bill.status = "partially_paid"
    db.commit()

    # Generate current month draft bills (from 1st of this month to today)
    print("Generating Current Month Bills...")
    for c in customers:
        BillingService.create_or_update_bill(
            db=db,
            customer_id=c.id,
            period_start=first_of_curr_month,
            period_end=today,
            generated_by_id=admin.id
        )

    print("Seeding Business Expenses & Procurement...")
    sample_expenses = [
        (today - timedelta(days=1), "Diesel for Delivery Van", "transport", 850.0, "HP Petrol Pump"),
        (today - timedelta(days=2), "Packaging Foil & Pouches", "packaging", 1200.0, "Bulk pouch supply"),
        (today - timedelta(days=5), "Dairy Electricity Bill", "electricity", 3400.0, "MSEDCL Monthly"),
        (today - timedelta(days=10), "Delivery Worker Weekly Wages", "wages", 5000.0, "Santosh Jadhav weekly wage"),
        (today, "Cleaning & Sanitation supplies", "other", 450.0, "Food grade disinfectant"),
    ]
    for d, title, cat, amt, notes in sample_expenses:
        db.add(BusinessExpense(date=d, title=title, category=cat, amount=amt, notes=notes))

    for day_offset in range(14, -1, -1):
        d = today - timedelta(days=day_offset)
        db.add(MilkProcurement(
            date=d,
            supplier_name="Bhairavnath Dairy Farm, Junnar",
            purchase_quantity=120.0 + random.randint(0, 20),
            purchase_rate=44.0,
            total_cost=(120.0 + random.randint(0, 20)) * 44.0,
            notes="Morning fresh tanker delivery"
        ))

    db.commit()
    db.close()
    print("[SUCCESS] Demo data seeded successfully with 18 customers, 60 days of deliveries, bills, and payments!")

if __name__ == "__main__":
    seed()
