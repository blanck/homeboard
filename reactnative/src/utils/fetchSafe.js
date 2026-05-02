export const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {...options, signal: controller.signal});
    return response;
  } finally {
    clearTimeout(timer);
  }
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
