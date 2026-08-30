import type { Socket, TCPSocketListener } from "bun";

export interface CapturedLetter {
	from: string;
	to: string;
	body: string;
}

export interface SmtpCapture {
	url: string;
	letters: CapturedLetter[];
	waitForLetter(): Promise<CapturedLetter>;
	close(): void;
}

interface Session {
	buffer: string;
	from: string;
	to: string;
	inData: boolean;
	data: string;
}

const decode = (raw: string): string => {
	const split = raw.indexOf("\r\n\r\n");
	const headers = split === -1 ? raw : raw.slice(0, split);
	const body = split === -1 ? "" : raw.slice(split + 4);
	const encoding =
		/^content-transfer-encoding:\s*(\S+)/im.exec(headers)?.[1]?.toLowerCase() ??
		"7bit";

	if (encoding === "base64") {
		return Buffer.from(body.replaceAll("\r\n", ""), "base64").toString("utf8");
	}

	if (encoding === "quoted-printable") {
		return body
			.replaceAll("=\r\n", "")
			.replaceAll(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
				String.fromCharCode(Number.parseInt(hex, 16)),
			);
	}

	return body;
};

export async function openSmtpCapture(): Promise<SmtpCapture> {
	const letters: CapturedLetter[] = [];

	const listener: TCPSocketListener<Session> = Bun.listen<Session>({
		hostname: "127.0.0.1",
		port: 0,
		socket: {
			open(socket) {
				socket.data = {
					buffer: "",
					from: "",
					to: "",
					inData: false,
					data: "",
				};
				socket.write("220 localhost ESMTP capture\r\n");
			},
			data(socket, chunk) {
				const session = socket.data;

				session.buffer += chunk.toString();

				while (session.buffer.includes("\r\n")) {
					const end = session.buffer.indexOf("\r\n");
					const line = session.buffer.slice(0, end);

					session.buffer = session.buffer.slice(end + 2);

					respond(socket, session, line, letters);
				}
			},
		},
	});

	const url = `smtp://127.0.0.1:${listener.port}`;

	return {
		url,
		letters,
		async waitForLetter() {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				const letter = letters.at(-1);

				if (letter !== undefined) {
					return letter;
				}

				await Bun.sleep(20);
			}

			throw new Error("no letter arrived within 2s");
		},
		close() {
			listener.stop(true);
		},
	};
}

function respond(
	socket: Socket<Session>,
	session: Session,
	line: string,
	letters: CapturedLetter[],
): void {
	if (session.inData) {
		if (line === ".") {
			session.inData = false;
			letters.push({
				from: session.from,
				to: session.to,
				body: decode(session.data),
			});
			socket.write("250 2.0.0 Ok\r\n");

			return;
		}

		session.data += `${line}\r\n`;

		return;
	}

	const command = line.slice(0, 4).toUpperCase();

	if (command === "EHLO" || command === "HELO") {
		socket.write("250-localhost\r\n250 8BITMIME\r\n");

		return;
	}

	if (command === "MAIL") {
		session.from = address(line);
		socket.write("250 2.1.0 Ok\r\n");

		return;
	}

	if (command === "RCPT") {
		session.to = address(line);
		socket.write("250 2.1.5 Ok\r\n");

		return;
	}

	if (command === "DATA") {
		session.inData = true;
		session.data = "";
		socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");

		return;
	}

	if (command === "QUIT") {
		socket.write("221 2.0.0 Bye\r\n");
		socket.end();

		return;
	}

	if (command === "RSET" || command === "NOOP") {
		socket.write("250 2.0.0 Ok\r\n");

		return;
	}

	socket.write("502 5.5.1 Not implemented\r\n");
}

const address = (line: string): string =>
	/<([^>]*)>/.exec(line)?.[1] ?? line.split(":").at(-1)?.trim() ?? "";
