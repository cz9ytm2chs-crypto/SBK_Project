import { expect, test } from '@playwright/test';

test.describe('покупатель: от каталога до оплаченного заказа', () => {
  test('каталог → товар → корзина → оформление → тестовая оплата', async ({ page, isMobile }) => {
    // Catalog loads products from the database.
    await page.goto('/category/tshirts');
    await expect(page.getByRole('heading', { level: 1, name: 'Футболки' })).toBeVisible();
    await expect(page.getByText(/\d+ товар/)).toBeVisible();

    // Sorting is stored in the URL.
    await page.getByLabel('Сортировка').selectOption('price_desc');
    await expect(page).toHaveURL(/sort=price_desc/);

    await page.goto('/product/heavyweight-tee-white');
    await expect(page.getByRole('heading', { level: 1, name: 'Футболка Heavyweight' })).toBeVisible();

    // Without a size the item cannot be added.
    const addButton = page.getByRole('button', { name: /В корзину/ });
    await addButton.click();
    await expect(page.getByText('Выберите размер')).toBeVisible();

    // Pick a size that is in stock for the selected colour.
    const sizes = page.getByRole('button', { name: /^(XS|S|M|L|XL)$/ });
    const count = await sizes.count();
    for (let i = 0; i < count; i++) {
      const s = sizes.nth(i);
      if ((await s.isEnabled()) && !(await s.getAttribute('class'))?.includes('line-through')) {
        await s.click();
        break;
      }
    }
    await expect(page.getByText(/В наличии|Осталось/)).toBeVisible();
    await addButton.click();
    await expect(page.getByText('Добавлено в корзину')).toBeVisible();

    // Cart survives a reload (stored on the server).
    await page.goto('/cart');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Корзина' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Футболка Heavyweight' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Оформить заказ' }).click();

    const main = page.getByRole('main');
    // Step 1 — contacts (validation first).
    await expect(page.getByRole('heading', { name: 'Оформление заказа' })).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page.getByText('Обязательное поле').first()).toBeVisible();
    await main.getByLabel(/^Имя/).fill('Анна');
    await main.getByLabel(/^Фамилия/).fill('Тестова');
    await main.getByLabel(/^Email/).fill(`e2e-${Date.now()}@example.com`);
    await main.getByLabel(/^Телефон/).fill('+7 900 123-45-67');
    await page.getByRole('button', { name: 'Продолжить' }).click();

    // Step 2 — address.
    await main.getByLabel(/^Город/).fill('Москва');
    await main.getByLabel(/^Улица/).fill('Тверская');
    await main.getByLabel(/^Дом/).fill('1');
    await main.getByLabel(/^Индекс/).fill('125009');
    await page.getByRole('button', { name: 'Продолжить' }).click();

    // Step 3 — delivery, step 4 — payment (going back keeps data).
    await expect(page.getByRole('heading', { name: 'Способ доставки' })).toBeVisible();
    await page.getByRole('radio', { name: /Курьером/ }).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page.getByRole('heading', { name: 'Способ оплаты' })).toBeVisible();
    await page.getByRole('button', { name: '← Назад' }).click();
    await expect(page.getByRole('heading', { name: 'Способ доставки' })).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByRole('radio', { name: /Тестовая оплата/ }).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();

    // Step 5 — confirmation requires both consents.
    await expect(page.getByRole('heading', { name: 'Проверьте заказ' })).toBeVisible();
    const pay = page.getByRole('button', { name: /Оплатить/ });
    await expect(pay).toBeDisabled();
    await page.getByRole('checkbox').nth(0).click();
    await page.getByRole('checkbox').nth(1).click();
    await pay.click();

    // Hosted mock gateway page.
    await expect(page.getByText('Тестовый режим')).toBeVisible();
    await page.getByRole('button', { name: 'Оплатить' }).click();

    // Back in the shop: status comes from the server after the webhook.
    await expect(page).toHaveURL(/\/checkout\/result/);
    await expect(page.getByRole('heading', { name: 'Спасибо! Заказ оплачен' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/SL-\d{6}-/)).toBeVisible();
    if (!isMobile) await expect(page.getByRole('link', { name: 'Вернуться в магазин' })).toBeVisible();
  });

  test('поиск: подсказки и пустой результат', async ({ page }) => {
    await page.goto('/search?q=кроссовки');
    await expect(page.getByText(/\d+ товар/)).toBeVisible();
    await expect(page.getByText(/^[1-9]\d* товар/)).toBeVisible();
    await page.goto('/search?q=несуществующийтовар');
    await expect(page.getByText(/ничего не найдено/)).toBeVisible();
  });

  test('недоступная комбинация размера не выбирается', async ({ page }) => {
    // The tracksuit is seeded as sold out.
    await page.goto('/product/tracksuit-set-yellow');
    await expect(page.getByRole('button', { name: 'Нет в наличии', exact: true })).toBeDisabled();
  });
});
