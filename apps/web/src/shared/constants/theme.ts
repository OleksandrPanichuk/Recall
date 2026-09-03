export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "recall.theme";

export const noFlashScript = (key = THEME_STORAGE_KEY): string =>
	`try{var t=localStorage.getItem('${key}');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
