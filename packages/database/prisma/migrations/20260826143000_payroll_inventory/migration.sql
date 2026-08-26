-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'EXITED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "employee_code" VARCHAR(40) NOT NULL,
    "department" VARCHAR(100),
    "designation" VARCHAR(100),
    "joining_date" DATE NOT NULL,
    "exit_date" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "basic_minor" INTEGER NOT NULL,
    "allowances_minor" INTEGER NOT NULL DEFAULT 0,
    "deductions_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "components" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "prepared_by_id" UUID,
    "approved_by_id" UUID,
    "paid_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "payment_reference" VARCHAR(160),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_items" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "basic_minor" INTEGER NOT NULL,
    "allowances_minor" INTEGER NOT NULL,
    "deductions_minor" INTEGER NOT NULL,
    "gross_minor" INTEGER NOT NULL,
    "net_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "category_id" UUID,
    "sku" VARCHAR(80) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "unit" VARCHAR(30) NOT NULL DEFAULT 'unit',
    "purchase_price_minor" INTEGER,
    "sale_price_minor" INTEGER,
    "current_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "low_stock_threshold" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "recorded_by_id" UUID,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "stock_after" DECIMAL(14,3) NOT NULL,
    "unit_cost_minor" INTEGER,
    "reference" VARCHAR(160),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_person_id_key" ON "employees"("person_id");

-- CreateIndex
CREATE INDEX "employees_organisation_id_status_idx" ON "employees"("organisation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organisation_id_employee_code_key" ON "employees"("organisation_id", "employee_code");

-- CreateIndex
CREATE INDEX "salary_structures_organisation_id_effective_from_idx" ON "salary_structures"("organisation_id", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_employee_id_effective_from_key" ON "salary_structures"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "payroll_runs_organisation_id_status_idx" ON "payroll_runs"("organisation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organisation_id_year_month_key" ON "payroll_runs"("organisation_id", "year", "month");

-- CreateIndex
CREATE INDEX "payroll_items_organisation_id_employee_id_idx" ON "payroll_items"("organisation_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_items_payroll_run_id_employee_id_key" ON "payroll_items"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_organisation_id_name_key" ON "product_categories"("organisation_id", "name");

-- CreateIndex
CREATE INDEX "products_organisation_id_is_active_name_idx" ON "products"("organisation_id", "is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_organisation_id_sku_key" ON "products"("organisation_id", "sku");

-- CreateIndex
CREATE INDEX "stock_movements_organisation_id_product_id_created_at_idx" ON "stock_movements"("organisation_id", "product_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_prepared_by_id_fkey" FOREIGN KEY ("prepared_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY; ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
ALTER TABLE "salary_structures" ENABLE ROW LEVEL SECURITY; ALTER TABLE "salary_structures" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY; ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payroll_items" ENABLE ROW LEVEL SECURITY; ALTER TABLE "payroll_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY; ALTER TABLE "product_categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY; ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY; ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;

CREATE POLICY "employees_isolation" ON "employees" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "salary_structures_isolation" ON "salary_structures" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "payroll_runs_isolation" ON "payroll_runs" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "payroll_items_isolation" ON "payroll_items" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "product_categories_isolation" ON "product_categories" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "products_isolation" ON "products" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);
CREATE POLICY "stock_movements_isolation" ON "stock_movements" USING ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid) WITH CHECK ("organisation_id" = NULLIF(current_setting('app.current_organisation_id', true), '')::uuid);

ALTER TABLE "employees" ADD CONSTRAINT "employees_dates_valid" CHECK ("exit_date" IS NULL OR "exit_date" >= "joining_date");
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_amounts_valid" CHECK ("basic_minor" >= 0 AND "allowances_minor" >= 0 AND "deductions_minor" >= 0 AND "deductions_minor" <= "basic_minor" + "allowances_minor");
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_period_valid" CHECK ("year" BETWEEN 2000 AND 2200 AND "month" BETWEEN 1 AND 12);
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_item_amounts_valid" CHECK ("basic_minor" >= 0 AND "allowances_minor" >= 0 AND "deductions_minor" >= 0 AND "gross_minor" = "basic_minor" + "allowances_minor" AND "net_minor" = "gross_minor" - "deductions_minor" AND "net_minor" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "product_values_valid" CHECK (("purchase_price_minor" IS NULL OR "purchase_price_minor" >= 0) AND ("sale_price_minor" IS NULL OR "sale_price_minor" >= 0) AND "low_stock_threshold" >= 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movement_values_valid" CHECK ("quantity" > 0 AND ("unit_cost_minor" IS NULL OR "unit_cost_minor" >= 0));
