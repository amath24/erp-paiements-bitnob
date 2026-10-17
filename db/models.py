import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from db.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    invoices = relationship("Invoice", back_populates="customer")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(100), primary_key=True, index=True)
    reference = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(120), default="Client Comptoir")
    amount_sat = Column(Integer, nullable=False)
    amount_xof = Column(Integer, default=0)
    description = Column(Text, nullable=False)
    status = Column(String(30), default="pending", index=True)
    paid = Column(Boolean, default=False, index=True)
    payment_request = Column(Text, nullable=True)
    qr_code_url = Column(Text, nullable=True)
    demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)

    customer = relationship("Customer", back_populates="invoices")
    settlements = relationship("Settlement", back_populates="invoice")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(String(100), primary_key=True, index=True)
    invoice_id = Column(String(100), ForeignKey("invoices.id"), nullable=True)
    reference = Column(String(100), unique=True, index=True, nullable=False)
    amount_sats = Column(Integer, nullable=False)
    amount_usdt = Column(Float, default=0.0)
    amount_xof = Column(Integer, nullable=False)
    beneficiary = Column(String(60), nullable=False)
    status = Column(String(30), default="INITIATED", index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    invoice = relationship("Invoice", back_populates="settlements")


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(120), unique=True, index=True, nullable=False)
    event_type = Column(String(60), nullable=False)
    raw_payload = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
