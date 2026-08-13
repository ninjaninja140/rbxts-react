/**
 * JSDoc API Documentation Generator for @nrbx/react
 *
 * Parses JSDoc comments from TypeScript source files and generates
 * GitHub Wiki-compatible markdown documentation.
 *
 * Usage:
 *   npx ts-node scripts/generate-api-docs.ts
 *   npx ts-node scripts/generate-api-docs.ts --output docs/wiki/reference/API-Reference.md
 *   npx ts-node scripts/generate-api-docs.ts --json docs/wiki/api.json
 */

import * as fs from "fs";
import * as path from "path";


interface JSDocTag {
	tag: string;
	name?: string;
	type?: string;
	description: string;
}

interface JSDocBlock {
	description: string;
	tags: JSDocTag[];
	raw: string;
}

interface ExportedSymbol {
	name: string;
	kind: "function" | "class" | "interface" | "type" | "const" | "enum";
	jsdoc: JSDocBlock;
	exportLine: number;
	filePath: string;
	modulePath: string;
	signature?: string;
}


function parseJSDoc(raw: string): JSDocBlock {
	const lines = raw
		.replace(/^\/\*\*|\*\/$/g, "")
		.split("\n")
		.map((line) => line.replace(/^\s*\*\s?/, "").trimEnd());

	let description = "";
	const tags: JSDocTag[] = [];
	let inDescription = true;
	let currentTag: JSDocTag | null = null;

	for (const line of lines) {
		const tagMatch = line.match(/^@(\w+)(?:\s+|$)/);
		if (tagMatch) {
			inDescription = false;
			if (currentTag) {
				tags.push(currentTag);
			}
			const tagName = tagMatch[1];
			const rest = line.slice(tagMatch[0].length).trim();

			const paramMatch = rest.match(/^\{([^}]+)\}\s+(\S+)(?:\s*-\s*(.*))?$/);
			const paramSimple = rest.match(/^(\S+)\s*-\s*(.*)$/);
			const returnMatch = rest.match(/^\{([^}]+)\}\s*(.*)$/);

			if (tagName === "param" && paramMatch) {
				currentTag = {
					tag: "param",
					type: paramMatch[1],
					name: paramMatch[2],
					description: paramMatch[3] || "",
				};
			} else if (tagName === "param" && paramSimple) {
				currentTag = {
					tag: "param",
					name: paramSimple[1],
					description: paramSimple[2] || "",
				};
			} else if (tagName === "returns" && returnMatch) {
				currentTag = {
					tag: "returns",
					type: returnMatch[1],
					description: returnMatch[2],
				};
			} else if (tagName === "returns") {
				currentTag = {
					tag: "returns",
					description: rest,
				};
			} else {
				currentTag = {
					tag: tagName,
					description: rest,
				};
			}
		} else if (inDescription) {
			if (line) {
				description += (description ? " " : "") + line;
			} else if (description) {
				description += "\n\n";
			}
		} else if (currentTag) {
			if (line) {
				currentTag.description += (currentTag.description ? " " : "") + line;
			}
		}
	}

	if (currentTag) {
		tags.push(currentTag);
	}

	return { description: description.trim(), tags, raw };
}

function findJSDocBlocks(content: string): Array<{ block: JSDocBlock; endIndex: number }> {
	const blocks: Array<{ block: JSDocBlock; endIndex: number }> = [];
	const regex = /\/\*\*[\s\S]*?\*\//g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(content)) !== null) {
		blocks.push({
			block: parseJSDoc(match[0]),
			endIndex: match.index + match[0].length,
		});
	}

	return blocks;
}


function extractSignature(lines: string[], startLine: number): string | undefined {
	let sig = "";
	let parenDepth = 0;
	let braceDepth = 0;
	let angleDepth = 0;
	let started = false;

	for (let i = startLine; i < Math.min(startLine + 30, lines.length); i++) {
		const line = lines[i];
		for (let j = 0; j < line.length; j++) {
			const ch = line[j];
			if (ch === "(") parenDepth++;
			if (ch === ")") parenDepth--;
			if (ch === "{") braceDepth++;
			if (ch === "}") braceDepth--;
			if (ch === "<") angleDepth++;
			if (ch === ">") angleDepth--;

			sig += ch;

			if (started && parenDepth === 0 && braceDepth === 0 && angleDepth === 0) {
				const rest = line.slice(j + 1).trim();
				if (rest.startsWith(";") || rest.startsWith("{") || rest === "") {
					return sig.trim();
				}
			}
			started = true;
		}
		if (started && parenDepth === 0 && braceDepth === 0 && angleDepth === 0) {
			if (i + 1 < lines.length) {
				const nextLine = lines[i + 1].trim();
				if (nextLine.startsWith("{") || nextLine === "") {
					return sig.trim();
				}
			}
			return sig.trim();
		}
	}
	return sig.trim() || undefined;
}

