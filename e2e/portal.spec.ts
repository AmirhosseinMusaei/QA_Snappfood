import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, username: string) {
  await page.goto("/");
  await page.getByLabel("نام کاربری", { exact: true }).fill(username);
  await page.getByLabel("رمز عبور", { exact: true }).fill("snappfood123");
  await page
    .getByRole("button", { name: "ورود به سامانه", exact: true })
    .click();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("header")).toBeVisible();
}
async function openMenu(page: Page) {
  const button = page.getByRole("button", { name: "منوی ناوبری", exact: true });
  if (await button.isVisible()) {
    if ((await button.getAttribute("aria-expanded")) !== "true")
      await button.click();
  }
}
test("unauthenticated visit has empty login fields and no automatic administrator login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("نام کاربری", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("رمز عبور", { exact: true })).toHaveValue("");
  await expect(page.getByText("snappfood123")).toHaveCount(0);
});
for (const [username, heading] of [
  ["mahya", /محیا/],
  ["negin", /داشبورد سرپرستی/],
  ["mgr_sales", /گزارش‌های مدیریتی/],
]) {
  test(`${username} retains the original dashboard and restores its session`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page, username);
    await expect(page.locator("main h1").first()).toContainText(heading);
    await expect(page.getByRole("status")).toHaveCount(0);
    if (username === "mgr_sales") {
      await expect(
        page.getByText("High / Low Quality Matrix", { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByText("Fault Categories", { exact: false }),
      ).toBeVisible();
    }
    if (username === "negin")
      await expect(
        page.getByText("تغییر سرپرست:", { exact: true }),
      ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`${username}-dashboard.png`),
      fullPage: true,
    });
    await page.reload();
    await expect(page.locator("main h1").first()).toContainText(heading);
    expect(errors).toEqual([]);
  });
}
for (const username of ["admin", "supervisor"]) {
  test(`${username} compact navigation fits and keeps original screens usable`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page, username);
    const toggle = page.getByRole("button", {
      name: "منوی ناوبری",
      exact: true,
    });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      await page
        .locator("header")
        .evaluate((el) => el.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await toggle.click();
    await expect(page.locator("#main-navigation-panel")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${username}-navigation.png`),
    });
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await toggle.click();
    if (username === "admin")
      await expect(
        page
          .locator("#main-navigation-panel")
          .getByRole("button", { name: "میز ارزیابی جدید", exact: true }),
      ).toHaveCount(0);
    await page
      .locator("#main-navigation-panel")
      .getByRole("button", { name: "تحلیل کلان واحدها", exact: true })
      .click();
    await expect(page.locator("main h1")).toContainText("گزارش‌های مدیریتی");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`${username}-manager-original-layout.png`),
      fullPage: true,
    });
    await openMenu(page);
    await page
      .locator("#main-navigation-panel")
      .getByRole("button", { name: "گزارش‌ها", exact: true })
      .click();
    await expect(page.locator("main h1")).toContainText(
      "گزارش‌های جامع مدیریتی",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    const exportButton = page.getByRole("button", { name: /خروجی اکسل/ });
    await expect(exportButton).toBeVisible();
    const download = page.waitForEvent("download");
    await exportButton.click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
    await openMenu(page);
    await page
      .locator("#main-navigation-panel")
      .getByRole("button", { name: "تاریخچه ارزیابی‌ها", exact: true })
      .click();
    await expect(page.locator("main h1")).toContainText("لیست و تاریخچه");
    await expect(page.getByRole("status")).toHaveCount(0);
    if (username === "admin")
      await expect(page.locator('main button[title*="ویرایش"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
test("controller original dispute queue has canonical states and no render errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "meysam");
  await openMenu(page);
  await page
    .getByRole("button", { name: /رسیدگی به اعتراضات/ })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.locator("main h1")).toContainText("کارتابل اعتراضات");
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(errors).toEqual([]);
});
