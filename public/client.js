/* Shared transport for the Pages frontend and same-origin Worker frontend.
   The endpoint is public configuration. Owner keys never belong in this file. */
(() => {
  const origin = window.YOLK_API_ORIGIN || (location.hostname === 'zl-2.github.io'
    ? 'https://yolk-yard.zachlaskin99.workers.dev' : location.origin);
  const remote = origin !== location.origin;
  const base = new URL('.', document.baseURI);
  const key = 'yolk-browser:' + origin;
  const adminKey = 'yolk-admin:' + origin;
  async function api(path, body) {
    const admin = path.startsWith('/api/admin/');
    const storage = admin ? sessionStorage : localStorage;
    const storageKey = admin ? adminKey : key;
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (remote) {
      const token = storage.getItem(storageKey);
      if (token) headers.Authorization = 'Bearer ' + token;
    }
    const response = await fetch(new URL(path, origin), {
      method: body === undefined ? 'GET' : 'POST', headers,
      credentials: remote ? 'omit' : 'same-origin', cache: 'no-store',
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The game service is unavailable. Please try again.'); }
    if (!response.ok) {
      if (admin && response.status === 401 && remote) storage.removeItem(storageKey);
      throw Object.assign(new Error(data.error || 'The service is unavailable.'), {status: response.status});
    }
    if (remote && data.browserToken) localStorage.setItem(key, data.browserToken);
    if (remote && data.adminToken) sessionStorage.setItem(adminKey, data.adminToken);
    if (path === '/api/admin/logout') sessionStorage.removeItem(adminKey);
    return data;
  }
  window.YolkClient = {
    api, origin, remote,
    page: name => new URL(name, base).href,
    async socketURL() {
      const url = new URL('/session', origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      if (remote) url.searchParams.set('ticket', (await api('/api/session-ticket', {})).ticket);
      return url;
    },
  };
})();
