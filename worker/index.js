import { handleProxyRequest } from '../proxy/runtime.js';

export default {
  fetch(request) {
    return handleProxyRequest(request, { proxyName: 'cloudflare' });
  },
};
