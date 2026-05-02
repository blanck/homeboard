// Direct HTTP/SOAP to Sonos devices — port of server.js Sonos interaction
// Sonos devices expose a UPnP/SOAP API on port 1400

import dgram from 'react-native-udp';
import {fetchWithTimeout} from '../utils/fetchSafe';

const SONOS_PORT = 1400;
const SONOS_TIMEOUT_MS = 4000;

// SSDP discovery — find Sonos devices via UDP multicast
export const discoverSonosDevices = (timeoutMs = 3000) => {
  return new Promise((resolve) => {
    const devices = new Map();
    let socket;

    const finish = () => {
      try {
        socket?.close();
      } catch {}
      resolve([...devices.values()]);
    };

    const timer = setTimeout(finish, timeoutMs);

    try {
      socket = dgram.createSocket({type: 'udp4'});

      socket.on('message', (msg) => {
        const text = msg.toString();
        // Only care about Sonos ZonePlayer responses
        if (!text.includes('ZonePlayer')) return;

        const locationMatch = text.match(/LOCATION:\s*(http:\/\/([^:/]+):(\d+)[^\r\n]*)/i);
        if (!locationMatch) return;

        const ip = locationMatch[2];
        if (!devices.has(ip)) {
          devices.set(ip, {ip, location: locationMatch[1]});
        }
      });

      socket.on('error', () => {
        clearTimeout(timer);
        finish();
      });

      socket.bind(0, () => {
        const searchMsg =
          'M-SEARCH * HTTP/1.1\r\n' +
          'HOST: 239.255.255.250:1900\r\n' +
          'MAN: "ssdp:discover"\r\n' +
          'MX: 1\r\n' +
          'ST: urn:schemas-upnp-org:device:ZonePlayer:1\r\n' +
          '\r\n';

        socket.send(searchMsg, undefined, undefined, 1900, '239.255.255.250', (err) => {
          if (err) {
            clearTimeout(timer);
            finish();
          }
        });
      });
    } catch {
      clearTimeout(timer);
      resolve([]);
    }
  });
};

// Fetch device details (friendlyName, roomName) from a discovered device
export const getDeviceDetails = async (ip) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`http://${ip}:${SONOS_PORT}/xml/device_description.xml`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const text = await resp.text();
    const nameMatch = text.match(/<friendlyName>([^<]+)<\/friendlyName>/);
    const roomMatch = text.match(/<roomName>([^<]+)<\/roomName>/);
    if (nameMatch) {
      return {ip, name: nameMatch[1], room: roomMatch ? roomMatch[1] : null};
    }
    return null;
  } catch {
    return null;
  }
};

