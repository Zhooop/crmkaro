import { BadRequestException } from "@nestjs/common";
import type { ZodType } from "zod";

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      message: "Some fields need attention.",
      fields: result.error.flatten().fieldErrors,
    });
  }

  return result.data;
}

