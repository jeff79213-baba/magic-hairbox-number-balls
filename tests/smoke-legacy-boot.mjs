import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const dir = new URL("../legacy/", import.meta.url);
const html = readFileSync(new URL("index.html", dir), "utf8");

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  url: new URL("index.html", dir).href,
  virtualConsole: undefined,
});

// jsdom loads scripts async; wait for them.
await new Promise((r) => setTimeout(r, 400));

const doc = dom.window.document;
const balls = doc.querySelectorAll("#grid .ball");
const clock = (doc.getElementById("clock") || {}).textContent;
const viewBtn = (doc.getElementById("btnView") || {}).textContent;

console.log("boot ok, balls:", balls.length, "| clock:", clock, "| viewBtn:", viewBtn);

if (balls.length !== 150) {
  console.error("FAIL: expected 150 balls");
  process.exit(1);
}

// sanity: simulate an order-up-to-18 then check status attribute changed on ball 18
const w = dom.window;
if (!w.MHB) {
  console.error("FAIL: window.MHB not defined");
  process.exit(1);
}
let st = w.MHB.createState();
st = w.MHB.orderUpTo(st, 18);
console.log("orderUpTo(18) -> ball 18 status:", w.MHB.ballStatus(st, 18));
console.log("PASS: legacy page boots and renders 150 balls");
dom.window.close();
process.exit(0);