const soapRequest = async (ip, path, service, action, body = '') => {
  const url = `http://${ip}:${SONOS_PORT}${path}`;
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="${service}">
      ${body}
    </u:${action}>
  </s:Body>
</s:Envelope>`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPAction: `"${service}#${action}"`,
      },
      body: soapBody,
    },
    SONOS_TIMEOUT_MS,
  );

  return await response.text();
};

const extractTag = (xml, tag) => {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1] : '';
};

const decodeXmlEntities = (text) => {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

// Get current transport state
export const getTransportState = async (ip) => {
  try {
    const result = await soapRequest(
      ip,
      '/MediaRenderer/AVTransport/Control',
      'urn:schemas-upnp-org:service:AVTransport:1',
      'GetTransportInfo',
      '<InstanceID>0</InstanceID>',
    );
    const state = extractTag(result, 'CurrentTransportState');
    // Map UPnP states to simple names
    if (state === 'PLAYING') {
      return 'playing';
    }
    if (state === 'PAUSED_PLAYBACK') {
      return 'paused';
    }
    if (state === 'TRANSITIONING') {
      return 'transitioning';
    }
    return 'stopped';
  } catch (err) {
    console.warn('Sonos state error:', err);
    return null;
  }
};

// Get current play mode (NORMAL, SHUFFLE, REPEAT_ALL, SHUFFLE_REPEAT_ONE, etc.)
export const getPlayMode = async (ip) => {
  try {
    const result = await soapRequest(
      ip,
      '/MediaRenderer/AVTransport/Control',
      'urn:schemas-upnp-org:service:AVTransport:1',
      'GetTransportSettings',
      '<InstanceID>0</InstanceID>',
    );
    return extractTag(result, 'PlayMode') || 'NORMAL';
  } catch {
    return 'NORMAL';
  }
};

// Set play mode
export const setPlayMode = async (ip, mode) => {
  await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'SetPlayMode',
    `<InstanceID>0</InstanceID><NewPlayMode>${mode}</NewPlayMode>`,
  );
};

// Get current media info (what playlist/station is playing)
export const getMediaInfo = async (ip) => {
  try {
    const result = await soapRequest(
      ip,
      '/MediaRenderer/AVTransport/Control',
      'urn:schemas-upnp-org:service:AVTransport:1',
      'GetMediaInfo',
      '<InstanceID>0</InstanceID>',
    );
    const uri = extractTag(result, 'CurrentURI') || '';
    const metadata = decodeXmlEntities(extractTag(result, 'CurrentURIMetaData') || '');
    const title = extractTag(metadata, 'dc:title') || '';
    return {uri, title};
  } catch {
    return null;
  }
};

// Get current track info
export const getCurrentTrack = async (ip) => {
  try {
    const result = await soapRequest(
      ip,
      '/MediaRenderer/AVTransport/Control',
      'urn:schemas-upnp-org:service:AVTransport:1',
      'GetPositionInfo',
      '<InstanceID>0</InstanceID>',
    );

    const metadata = decodeXmlEntities(extractTag(result, 'TrackMetaData'));
    const duration = parseDuration(extractTag(result, 'TrackDuration'));
    const position = parseDuration(extractTag(result, 'RelTime'));

    const title =
      extractTag(metadata, 'dc:title') || extractTag(metadata, 'r:streamContent') || '';
    const artist = extractTag(metadata, 'dc:creator') || '';
    const album = extractTag(metadata, 'upnp:album') || '';
    let albumArtURI = extractTag(metadata, 'upnp:albumArtURI') || '';
    albumArtURI = decodeXmlEntities(albumArtURI);

    // Make album art URL absolute if relative
    if (albumArtURI && !albumArtURI.startsWith('http')) {
      albumArtURI = `http://${ip}:${SONOS_PORT}${albumArtURI}`;
    }

    return {
      title,
      artist,
      album,
      albumArtURI,
      albumArtURL: albumArtURI,
      duration,
      position,
    };
  } catch (err) {
    console.warn('Sonos track error:', err);
    return null;
  }
};

// Get volume
export const getVolume = async (ip) => {
  try {
    const result = await soapRequest(
      ip,
      '/MediaRenderer/RenderingControl/Control',
      'urn:schemas-upnp-org:service:RenderingControl:1',
      'GetVolume',
      '<InstanceID>0</InstanceID><Channel>Master</Channel>',
    );
    const v = parseInt(extractTag(result, 'CurrentVolume'), 10);
    return Number.isNaN(v) ? null : v;
  } catch {
    return null;
  }
};

// Toggle play/pause
export const togglePlayback = async (ip) => {
  const state = await getTransportState(ip);
  if (state === 'playing') {
    return await soapRequest(
      ip,
      '/MediaRenderer/AVTransport/Control',
      'urn:schemas-upnp-org:service:AVTransport:1',
      'Pause',
      '<InstanceID>0</InstanceID>',
    );
  }
  return await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'Play',
    '<InstanceID>0</InstanceID><Speed>1</Speed>',
  );
};

// Next track
export const nextTrack = async (ip) => {
  return await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'Next',
    '<InstanceID>0</InstanceID>',
  );
};

// Adjust volume
export const adjustVolume = async (ip, delta) => {
  const current = await getVolume(ip);
  if (current == null) return;
  const newVol = Math.min(100, Math.max(0, current + delta));
  return await soapRequest(
    ip,
    '/MediaRenderer/RenderingControl/Control',
    'urn:schemas-upnp-org:service:RenderingControl:1',
    'SetVolume',
    `<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>${newVol}</DesiredVolume>`,
  );
};

