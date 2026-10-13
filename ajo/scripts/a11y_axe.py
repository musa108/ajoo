"""Automated accessibility scan (axe-core, WCAG 2.1 A/AA + best practices) over every route, wallet connected where needed.
Automated checks catch roughly a third of accessibility problems. This does not replace a manual keyboard and screen-reader pass.
Usage: python3 scripts/a11y_axe.py   (local stack running)"""
import json, os, sys
from playwright.sync_api import sync_playwright

APP = os.environ.get("APP_URL", "http://127.0.0.1:3000")
RPC = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
BALOGUN = os.environ.get("BALOGUN", "0x5392A33F7F677f59e833FEBF4016cDDD88fF9E67")
ADA = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
AXE = os.path.join(os.path.dirname(__file__), "..", "node_modules", "axe-core", "axe.min.js")
SHIM = open(os.path.join(os.path.dirname(__file__), "e2e_browser.py")).read().split('SHIM = """')[1].split('"""')[0]

PAGES = [("landing", "/", False), ("circles", "/circles", False), ("create", "/circles/new", True),
         ("circle detail", f"/circles/{BALOGUN}", True), ("record", "/record", True), ("credit", "/credit", True)]
TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]

total = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h, label in ((1280, 900, "desktop"), (390, 844, "mobile")):
        for name, path, wallet in PAGES:
            ctx = b.new_context(viewport={"width": w, "height": h})
            if wallet:
                ctx.add_init_script(SHIM % (json.dumps(RPC), json.dumps(ADA)))
            pg = ctx.new_page(); pg.set_default_timeout(20000)
            pg.goto(APP + path)
            if wallet:
                pg.get_by_role("button", name="Connect wallet").first.click()
                pg.get_by_role("button", name="Disconnect wallet").wait_for()
            pg.wait_for_timeout(2500)
            pg.add_script_tag(path=AXE)
            res = pg.evaluate("axe.run(document, { runOnly: { type: 'tag', values: %s } })" % json.dumps(TAGS))
            v = res["violations"]
            total += len(v)
            print(f"{label:7} {name:14} violations: {len(v)}")
            for x in v:
                print(f"    [{x['impact']}] {x['id']}: {x['help']} ({len(x['nodes'])} nodes)")
                for n in x["nodes"][:2]:
                    print("       ", n["target"], "|", (n.get("failureSummary") or "").split("\n")[1][:140] if n.get("failureSummary") else "")
            ctx.close()
    b.close()
print("\nTOTAL violations:", total)
sys.exit(1 if total else 0)
