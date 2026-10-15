import { expect, test, type Page } from '@playwright/test';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login?next=/admin');
  const form = page.getByRole('main');
  await form.getByLabel(/^Email/).fill(email);
  await form.getByLabel(/^Пароль/).fill(password);
  await form.getByRole('button', { name: 'Войти' }).click();
  // Wait for the real redirect: the login URL itself contains "/admin" in ?next=.
  await page.waitForURL((url) => url.pathname.startsWith('/admin'));
}

test.describe('администратор', () => {
  test('создаёт товар, он появляется в магазине', async ({ page }) => {
    await loginAs(page, 'admin@silt.store', 'Admin12345');
    const name = `Лонгслив E2E ${Date.now()}`;

    await page.goto('/admin/products/new');
    await page.getByLabel('Название').fill(name);
    await page.getByLabel('Описание').fill('Тестовый лонгслив из плотного хлопка для проверки E2E.');
    await page.getByLabel(/^Цена/).fill('4990');
    await page.getByLabel('Категория').selectOption({ label: 'Футболки' });
    await page.getByLabel('Статус').selectOption('PUBLISHED');

    // Variants: generate size × colour matrix, then set stock.
    await page.getByRole('button', { name: /Размеры × цвета/ }).click();
    await page.getByRole('checkbox', { name: 'M', exact: true }).click();
    await page.getByRole('checkbox', { name: 'L', exact: true }).click();
    await page.getByRole('checkbox', { name: /Чёрный/ }).click();
    await page.getByRole('button', { name: /Добавить 2/ }).click();
    await page.getByLabel('Остаток, строка 1').fill('5');
    await page.getByLabel('Остаток, строка 2').fill('3');

    await page.getByRole('button', { name: 'Создать товар' }).first().click();
    await expect(page).toHaveURL(/\/admin\/products\/.+\/edit/);

    // The generated slug opens the product page in the shop.
    const slug = await page.getByLabel('Slug (адрес страницы)').inputValue();
    await page.goto(`/product/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  });

  test('обрабатывает оплаченный заказ: сборка → отправка с трек-номером', async ({ page }) => {
    await loginAs(page, 'admin@silt.store', 'Admin12345');
    await page.goto('/admin/orders?status=PAID');
    await page.getByRole('link', { name: /SL-\d{6}-/ }).first().click();
    await expect(page.getByRole('heading', { name: /Заказ SL-/ })).toBeVisible();

    await page.getByRole('button', { name: '→ Собирается' }).click();
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByRole('button', { name: '→ Отправлен' })).toBeVisible();

    await page.getByLabel('Перевозчик').fill('СДЭК');
    await page.getByLabel('Трек-номер').fill('E2E123456');
    await page.getByRole('button', { name: 'Сохранить' }).first().click();

    await page.getByRole('button', { name: '→ Отправлен' }).click();
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await expect(page.getByRole('button', { name: '→ Доставлен' })).toBeVisible();
  });

  test('менеджер не видит настройки и не может их открыть', async ({ page }) => {
    await loginAs(page, 'manager@silt.store', 'Manager12345');
    await expect(page.getByRole('link', { name: 'Настройки' })).toHaveCount(0);
    await page.goto('/admin/settings');
    await expect(page.getByText(/Нет доступа/)).toBeVisible();
  });

  test('покупатель не попадает в админку', async ({ page }) => {
    await loginAs(page, 'demo@silt.store', 'Demo12345');
    await page.goto('/admin');
    await expect(page.getByText(/Нет доступа/)).toBeVisible();
  });
});
