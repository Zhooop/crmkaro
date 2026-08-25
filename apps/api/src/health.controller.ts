import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      service: "crmkaro-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}

