import { Module } from "@nestjs/common";
import { QuizzesModule } from "@/modules/quizzes";
import { QuizzesController } from "./quizzes.controller";

@Module({
	imports: [QuizzesModule],
	controllers: [QuizzesController],
})
export class ContentModule {}
