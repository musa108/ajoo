"""
Browser end-to-end test against the LOCAL stack (anvil + `next start`).

  ./scripts/dev-local.sh                      # chain + contracts + seed
  npm run build:web && npm run start -w apps/web
  python3 scripts/e2e_browser.py

A tiny EIP-1193 shim stands in for a wallet and forwards to anvil's unlocked dev accounts, so the real UI,
wagmi hooks and contracts are exercised. Needs `pip install playwright` and a Chromium build.
"""
import json, re, sys, os
from playwright.sync_api import sync_playwright, expect

APP = os.environ.get("APP_URL", "http://127.0.0.1:3000")
RPC = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
SHOTS = os.environ.get("SHOTS", "/tmp/shots")
os.makedirs(SHOTS, exist_ok=True)

ACCOUNTS = {  # anvil default mnemonic, local only
    1: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",  # Ada
    2: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",  # Tunde (organizer of Ikeja)
    4: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",  # Musa
    5: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",  # Bisi
    6: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",  # Chidi
}
BALOGUN = os.environ.get("BALOGUN", "0x5392A33F7F677f59e833FEBF4016cDDD88fF9E67")
IKEJA = os.environ.get("IKEJA", "0xa783CDc72e34a174CCa57a6d9a74904d0Bec05A9")

SHIM = """
(() => {
  const RPC = %s, ACCOUNT = %s; let id = 0; const L = {};
  const rpc = async (method, params = []) => {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
    const j = await r.json(); if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; } return j.result;
  };
  window.ethereum = { isMetaMask: true,
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [ACCOUNT];
      if (method === 'wallet_switchEthereumChain') return null;
      if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }];
      return rpc(method, params);
    },
    on(ev, fn) { (L[ev] ||= []).push(fn); }, removeListener(ev, fn) { L[ev] = (L[ev] || []).filter(f => f !== fn); } };
})();
"""

results, problems = [], []

def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))

def new_page(browser, who=None, w=1280, h=900):
    ctx = browser.new_context(viewport={"width": w, "height": h})
    if who:
        ctx.add_init_script(SHIM % (json.dumps(RPC), json.dumps(ACCOUNTS[who])))
    page = ctx.new_page()
    page.on("pageerror", lambda e: problems.append(f"pageerror: {e}"))
    page.on("console", lambda m: problems.append(f"console.{m.type}: {m.text[:200]}") if m.type == "error" else None)
    page.set_default_timeout(25000)
    return ctx, page

def connect(page):
    page.get_by_role("button", name="Connect wallet").first.click()
    expect(page.get_by_role("button", name="Disconnect wallet")).to_be_visible()

def pay_cycle(page):
    """Approve if the wallet has not already approved this circle, then pay the cycle."""
    approve = page.get_by_role("button", name=re.compile(r"Approve \$\d+ for this circle"))
    pay = page.get_by_role("button", name="Pay $5")
    expect(approve.or_(pay)).to_be_visible()
    if approve.count():
        approve.click()
    pay.click()
    expect(page.get_by_text("You paid $5 for this cycle")).to_be_visible()