// Play Spotify URI
export const playSpotifyURI = async (ip, uri, region = '2311') => {
  // Clear queue first
  await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'RemoveAllTracksFromQueue',
    '<InstanceID>0</InstanceID>',
  );

  // Set play mode to shuffle
  await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'SetPlayMode',
    '<InstanceID>0</InstanceID><NewPlayMode>SHUFFLE</NewPlayMode>',
  );

  // Add Spotify URI to queue
  const encodedUri = uri.replace(/&/g, '&amp;');
  const metadata = `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="00030020${encodedUri}" restricted="true"><upnp:class>object.container.playlistContainer</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON${region}_X_#Svc${region}-0-Token</desc></item></DIDL-Lite>`;

  await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'AddURIToQueue',
    `<InstanceID>0</InstanceID><EnqueuedURI>x-rincon-cpcontainer:0006206c${encodedUri}</EnqueuedURI><EnqueuedURIMetaData>${metadata.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</EnqueuedURIMetaData><DesiredFirstTrackNumberEnqueued>0</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>0</EnqueueAsNext>`,
  );

  // Play from queue
  await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'Play',
    '<InstanceID>0</InstanceID><Speed>1</Speed>',
  );
};

// Play TuneIn radio
export const playRadio = async (ip, stationId, stationName) => {
  const uri = `x-sonosapi-stream:${stationId}?sid=254&flags=8224&sn=0`;
  const metadata = `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="F00092020${stationId}" restricted="true"><dc:title>${stationName}</dc:title><upnp:class>object.item.audioItem.audioBroadcast</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON65031_</desc></item></DIDL-Lite>`;

  await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'SetAVTransportURI',
    `<InstanceID>0</InstanceID><CurrentURI>${uri}</CurrentURI><CurrentURIMetaData>${metadata.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</CurrentURIMetaData>`,
  );

  await soapRequest(
    ip,
    '/MediaRenderer/AVTransport/Control',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'Play',
    '<InstanceID>0</InstanceID><Speed>1</Speed>',
  );
};

// Extract a named attribute from an XML tag string
const extractAttr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : '';
};

// Parse zone group XML (shared between SOAP and HTTP topology)
const parseZoneGroups = (text) => {
  const groups = [];
  const groupRegex = /<ZoneGroup\s([^>]*)>([\s\S]*?)<\/ZoneGroup>/g;
  const memberRegex = /<ZoneGroupMember\s[^>]*/g;

  let groupMatch;
  while ((groupMatch = groupRegex.exec(text)) !== null) {
    const groupAttrs = groupMatch[1];
    const coordinatorUuid = extractAttr(groupAttrs, 'Coordinator');
    const membersXml = groupMatch[2];

    const members = [];
    let coordinatorIp = null;
    let memberMatch;
    memberRegex.lastIndex = 0;
    while ((memberMatch = memberRegex.exec(membersXml)) !== null) {
      const tag = memberMatch[0];
      const zoneName = extractAttr(tag, 'ZoneName');
      const location = extractAttr(tag, 'Location');
      const uuid = extractAttr(tag, 'UUID');
      const ipMatch = location.match(/\/\/([^:]+):/);
      const memberIp = ipMatch ? ipMatch[1] : null;

      if (zoneName && memberIp) {
        members.push({name: zoneName, ip: memberIp});

        if (uuid === coordinatorUuid || location.includes(coordinatorUuid)) {
          coordinatorIp = memberIp;
        }
      }
    }

    if (members.length > 0) {
      const label = members.map((m) => m.name).join(' + ');
      groups.push({
        label,
        value: members[0].name,
        coordinatorIp: coordinatorIp || members[0].ip,
        members,
      });
    }
  }
  return groups;
};

// Get zone groups — try SOAP first, fall back to HTTP topology
export const getZoneGroups = async (ip) => {
  try {
    // SOAP approach (more reliable across firmware versions)
    const result = await soapRequest(
      ip,
      '/ZoneGroupTopology/Control',
      'urn:schemas-upnp-org:service:ZoneGroupTopology:1',
      'GetZoneGroupState',
      '',
    );
    const stateXml = decodeXmlEntities(extractTag(result, 'ZoneGroupState'));
    const groups = parseZoneGroups(stateXml);
    if (groups.length > 0) {
      return groups;
    }
  } catch (err) {
    console.warn('Sonos SOAP topology error:', err);
  }

  // Fallback: HTTP topology endpoint
  try {
    const response = await fetchWithTimeout(
      `http://${ip}:${SONOS_PORT}/status/topology`,
      undefined,
      SONOS_TIMEOUT_MS,
    );
    const text = await response.text();
    return parseZoneGroups(text);
  } catch {
    return [];
  }
};

