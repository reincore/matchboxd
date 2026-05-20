import {
  handleProxyRequest,
  sendNodeResponse,
  toNodeRequest,
} from '../proxy/runtime.js';

export default async function handler(req, res) {
  const request = toNodeRequest(req);
  const response = await handleProxyRequest(request, { proxyName: 'vercel' });
  await sendNodeResponse(res, response);
}
