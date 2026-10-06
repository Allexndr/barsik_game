import { authenticateAdmin, passwordLoginConfigured, send, type AdminRequest, type AdminResponse } from './_lib';

export default async function login(req: AdminRequest, res: AdminResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Метод не поддерживается' });
    return;
  }

  const body = req.body as { username?: unknown; password?: unknown } | null;
  if (typeof body?.username !== 'string' || typeof body.password !== 'string') {
    send(res, 400, { error: 'Введите логин и пароль' });
    return;
  }

  const token = authenticateAdmin(body.username, body.password);
  if (!token) {
    const configured = passwordLoginConfigured();
    send(res, configured ? 401 : 503, {
      error: configured ? 'Неверный логин или пароль' : 'Вход по логину и паролю не настроен на сервере',
    });
    return;
  }

  send(res, 200, { token, actor: body.username });
}
