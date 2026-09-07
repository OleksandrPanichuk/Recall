declare const ownerBrand: unique symbol;

export type OwnerId = string & { readonly [ownerBrand]: "OwnerId" };

export const toOwnerId = (value: string): OwnerId => {
	if (value.trim().length === 0) {
		throw new Error("an owner id cannot be blank");
	}

	return value as OwnerId;
};
