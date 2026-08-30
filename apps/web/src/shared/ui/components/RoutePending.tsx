export function RoutePending() {
	return (
		<div
			role="status"
			aria-label="Завантаження"
			className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent"
		>
			<div className="h-full w-1/3 animate-[recall-sweep_1s_ease-in-out_infinite] bg-primary" />
		</div>
	);
}
