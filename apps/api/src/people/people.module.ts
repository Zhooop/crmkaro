import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { PeopleController } from "./people.controller.js";
import { PeopleService } from "./people.service.js";

@Module({ imports: [AuthModule, AccessModule], controllers: [PeopleController], providers: [PeopleService] })
export class PeopleModule {}
