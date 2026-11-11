// Runs the RYM userscript's parsers (<rym-core> block) on saved RYM pages in headless Chrome.
// bun test/rym-parse.cdp.ts <page.html>...   prints each page's ingest payload summary as JSON.
import { readFileSync } from "fs";
const src = readFileSync(new URL("../userscripts/rym.user.js", import.meta.url), "utf8");
const core = src.slice(src.indexOf("// <rym-core>"), src.indexOf("// </rym-core>"));
const port = 9334, prof = `${process.env.TMPDIR}/rym-parse-profile`;
const p = Bun.spawn(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, "--headless=new", "about:blank"], { stderr: "ignore" });
let tabs: any[] = [];
for (let i = 0; i < 40; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.length) break; } catch {} await Bun.sleep(250); }
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
let id = 0; const pending = new Map<number, (r: any) => void>();
ws.onmessage = (e) => { const m = JSON.parse(e.data as string); pending.get(m.id)?.(m.result); pending.delete(m.id); };
await new Promise((r) => (ws.onopen = r));
const send = (method: string, params = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const out: any = {};
for (const f of process.argv.slice(2)) {
  const html = readFileSync(f, "utf8");
  const url = (html.match(/Source URL: (\S+)/) || [])[1];
  await send("Page.navigate", { url: "file://" + f });
  await Bun.sleep(700);
  const r = await send("Runtime.evaluate", { returnByValue: true, expression: `(() => { ${core}; return RYMCore.parse(document, ${JSON.stringify(url)}) || { none: RYMCore.pageKind(${JSON.stringify(url)}) }; })()` });
  out[f.split("/").pop()!] = r?.result?.value ?? r?.exceptionDetails?.exception?.description;
}
console.log(JSON.stringify(out, null, 1));
p.kill(); process.exit(0);
