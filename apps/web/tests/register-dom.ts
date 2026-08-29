import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (process.env.RECALL_NO_DOM !== "1" && !("document" in globalThis)) {
	GlobalRegistrator.register({ url: "http://127.0.0.1/" });
}
