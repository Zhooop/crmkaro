import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: "15mb" }));
  app.use(urlencoded({ extended: true, limit: "15mb" }));
  if (process.env.NODE_ENV === "production") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      try {
        const url = new URL(origin);
        if (
          url.hostname === "crmkaro.com" ||
          url.hostname.endsWith(".crmkaro.com") ||
          url.hostname === "localhost" ||
          url.hostname === "127.0.0.1"
        ) {
          return callback(null, true);
        }
      } catch {
        // ignore
      }
      callback(null, true);
    },
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
