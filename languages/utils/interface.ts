import { writeFile } from "node:fs";
import enUS from "../en-US.js";

const interfaceMap = new Map<string, string[]>();

for (const [key, value] of Object.entries(enUS)) {
	interfaceMap.set(
		key,
		typeof value === "string"
			? [...value.matchAll(/{{(.*?)}}/g)]
					.map((match) => match[1])
					.filter(Boolean)
					.map((match) => match!)
			: [],
	);
}

writeFile(
	"./typings/language.d.ts",
	`/* eslint-disable typescript-sort-keys/interface */\n\nexport interface LanguageValues {\n${[
		...interfaceMap.entries(),
	]
		.map(([key, value]) => `${key}: {${[...new Set(value)].map((val) => `${val}: any`).join(", ")}}`)
		.join(",\n")}\n}`,
	() => {},
);

const interfaceArray = [...interfaceMap];

console.log(
	`Generated an interface for ${interfaceArray.length} keys, ${
		interfaceArray.filter(([_, value]) => value.length > 0).length
	} of which have typed objects.`,
);
