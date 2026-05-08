export const SYNC_PORT = 41234;
export const MULTICAST_ADDR = '239.255.255.251';

export const newRequestId = () => {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const escapeField = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
const unescapeField = (s) => s.replace(/\\\|/g, '|').replace(/\\\\/g, '\\');

const splitFields = (s) => {
  const out = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      cur += s[i] + s[i + 1];
      i++;
    } else if (s[i] === '|') {
      out.push(unescapeField(cur));
      cur = '';
    } else {
      cur += s[i];
    }
  }
  out.push(unescapeField(cur));
  return out;
};

export const buildAnnounce = (id, name) => `HBANN|${escapeField(id)}|${escapeField(name)}`;
export const buildSend = (reqId, senderName, section, data) =>
  `HBSEND|${reqId}|${escapeField(senderName)}|${section}|${escapeField(data)}`;

export const parseMessage = (str) => {
  if (!str) return null;
  const parts = splitFields(str);
  const type = parts[0];
  switch (type) {
    case 'HBANN':
      return parts.length >= 3 ? {type, id: parts[1], name: parts[2]} : null;
    case 'HBSEND':
      return parts.length >= 5
        ? {
            type,
            reqId: parts[1],
            senderName: parts[2],
            section: parts[3],
            data: parts[4],
          }
        : null;
    default:
      return null;
  }
};
