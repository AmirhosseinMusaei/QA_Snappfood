import { test, expect } from "@playwright/test";
test("unauthenticated visit has empty login fields and no automatic administrator login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("نام کاربری")).toHaveValue("");
  await expect(page.getByLabel("رمز عبور")).toHaveValue("");
  await expect(page.getByText("snappfood123")).toHaveCount(0);
});
for (const [username, heading] of [
  ["mahya", "کارنامه و نمرات من"],
  ["negin", "داشبورد تیم من"],
  ["mgr_sales", "داشبورد واحد"],
]) {
  test(
    username + " restores the correct role screen without render crashes",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      await page.getByLabel("نام کاربری").fill(username);
      await page.getByLabel("رمز عبور").fill("snappfood123");
      await page
        .getByRole("button", { name: "ورود به سامانه", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    },
  );
}
