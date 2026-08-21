import { type ReactNode, useId } from "react";

export function Card({ children }: { children: ReactNode }) {
	return <div className="card">{children}</div>;
}

export function Field({
	label,
	value,
	onChange,
	placeholder,
	multiline = false,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	multiline?: boolean;
}) {
	const id = useId();

	return (
		<div className="field">
			<label htmlFor={id}>{label}</label>
			{multiline ? (
				<textarea
					id={id}
					value={value}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
				/>
			) : (
				<input
					id={id}
					value={value}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</div>
	);
}

export function Choice<TValue extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: TValue;
	options: readonly TValue[];
	onChange: (value: TValue) => void;
}) {
	return (
		<label className="field">
			<span>{label}</span>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value as TValue)}
			>
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		</label>
	);
}

export function Toggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="toggle">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span>{label}</span>
		</label>
	);
}

export function Failure({ error }: { error: string | undefined }) {
	if (error === undefined) {
		return null;
	}

	return <p className="bad">{error}</p>;
}