// Find the coordinator IP for the group containing the given device IP
export const getCoordinatorIp = async (ip) => {
  try {
    const groups = await getZoneGroups(ip);
    for (const group of groups) {
      const isMember = group.members.some((m) => m.ip === ip);
      if (isMember) {
        return group.coordinatorIp;
      }
    }
  } catch (err) {
    console.warn('Sonos coordinator lookup error:', err);
  }
  return ip; // fallback to the device itself
};

// Get Sonos favorites (Browse FV:2 via ContentDirectory)
export const getSonosFavorites = async (ip) => {
  try {
    const result = await soapRequest(
      ip,
      '/MediaServer/ContentDirectory/Control',
      'urn:schemas-upnp-org:service:ContentDirectory:1',
      'Browse',
      '<ObjectID>FV:2</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag><Filter>*</Filter><StartingIndex>0</StartingIndex><RequestedCount>100</RequestedCount><SortCriteria></SortCriteria>',
    );

    const didl = decodeXmlEntities(extractTag(result, 'Result'));
    const favorites = [];
    const itemRegex = /<item\s[^>]*>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(didl)) !== null) {
      const itemXml = match[1];
      const title = extractTag(itemXml, 'dc:title') || '';
      const resMatch = itemXml.match(/<res\s[^>]*>(.*?)<\/res>/);
      const uri = resMatch ? resMatch[1] : '';
      const resMD = extractTag(itemXml, 'r:resMD') || '';
      const albumArtURI = extractTag(itemXml, 'upnp:albumArtURI') || '';
      if (title && uri) {
        favorites.push({title, uri, resMD, albumArtURI});
      }
    }
    return favorites;
  } catch (err) {
    console.warn('Sonos favorites error:', err);
    return [];
  }
};

// Browse Sonos playlists (saved queues SQ: + imported playlists A:PLAYLISTS)
export const getSonosPlaylists = async (ip) => {
  const playlists = [];
  const containers = ['SQ:', 'A:PLAYLISTS'];

  for (const objectId of containers) {
    try {
      const result = await soapRequest(
        ip,
        '/MediaServer/ContentDirectory/Control',
        'urn:schemas-upnp-org:service:ContentDirectory:1',
        'Browse',
        `<ObjectID>${objectId}</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag><Filter>*</Filter><StartingIndex>0</StartingIndex><RequestedCount>100</RequestedCount><SortCriteria></SortCriteria>`,
      );

      const didl = decodeXmlEntities(extractTag(result, 'Result'));
      // Match both <item> and <container> elements
      const entryRegex = /<(?:item|container)\s[^>]*>([\s\S]*?)<\/(?:item|container)>/g;
      let match;
      while ((match = entryRegex.exec(didl)) !== null) {
        const xml = match[1];
        const title = extractTag(xml, 'dc:title') || '';
        const resMatch = xml.match(/<res\s[^>]*>(.*?)<\/res>/);
        const uri = resMatch ? resMatch[1] : '';
        const resMD = extractTag(xml, 'r:resMD') || '';
        const albumArtURI = extractTag(xml, 'upnp:albumArtURI') || '';
        if (title && uri) {
          playlists.push({title, uri, resMD, albumArtURI, source: 'playlist'});
        }
      }
    } catch (err) {
      console.warn(`Sonos browse ${objectId} error:`, err);
    }
  }
  return playlists;
};

