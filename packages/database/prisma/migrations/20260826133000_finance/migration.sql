-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('RECORDED', 'VOID');

-- CreateTable
CREATE TABLE "organisation_sequences" (
    "organisation_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "organisation_sequences_pkey" PRIMARY KEY ("organisation_id","code")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "invoice_number" VARCHAR(60) NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "subtotal_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "tax_minor" INTEGER NOT NULL DEFAULT 0,
    "grand_total_minor" INTEGER NOT NULL,
    "paid_total_minor" INTEGER NOT NULL DEFAULT 0,
    "balance_due_minor" INTEGER NOT NULL,
    "notes" VARCHAR(2000),
    "issued_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "tax_minor" INTEGER NOT NULL DEFAULT 0,
    "line_total_minor" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "invoice_id" UUID,
    "person_id" UUID NOT NULL,
    "recorded_by_id" UUID,
    "receipt_number" VARCHAR(60) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "refunded_minor" INTEGER NOT NULL DEFAULT 0,
    "method" VARCHAR(60) NOT NULL,
    "reference" VARCHAR(160),
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "issued_by_id" UUID,
    "amount_minor" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "refunded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "recorded_by_id" UUID,
    "category" VARCHAR(100) NOT NULL,
    "vendor" VARCHAR(180),
    "description" VARCHAR(500) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "expense_date" DATE NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'RECORDED',
    "reference" VARCHAR(160),
    "voided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_organisation_id_status_due_date_idx" ON "invoices"("organisation_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_organisation_id_person_id_issue_date_idx" ON "invoices"("organisation_id", "person_id", "issue_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organisation_id_invoice_number_key" ON "invoices"("organisation_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_items_organisation_id_invoice_id_idx" ON "invoice_items"("organisation_id", "invoice_id");

-- CreateIndex
CREATE INDEX "payments_organisation_id_person_id_received_at_idx" ON "payments"("organisation_id", "person_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "payments_organisation_id_invoice_id_idx" ON "payments"("organisation_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organisation_id_receipt_number_key" ON "payments"("organisation_id", "receipt_number");

-- CreateIndex
CREATE INDEX "payment_refunds_organisation_id_payment_id_idx" ON "payment_refunds"("organisation_id", "payment_id");

-- CreateIndex
CREATE INDEX "expenses_organisation_id_status_expense_date_idx" ON "expenses"("organisation_id", "status", "expense_date" DESC);

-- AddForeignKey
ALTER TABLE "organisation_sequences" ADD CONSTRAINT "organisation_sequences_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organisation_sequences" ENABLE ROW LEVEL SECURITY; ALTER TABLE "organisation_sequences" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY; ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY; ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY; ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payment_refunds" ENABLE ROW LEVEL SECURITY; ALTER TABLE "payment_refunds" FORCE ROW LEVEL SECURITY;
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY; ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;

CREATE POLICY "organisation_sequences_isolation" ON "organisation_sequences" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "invoices_isolation" ON "invoices" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "invoice_items_isolation" ON "invoice_items" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "payments_isolation" ON "payments" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "payment_refunds_isolation" ON "payment_refunds" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "expenses_isolation" ON "expenses" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);

ALTER TABLE "organisation_sequences" ADD CONSTRAINT "organisation_sequences_current_value_nonnegative" CHECK ("current_value" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dates_valid" CHECK ("due_date" >= "issue_date");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amounts_valid" CHECK ("subtotal_minor" >= 0 AND "discount_minor" >= 0 AND "tax_minor" >= 0 AND "grand_total_minor" >= 0 AND "paid_total_minor" >= 0 AND "balance_due_minor" >= 0 AND "paid_total_minor" + "balance_due_minor" = "grand_total_minor");
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_amounts_valid" CHECK ("quantity" > 0 AND "unit_price_minor" >= 0 AND "discount_minor" >= 0 AND "tax_rate_bps" BETWEEN 0 AND 10000 AND "tax_minor" >= 0 AND "line_total_minor" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amounts_valid" CHECK ("amount_minor" > 0 AND "refunded_minor" >= 0 AND "refunded_minor" <= "amount_minor");
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_amount_positive" CHECK ("amount_minor" > 0);
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_positive" CHECK ("amount_minor" > 0);
