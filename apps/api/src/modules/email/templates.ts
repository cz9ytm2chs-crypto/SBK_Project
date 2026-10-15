import { formatMoney, ORDER_STATUS_LABELS, type OrderStatus } from '@silt/shared';
import { env } from '../../config/env';

export interface OrderEmailPayload {
  number: string;
  firstName: string;
  total: number;
  currency: string;
  status?: OrderStatus;
  items?: { name: string; size: string; color: string; quantity: number; lineTotal: number }[];
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  orderUrl: string;
  comment?: string;
}

type Templates = {
  verify_email: { firstName: string; url: string };
  password_reset: { firstName: string; url: string };
  order_created: OrderEmailPayload;
  order_paid: OrderEmailPayload;
  order_status: OrderEmailPayload;
  order_shipped: OrderEmailPayload;
  order_cancelled: OrderEmailPayload;
  order_refunded: OrderEmailPayload;
};
export type EmailTemplate = keyof Templates;
export type TemplatePayload<T extends EmailTemplate> = Templates[T];

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;color:#141414">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fbfaf7">
<tr><td style="padding:28px 32px;border-bottom:1px solid #e3ded3;font-size:22px;letter-spacing:.32em;font-weight:600">SILT</td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e3ded3;font-size:12px;color:#77736b;line-height:1.6">
SILT — одежда и аксессуары. Вы получили это письмо, потому что совершили действие на ${esc(env.APP_URL)}.</td></tr>
</table></td></tr></table></body></html>`;
}

const h1 = (t: string) => `<h1 style="margin:0 0 16px;font-size:24px;font-weight:500">${esc(t)}</h1>`;
const p = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${t}</p>`;
const button = (label: string, url: string) =>
  `<a href="${esc(url)}" style="display:inline-block;background:#141414;color:#fbfaf7;padding:14px 28px;text-decoration:none;font-size:13px;letter-spacing:.12em;text-transform:uppercase">${esc(label)}</a>`;

function itemsTable(o: OrderEmailPayload) {
  if (!o.items?.length) return '';
  const rows = o.items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e3ded3;font-size:14px">${esc(i.name)}<br>
<span style="color:#77736b;font-size:12px">${esc(i.size)} · ${esc(i.color)} · ${i.quantity} шт.</span></td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #e3ded3;font-size:14px">${formatMoney(i.lineTotal, o.currency)}</td></tr>`,
    )
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">${rows}
<tr><td style="padding-top:12px;font-weight:600">Итого</td><td align="right" style="padding-top:12px;font-weight:600">${formatMoney(o.total, o.currency)}</td></tr></table>`;
}

export function renderEmail<T extends EmailTemplate>(template: T, data: TemplatePayload<T>) {
  const d = data as never as Record<string, unknown> & OrderEmailPayload & { url: string };
  const name = esc(String(d.firstName ?? ''));
  switch (template) {
    case 'verify_email':
      return {
        subject: 'Подтвердите email — SILT',
        html: layout('Подтверждение email', h1(`${name}, добро пожаловать`) + p('Подтвердите адрес электронной почты, чтобы завершить регистрацию.') + button('Подтвердить email', d.url) + p('<br>Ссылка действует 24 часа.')),
        text: `Подтвердите email: ${d.url}`,
      };
    case 'password_reset':
      return {
        subject: 'Восстановление пароля — SILT',
        html: layout('Восстановление пароля', h1('Восстановление пароля') + p('Мы получили запрос на смену пароля. Если это были не вы — просто проигнорируйте письмо.') + button('Задать новый пароль', d.url) + p('<br>Ссылка действует 1 час.')),
        text: `Сброс пароля: ${d.url}`,
      };
    case 'order_created':
      return {
        subject: `Заказ ${d.number} оформлен`,
        html: layout('Заказ оформлен', h1(`Спасибо, ${name}`) + p(`Заказ <b>${esc(d.number)}</b> оформлен и ожидает оплаты.`) + itemsTable(d) + button('Перейти к заказу', d.orderUrl)),
        text: `Заказ ${d.number} оформлен. ${d.orderUrl}`,
      };
    case 'order_paid':
      return {
        subject: `Заказ ${d.number} оплачен`,
        html: layout('Оплата получена', h1('Оплата получена') + p(`Заказ <b>${esc(d.number)}</b> оплачен. Мы начинаем его собирать.`) + itemsTable(d) + button('Статус заказа', d.orderUrl)),
        text: `Заказ ${d.number} оплачен. ${d.orderUrl}`,
      };
    case 'order_shipped':
      return {
        subject: `Заказ ${d.number} отправлен`,
        html: layout('Заказ отправлен', h1('Заказ в пути') + p(`Заказ <b>${esc(d.number)}</b> передан в доставку.`) + (d.trackingNumber ? p(`Трек-номер: <b>${esc(d.trackingNumber)}</b>`) : '') + button('Отследить', d.trackingUrl || d.orderUrl)),
        text: `Заказ ${d.number} отправлен. Трек: ${d.trackingNumber ?? '—'}`,
      };
    case 'order_cancelled':
      return {
        subject: `Заказ ${d.number} отменён`,
        html: layout('Заказ отменён', h1('Заказ отменён') + p(`Заказ <b>${esc(d.number)}</b> отменён.${d.comment ? ' ' + esc(d.comment) : ''}`) + button('Вернуться в магазин', env.APP_URL)),
        text: `Заказ ${d.number} отменён.`,
      };
    case 'order_refunded':
      return {
        subject: `Возврат по заказу ${d.number}`,
        html: layout('Возврат оформлен', h1('Возврат оформлен') + p(`По заказу <b>${esc(d.number)}</b> оформлен возврат на сумму ${formatMoney(d.total, d.currency)}. Деньги поступят на карту в течение 3–10 рабочих дней.`) + button('Подробнее', d.orderUrl)),
        text: `Возврат по заказу ${d.number}: ${formatMoney(d.total, d.currency)}`,
      };
    case 'order_status':
    default:
      return {
        subject: `Заказ ${d.number}: ${ORDER_STATUS_LABELS[d.status!] ?? 'статус изменён'}`,
        html: layout('Статус заказа', h1('Статус заказа изменён') + p(`Заказ <b>${esc(d.number)}</b>: ${esc(ORDER_STATUS_LABELS[d.status!] ?? '')}.`) + button('Статус заказа', d.orderUrl)),
        text: `Заказ ${d.number}: ${ORDER_STATUS_LABELS[d.status!]}`,
      };
  }
}
