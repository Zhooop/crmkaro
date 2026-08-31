import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./health.controller.js";
import { validateEnvironment } from "./config/environment.js";
import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { OrganisationsModule } from "./organisations/organisations.module.js";
import { AccessModule } from "./access/access.module.js";
import { PeopleModule } from "./people/people.module.js";
import { CrmModule } from "./crm/crm.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { PayrollModule } from "./payroll/payroll.module.js";
import { InventoryModule } from "./inventory/inventory.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { SearchModule } from "./search/search.module.js";
import { PlatformModule } from "./platform/platform.module.js";
import { StudentsModule } from "./students/students.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    OrganisationsModule,
    AccessModule,
    PeopleModule,
    StudentsModule,
    CrmModule,
    FinanceModule,
    PayrollModule,
    InventoryModule,
    DashboardModule,
    SearchModule,
    PlatformModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
