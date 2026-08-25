import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: [process.env.WEB_URL ?? "http://localhost:3000", process.env.ADMIN_URL ?? "http://localhost:3001"],
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
