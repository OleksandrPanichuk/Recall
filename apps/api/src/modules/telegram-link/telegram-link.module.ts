import { Module } from "@nestjs/common";
import { IssueLoginLinkUseCase } from "./use-cases";

@Module({
	providers: [IssueLoginLinkUseCase],
	exports: [IssueLoginLinkUseCase],
})
export class TelegramLinkModule {}
