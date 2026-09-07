import { Module } from "@nestjs/common";
import { TelegramLinkController } from "./telegram-link.controller";
import { IssueLoginLinkUseCase } from "./use-cases";

@Module({
	controllers: [TelegramLinkController],
	providers: [IssueLoginLinkUseCase],
	exports: [IssueLoginLinkUseCase],
})
export class TelegramLinkModule {}