def click_and_settle(page, name_regex):
    page.get_by_role("button", name=re.compile(name_regex)).click()

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------------------------------------------------------------- landing, responsive
        for label, (w, h) in {"desktop": (1440, 900), "mobile": (390, 844)}.items():
            ctx, page = new_page(browser, None, w, h)
            page.goto(APP + "/")
            expect(page.get_by_role("heading", level=1)).to_contain_text("Save together")
            page.wait_for_timeout(1200)
            overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"landing {label}: no horizontal overflow", overflow <= 0, f"overflow={overflow}")
            bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
            check(f"landing {label}: body background is light and chromatic", bg == "rgb(242, 244, 255)", bg)
            page.screenshot(path=f"{SHOTS}/landing-{label}.png", full_page=True)
            ctx.close()

        # ---------------------------------------------------------------- explorer (read path through batched RPC)
        ctx, page = new_page(browser, None)
        page.goto(APP + "/circles")
        expect(page.get_by_text("Balogun Market Women")).to_be_visible()
        expect(page.get_by_text("Ikeja Dev Savers")).to_be_visible()
        expect(page.get_by_text("Starter Circle")).to_be_visible()
        check("explorer lists the three seeded circles", True)
        page.get_by_role("button", name="Open to join").click()
        check("filter 'Open to join' hides active circles", page.get_by_text("Balogun Market Women").count() == 0)
        page.screenshot(path=f"{SHOTS}/circles.png", full_page=True)
        ctx.close()

        # ---------------------------------------------------------------- create a circle as Ada, join, then fill with two more wallets
        ctx, page = new_page(browser, 1)
        page.goto(APP + "/circles/new")
        connect(page)
        page.get_by_role("button", name="Create circle").click()
        expect(page.get_by_text("Give the circle a name")).to_be_visible()
        focused = page.evaluate("document.activeElement && document.activeElement.getAttribute('name')")
        check("create form: submit with empty name shows error and focuses the field", focused == "name", str(focused))
        page.get_by_label(re.compile("Circle name")).fill("E2E Test Circle")
        page.get_by_label(re.compile("Number of people")).select_option("3")
        page.get_by_label(re.compile("How often")).select_option(label="Demo: every 5 minutes")
        expect(page.get_by_text("3 people put in $5 every 5 minutes")).to_be_visible()
        page.screenshot(path=f"{SHOTS}/create.png", full_page=True)
        page.get_by_role("button", name="Create circle").click()
        page.wait_for_url(re.compile(r"/circles/0x[0-9a-fA-F]{40}"))
        e2e = re.search(r"/circles/(0x[0-9a-fA-F]{40})", page.url).group(1)
        check("create form: new circle created and page opened", True, e2e)
        expect(page.get_by_text("Circle created. Join it yourself")).to_be_visible()

        page.get_by_role("button", name=re.compile(r"Approve \$5 deposit")).click()
        expect(page.get_by_role("button", name="Join circle")).to_be_visible()
        page.get_by_role("button", name="Join circle", exact=True).click()
        expect(page.get_by_role("heading", name="You are in")).to_be_visible()
        check("join flow: approve then join as Ada", True)
        page.screenshot(path=f"{SHOTS}/circle-open.png", full_page=True)
        ctx.close()

        for who in (5, 6):
            ctx, page = new_page(browser, who)
            page.goto(f"{APP}/circles/{e2e}")
            connect(page)
            page.get_by_role("button", name=re.compile(r"Approve \$5 deposit")).click()
            page.get_by_role("button", name="Join circle", exact=True).click()
            expect(page.get_by_text(re.compile(r"You are in|Cycle 1 of 3"))).to_be_visible()
            ctx.close()
        ctx, page = new_page(browser, 1)
        page.goto(f"{APP}/circles/{e2e}")
        connect(page)
        expect(page.get_by_role("heading", name=re.compile("Cycle 1 of 3"))).to_be_visible()
        check("circle becomes active when the last seat fills", True)

        # ---------------------------------------------------------------- pay + settle all three cycles of the E2E circle
        page.get_by_role("button", name=re.compile(r"Approve \$15 for this circle")).click()
        page.get_by_role("button", name="Pay $5").click()
        expect(page.get_by_text("You paid $5 for this cycle")).to_be_visible()
        check("pay flow: Ada approves and pays cycle 1", True)
        ctx.close()
        for who in (5, 6):
            ctx, page = new_page(browser, who)
            page.goto(f"{APP}/circles/{e2e}")
            connect(page)
            page.get_by_role("button", name=re.compile(r"Approve \$15 for this circle")).click()
            page.get_by_role("button", name="Pay $5").click()
            expect(page.get_by_text("You paid $5 for this cycle")).to_be_visible()
            if who == 6:
                page.get_by_role("button", name="Settle cycle 1").click()
                expect(page.get_by_role("heading", name=re.compile("Cycle 2 of 3|Cycle 2"))).to_be_visible()
                check("settle flow: anyone settles once all paid, next cycle starts", True)
                page.screenshot(path=f"{SHOTS}/circle-active.png", full_page=True)
            ctx.close()

        # ---------------------------------------------------------------- seeded Balogun circle: Musa pays, Bisi pays, settle
        ctx, page = new_page(browser, 4, 1280, 1000)
        page.goto(f"{APP}/circles/{BALOGUN}")
        connect(page)
        expect(page.get_by_role("heading", name=re.compile("Cycle 3 of 5"))).to_be_visible()
        expect(page.get_by_role("region", name=re.compile("Payment ledger"))).to_be_visible()
        covered = page.get_by_label(re.compile(r"cycle 2: missed, covered by deposit")).count()
        check("ledger shows the covered default from the seed", covered == 1, f"covered cells={covered}")
        page.screenshot(path=f"{SHOTS}/ledger-seeded.png", full_page=True)
        pay_cycle(page)
        check("seeded circle: Musa pays cycle 3 (allowance already granted, no approve step)", True)
        ctx.close()

        ctx, page = new_page(browser, 5)
        page.goto(f"{APP}/circles/{BALOGUN}")
        connect(page)
        pay_cycle(page)
        page.get_by_role("button", name="Settle cycle 3").click()
        expect(page.get_by_role("heading", name=re.compile("Cycle 4 of 5"))).to_be_visible()
        page.get_by_role("region", name=re.compile("Payment ledger")).scroll_into_view_if_needed()
        paid_cells = page.get_by_label(re.compile(r"cycle 3: paid on time")).count()
        check("seeded circle: Bisi pays, cycle 3 settles, ledger shows 5 on-time cells", paid_cells == 5, f"paid cells={paid_cells}")
        page.screenshot(path=f"{SHOTS}/ledger-after-settle.png", full_page=True)
        ctx.close()

        # ---------------------------------------------------------------- cancel dialog (organizer of Ikeja = Tunde)
        ctx, page = new_page(browser, 2)
        page.goto(f"{APP}/circles/{IKEJA}")
        connect(page)
        page.get_by_role("button", name="Cancel this circle").click()
        dlg = page.get_by_role("dialog")
        expect(dlg).to_be_visible()
        overlay_bg = page.evaluate("getComputedStyle(document.querySelector('[data-state=open][aria-hidden], div[data-state=open].fixed')||document.body).backgroundColor")
        page.screenshot(path=f"{SHOTS}/dialog.png")
        page.keyboard.press("Escape")
        expect(dlg).to_have_count(0)
        check("cancel dialog opens and Escape closes it without cancelling", True)
        ctx.close()

        # ---------------------------------------------------------------- record + credit (Ada has score 500 from the seed)
        ctx, page = new_page(browser, 1)
        page.goto(APP + "/record")
        connect(page)
        expect(page.get_by_text("Reputation score")).to_be_visible()
        score_txt = page.locator("p.font-display").first.inner_text()
        score = int(re.search(r"\d+", score_txt).group(0))
        check("record page shows Ada's score (500 seeded + on-time payments earned during this run)", 500 <= score <= 600, score_txt)
        page.screenshot(path=f"{SHOTS}/record.png", full_page=True)

        page.get_by_role("link", name="Credit", exact=True).click()
        expect(page.get_by_role("heading", name="Borrow")).to_be_visible()
        limit = (score - 400) // 2  # $0.50 of credit per point above 400
        expect(page.get_by_text(re.compile(rf"up to\s*\$ ?{limit}\b"))).to_be_visible()
        check(f"credit limit follows the score: ${limit} at score {score}", True)
        page.get_by_label(re.compile("Amount")).fill("20")
        expect(page.get_by_text(re.compile(r"A fee of \$0\.60"))).to_be_visible()
        page.get_by_role("button", name="Borrow $20").click()
        expect(page.get_by_role("heading", name="Your loan")).to_be_visible()
        check("credit: Ada borrows $20 against her score", True)
        page.screenshot(path=f"{SHOTS}/credit-loan.png", full_page=True)
        approve = page.get_by_role("button", name=re.compile(r"Approve \$20\.60"))
        repay = page.get_by_role("button", name=re.compile(r"Repay \$20\.60"))
        expect(approve.or_(repay)).to_be_visible()
        if approve.count():
            approve.click()
        repay.click()
        expect(page.get_by_role("heading", name="Borrow")).to_be_visible()
        check("credit: Ada repays the loan in full", True)
        ctx.close()

        browser.close()

    print("\n---- browser problems (console errors / page errors):", len(problems))
    for pr in problems[:15]:
        print("  ", pr)
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