function parseExport(
	line: string,
	lines: string[],
	lineIdx: number,
): { kind: ExportedSymbol["kind"]; name: string; signature?: string } | null {
	const trimmed = line.trim();

	const funcMatch = trimmed.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
	if (funcMatch) {
		const sig = extractSignature(lines, lineIdx);
		return { kind: "function", name: funcMatch[1], signature: sig };
	}

	const classMatch = trimmed.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
	if (classMatch) {
		return { kind: "class", name: classMatch[1] };
	}

	const ifaceMatch = trimmed.match(/^export\s+interface\s+(\w+)/);
	if (ifaceMatch) {
		return { kind: "interface", name: ifaceMatch[1] };
	}

	const typeMatch = trimmed.match(/^export\s+type\s+(\w+)\s*=/);
	if (typeMatch) {
		return { kind: "type", name: typeMatch[1] };
	}

	const constMatch = trimmed.match(/^export\s+const\s+(\w+)/);
	if (constMatch) {
		const sig = extractSignature(lines, lineIdx);
		return { kind: "const", name: constMatch[1], signature: sig };
	}

	const enumMatch = trimmed.match(/^export\s+enum\s+(\w+)/);
	if (enumMatch) {
		return { kind: "enum", name: enumMatch[1] };
	}

	return null;
}


function processFile(filePath: string, packageDir: string): ExportedSymbol[] {
	const content = fs.readFileSync(filePath, "utf8");
	const lines = content.split("\n");
	const blocks = findJSDocBlocks(content);

	const symbols: ExportedSymbol[] = [];

	for (const { block, endIndex } of blocks) {
		if (block.tags.some((t) => t.tag === "packageDocumentation" || t.tag === "module")) {
			continue;
		}

		let charCount = 0;
		let lineIdx = 0;
		for (let i = 0; i < lines.length; i++) {
			charCount += lines[i].length + 1;
			if (charCount > endIndex) {
				lineIdx = i;
				break;
			}
		}

		for (let offset = 0; offset < 5; offset++) {
			const checkLine = lineIdx + offset;
			if (checkLine >= lines.length) break;

			const result = parseExport(lines[checkLine], lines, checkLine);
			if (result) {
				const modulePath = path
					.relative(packageDir, filePath)
					.replace(/\\/g, "/")
					.replace(/\.ts$/, "")
					.replace(/\/index$/, "");

				symbols.push({
					...result,
					jsdoc: block,
					exportLine: checkLine + 1,
					filePath,
					modulePath,
				});
				break;
			}

			const trimmed = lines[checkLine].trim();
			if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("/*")) {
				break;
			}
		}
	}

	return symbols;
}


function formatParams(params: JSDocTag[]): string {
	if (params.length === 0) return "";

	let table = "| Parameter | Type | Description |\n";
	table += "|-----------|------|-------------|\n";
	for (const p of params) {
		const type = p.type ? `\`${p.type}\`` : "—";
		const desc = p.description || "—";
		table += `| \`${p.name || "—"}\` | ${type} | ${desc} |\n`;
	}
	return table;
}

function formatReturns(tags: JSDocTag[]): string {
	const rt = tags.find((t) => t.tag === "returns");
	if (!rt) return "";
	if (rt.type) {
		return `**Returns:** \`${rt.type}\`${rt.description ? ` — ${rt.description}` : ""}`;
	}
	return `**Returns:** ${rt.description}`;
}

function symbolToMarkdown(sym: ExportedSymbol): string {
	let md = "";

	const anchor = sym.name.toLowerCase();
	md += `### ${sym.name} <a id="${anchor}"></a>\n\n`;

	const kindBadges: Record<string, string> = {
		function: "`[function]`",
		class: "`[class]`",
		interface: "`[interface]`",
		type: "`[type]`",
		const: "`[const]`",
		enum: "`[enum]`",
	};
	md += `${kindBadges[sym.kind] || ""}\n\n`;

	if (sym.signature) {
		md += "```ts\n";
		md += `${sym.signature}\n`;
		md += "```\n\n";
	}

	if (sym.jsdoc.description) {
		md += sym.jsdoc.description + "\n\n";
	}

	const params = sym.jsdoc.tags.filter((t) => t.tag === "param");
	if (params.length > 0) {
		md += "**Parameters:**\n\n";
		md += formatParams(params) + "\n\n";
	}

	const returnsText = formatReturns(sym.jsdoc.tags);
	if (returnsText) {
		md += returnsText + "\n\n";
	}

	const otherTags = sym.jsdoc.tags.filter(
		(t) => t.tag !== "param" && t.tag !== "returns",
	);
	for (const tag of otherTags) {
		md += `**@${tag.tag}:** ${tag.description}\n\n`;
	}

	const relPath = path.relative(process.cwd(), sym.filePath);
	md += `<sub>Source: [${relPath}](${relPath}#L${sym.exportLine})</sub>\n\n`;
	md += "---\n\n";
	return md;
}


