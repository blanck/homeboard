// The timer keeps running until the body is read: browsers resolve fetch at the
// headers, so a body that stalls afterwards would otherwise never time out
export const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {...options, signal: controller.signal});
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
  for (const method of ['text', 'json', 'arrayBuffer', 'blob']) {
    const read = response[method];
    if (typeof read !== 'function') continue;
    response[method] = () => read.call(response).finally(() => clearTimeout(timer));
  }
  return response;
};

export const fetchJsonSafe = async (url, options, timeoutMs) => {
  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export const fetchTextSafe = async (url, options, timeoutMs) => {
  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
};
