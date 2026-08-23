import { encodeCallback } from "../../callbacks/callback-data";
import type { Callback } from "../../callbacks/callback-data.types";
import type { InlineButton } from "../screen.types";

export const button = (text: string, callback: Callback): InlineButton => ({
	text,
	callback_data: encodeCallback(callback),
});
