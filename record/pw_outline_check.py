from playwright.sync_api import sync_playwright
import sys

URL = "http://localhost:5173/#/projectDetail?id=2"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

        responses = []

        def handle_response(response):
            url = response.url
            if "outline" in url:
                try:
                    body = response.text()
                except Exception:
                    body = "<non-text response>"
                responses.append({
                    "url": url,
                    "status": response.status,
                    "body": body[:1000],
                })

        page.on("response", handle_response)

        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 截图与基础信息
        page.screenshot(path="G:/anime/cosmos/record/pw_outline_check.png", full_page=True)
        print("PAGE TITLE:", page.title())

        # 打印顶部导航按钮文本（若有）
        nav_buttons = page.locator(".navBtn")
        nav_count = nav_buttons.count()
        print("NAV BTN COUNT:", nav_count)
        if nav_count > 0:
            print("NAV BTN TEXTS:", nav_buttons.all_text_contents())

        # 尝试点击第 3 个导航（大纲管理）
        if nav_count >= 3:
            nav_buttons.nth(2).click()
            page.wait_for_timeout(2000)
        else:
            print("NAV BTN NOT FOUND OR LESS THAN 3")

        # 打印右侧 tabs 文本
        tabs = page.locator(".t-tabs__nav-item")
        tab_count = tabs.count()
        print("TAB COUNT:", tab_count)
        if tab_count > 0:
            print("TAB TEXTS:", tabs.all_text_contents())

        # 尝试点击第 2 个 tab（大纲）
        if tab_count >= 2:
            tabs.nth(1).click()
            page.wait_for_timeout(2000)
        else:
            print("TAB NOT FOUND OR LESS THAN 2")

        # 再次截图
        page.screenshot(path="G:/anime/cosmos/record/pw_outline_check_after.png", full_page=True)

        browser.close()

        print("=== Console Logs (outline related) ===")
        for line in console_logs:
            if "outline" in line.lower() or "大纲" in line:
                print(line)

        print("=== Network Responses (outline) ===")
        for item in responses:
            print(f"{item['status']} {item['url']}")
            print(item['body'])
            print("---")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Playwright error:", e)
        sys.exit(1)
