import { Global, Module } from "@nestjs/common";
import { createDatabaseClient } from "@crmkaro/database";

export const DATABASE = Symbol("DATABASE");

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => createDatabaseClient(),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}