function findPackages(baseDir: string): string[] {
	const pkgs: string[] = [];
	const packagesDir = path.join(baseDir, "packages");
	if (!fs.existsSync(packagesDir)) return pkgs;

	for (const entry of fs.readdirSync(packagesDir)) {
		const fullPath = path.join(packagesDir, entry);
		if (fs.statSync(fullPath).isDirectory()) {
			const srcDir = path.join(fullPath, "src");
			if (fs.existsSync(srcDir)) {
				pkgs.push(fullPath);
			}
		}
	}
	return pkgs;
}

function walkDir(dir: string): string[] {
	const files: string[] = [];
	for (const entry of fs.readdirSync(dir)) {
		const full = path.join(dir, entry);
		if (fs.statSync(full).isDirectory()) {
			if (entry !== "__tests__" && entry !== "node_modules") {
				files.push(...walkDir(full));
			}
		} else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
			files.push(full);
		}
	}
	return files;
}

function generateMarkdownDocs(packages: string[]): string {
	let md = "# API Reference\n\n";
	md += "> Auto-generated from JSDoc comments. Do not edit directly.\n\n";

	md += "## Table of Contents\n\n";

	for (const pkgDir of packages) {
		const pkgName = path.basename(pkgDir);
		md += `- [@nrbx/${pkgName}](#nrbx${pkgName})\n`;

		const files = walkDir(path.join(pkgDir, "src"));
		const symbols: ExportedSymbol[] = [];
		for (const file of files) {
			symbols.push(...processFile(file, pkgDir));
		}

		const byModule = new Map<string, ExportedSymbol[]>();
		for (const sym of symbols) {
			const mod = sym.modulePath;
			if (!byModule.has(mod)) byModule.set(mod, []);
			byModule.get(mod)!.push(sym);
		}

		for (const [mod, syms] of byModule) {
			const modName = mod || "index";
			const anchor = `${pkgName}-${modName}`.replace(/[^a-z0-9-]/gi, "").toLowerCase();
			md += `  - [${modName}](#${anchor})\n`;
		}
	}

	md += "\n---\n\n";

	for (const pkgDir of packages) {
		const pkgName = path.basename(pkgDir);
		md += `## @nrbx/${pkgName} <a id="nrbx${pkgName}"></a>\n\n`;

		const files = walkDir(path.join(pkgDir, "src"));
		const allSymbols: ExportedSymbol[] = [];
		for (const file of files) {
			allSymbols.push(...processFile(file, pkgDir));
		}

		const byModule = new Map<string, ExportedSymbol[]>();
		for (const sym of allSymbols) {
			const mod = sym.modulePath;
			if (!byModule.has(mod)) byModule.set(mod, []);
			byModule.get(mod)!.push(sym);
		}

		for (const [mod, syms] of byModule) {
			const modName = mod || "index";
			const anchor = `${pkgName}-${modName}`.replace(/[^a-z0-9-]/gi, "").toLowerCase();
			md += `### Module: \`${modName}\` <a id="${anchor}"></a>\n\n`;

			for (const sym of syms) {
				md += symbolToMarkdown(sym);
			}
		}
	}

	return md;
}


function main() {
	const args = process.argv.slice(2);
	const baseDir = process.cwd();
	const packages = findPackages(baseDir);

	if (packages.length === 0) {
		console.error("No packages found in packages/ directory");
		process.exit(1);
	}

	console.log(`Found ${packages.length} package(s): ${packages.map((p) => path.basename(p)).join(", ")}`);

	const isJSON = args.includes("--json");
	const outputIdx = args.indexOf("--output");
	const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;

	if (isJSON) {
		const allSymbols: ExportedSymbol[] = [];
		for (const pkgDir of packages) {
			const files = walkDir(path.join(pkgDir, "src"));
			for (const file of files) {
				allSymbols.push(...processFile(file, pkgDir));
			}
		}

		const json = JSON.stringify(allSymbols, null, 2);
		if (outputPath) {
			fs.writeFileSync(outputPath, json, "utf8");
			console.log(`Wrote JSON to ${outputPath}`);
		} else {
			process.stdout.write(json);
		}
	} else {
		const md = generateMarkdownDocs(packages);
		if (outputPath) {
			fs.writeFileSync(outputPath, md, "utf8");
			console.log(`Wrote markdown to ${outputPath}`);
		} else {
			const defaultOut = path.join(baseDir, "docs", "wiki", "reference", "API-Reference.md");
			const dir = path.dirname(defaultOut);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(defaultOut, md, "utf8");
			console.log(`Wrote markdown to ${defaultOut}`);
		}
	}
}

main();