// Search Sonos music library (local index) for playlists, albums, tracks
export const searchSonosLibrary = async (ip, query) => {
  if (!query || !query.trim()) return [];
  const results = [];
  const term = query.replace(/"/g, '\\"');

  // Search categories: playlists, albums, tracks
  const searches = [
    {criteria: `upnp:class derivedfrom "object.container.playlistContainer" and dc:title contains "${term}"`, source: 'playlist'},
    {criteria: `upnp:class derivedfrom "object.container.album.musicAlbum" and dc:title contains "${term}"`, source: 'album'},
    {criteria: `upnp:class derivedfrom "object.item.audioItem.musicTrack" and dc:title contains "${term}"`, source: 'track'},
  ];

  for (const {criteria, source} of searches) {
    try {
      const result = await soapRequest(
        ip,
        '/MediaServer/ContentDirectory/Control',
        'urn:schemas-upnp-org:service:ContentDirectory:1',
        'Search',
        `<ContainerID>0</ContainerID><SearchCriteria>${criteria}</SearchCriteria><Filter>*</Filter><StartingIndex>0</StartingIndex><RequestedCount>20</RequestedCount><SortCriteria></SortCriteria>`,
      );

      const didl = decodeXmlEntities(extractTag(result, 'Result'));
      const entryRegex = /<(?:item|container)\s[^>]*>([\s\S]*?)<\/(?:item|container)>/g;
      let match;
      while ((match = entryRegex.exec(didl)) !== null) {
        const xml = match[1];
        const title = extractTag(xml, 'dc:title') || '';
        const resMatch = xml.match(/<res\s[^>]*>(.*?)<\/res>/);
        const uri = resMatch ? resMatch[1] : '';
        const resMD = extractTag(xml, 'r:resMD') || '';
        const albumArtURI = extractTag(xml, 'upnp:albumArtURI') || '';
        if (title && uri) {
          results.push({title, uri, resMD, albumArtURI, source});
        }
      }
    } catch (err) {
      // Search may not be supported for all categories
      console.warn(`Sonos search ${source} error:`, err);
    }
  }
  return results;
};

// Get device RINCON UUID from device description XML
export const getDeviceUUID = async (ip) => {
  try {
    const response = await fetchWithTimeout(
      `http://${ip}:${SONOS_PORT}/xml/device_description.xml`,
      undefined,
      SONOS_TIMEOUT_MS,
    );
    const text = await response.text();
    const udn = extractTag(text, 'UDN') || '';
    return udn.replace('uuid:', '');
  } catch {
    return null;
  }
};

// Play a Sonos favorite
export const playFavorite = async (ip, favorite) => {
  try {
    const uri = favorite.uri;
    const metadata = favorite.resMD || '';
    const encodedUri = uri.replace(/&/g, '&amp;');

    // Container URIs (playlists, albums) need queue-based playback
    const isContainer =
      uri.startsWith('x-rincon-cpcontainer:') ||
      uri.startsWith('x-rincon-playlist:') ||
      uri.startsWith('x-sonosapi-hls-static:');

    if (isContainer) {
      const uuid = await getDeviceUUID(ip);
      if (!uuid) {
        console.warn('Could not get device UUID for queue playback');
        return;
      }

      // Clear queue
      await soapRequest(
        ip,
        '/MediaRenderer/AVTransport/Control',
        'urn:schemas-upnp-org:service:AVTransport:1',
        'RemoveAllTracksFromQueue',
        '<InstanceID>0</InstanceID>',
      );

      // Add container to queue
      await soapRequest(
        ip,
        '/MediaRenderer/AVTransport/Control',
        'urn:schemas-upnp-org:service:AVTransport:1',
        'AddURIToQueue',
        `<InstanceID>0</InstanceID><EnqueuedURI>${encodedUri}</EnqueuedURI><EnqueuedURIMetaData>${metadata}</EnqueuedURIMetaData><DesiredFirstTrackNumberEnqueued>0</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>0</EnqueueAsNext>`,
      );

      // Switch transport to the queue
      await soapRequest(
        ip,
        '/MediaRenderer/AVTransport/Control',
        'urn:schemas-upnp-org:service:AVTransport:1',
        'SetAVTransportURI',
        `<InstanceID>0</InstanceID><CurrentURI>x-rincon-queue:${uuid}#0</CurrentURI><CurrentURIMetaData></CurrentURIMetaData>`,
      );

      // Play
      await soapRequest(
        ip,
        '/MediaRenderer/AVTransport/Control',
        'urn:schemas-upnp-org:service:AVTransport:1',
        'Play',
        '<InstanceID>0</InstanceID><Speed>1</Speed>',
      );
    } else {
      // Direct playback for streams / radio / single tracks
      await soapRequest(
        ip,
        '/MediaRenderer/AVTransport/Control',
        'urn:schemas-upnp-org:service:AVTransport:1',
        'SetAVTransportURI',
        `<InstanceID>0</InstanceID><CurrentURI>${encodedUri}</CurrentURI><CurrentURIMetaData>${metadata}</CurrentURIMetaData>`,
      );

      await soapRequest(
        ip,
        '/MediaRenderer/AVTransport/Control',
        'urn:schemas-upnp-org:service:AVTransport:1',
        'Play',
        '<InstanceID>0</InstanceID><Speed>1</Speed>',
      );
    }
  } catch (err) {
    console.warn('Sonos play favorite error:', err);
  }
};

// Parse HH:MM:SS duration to seconds
const parseDuration = (str) => {
  if (!str || str === 'NOT_IMPLEMENTED') {
    return 0;
  }
  const parts = str.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};
