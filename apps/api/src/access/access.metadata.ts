import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@crmkaro/permissions";

export const PERMISSIONS_KEY = "crmkaro.permissions";
export const SERVICE_KEY = "crmkaro.service";

export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
export const RequireService = (serviceCode: string) => SetMetadata(SERVICE_KEY, serviceCode);
