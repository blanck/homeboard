// QR code section encoding/decoding for settings transfer
// Format: HB:<section>:<pipe-delimited values>
//
// `secrets` optionally carries OAuth token stores (spotifyTokens,
// tibberDataTokens, lmAuth) so LAN sync can move logins between trusted
// devices. Older receivers ignore the extra fields.

export const buildSectionData = (key, form, secrets = {}) => {
  switch (key) {
    case 'general':
      return [
        form.language,
        form.lat,
        form.lng,
        form.locationName,
        form.localzone,
        form.remotezone,
        form.autosleep,
        form.keepAwake ? '1' : '0',
        form.backgroundDayUrl,
        form.backgroundEveningUrl,
      ].join('|');
    case 'weather':
      return [
        form.owmKey,
        form.netatmoMode,
        form.netatmoPublicUrl,
        form.netatmoClientId,
        form.netatmoClientSecret,
        form.netatmoDeviceId,
        form.netatmoForecastDeviceId,
        form.netatmoForecastModuleId,
        form.netatmoForecastBearer,
      ].join('|');
    case 'energy':
      return [
        form.tibberApiKey,
        form.tibberHomeId,
        secrets.tibberDataTokens || '',
      ].join('|');
    case 'news':
      return JSON.stringify({
        newsProvider: form.newsProvider || 'newsdata',
        newsKeyNewsdata: form.newsKeyNewsdata || '',
        newsKeyThenewsapi: form.newsKeyThenewsapi || '',
        newsKeyCurrents: form.newsKeyCurrents || '',
        newsKeyNewsapiorg: form.newsKeyNewsapiorg || '',
        newsSources: form.newsSources || '',
        newsLanguage: form.newsLanguage || 'en',
        newsExclude: form.newsExclude || '',
        newsCategories: form.newsCategories || '',
      });
    case 'stocks':
      return form.quotes;
    case 'calendar':
      return [form.calSharedUrl, form.calHolidayUrl].join('|');
    case 'music':
      return JSON.stringify({
        sonosIp: form.sonosIp,
        sonosName: form.sonosName,
        sonosGroup: form.sonosGroup,
        sonosRegion: form.sonosRegion,
        quickPicks: form.quickPicks || [],
        spotifyTokens: secrets.spotifyTokens || '',
      });
    case 'smartDevices':
      return JSON.stringify({
        smartDeviceType: form.smartDeviceType || '',
        lmSerialNumber: form.lmSerialNumber || '',
        lmMachineName: form.lmMachineName || '',
        lmShowWidget: form.lmShowWidget !== false ? '1' : '0',
        lmAuth: secrets.lmAuth || '',
      });
    default:
      return '';
  }
};

export const parseSectionData = (key, data) => {
  const p = data.split('|');
  switch (key) {
    case 'general':
      return {
        language: p[0] || 'en',
        lat: p[1] || '',
        lng: p[2] || '',
        locationName: p[3] || '',
        localzone: p[4] || '',
        remotezone: p[5] || '',
        autosleep: p[6] || '',
        keepAwake: p[7] !== '0',
        backgroundDayUrl: p[8] || '',
        backgroundEveningUrl: p[9] || '',
      };
    case 'weather':
      return {
        owmKey: p[0] || '',
        netatmoMode: p[1] || 'public',
        netatmoPublicUrl: p[2] || '',
        netatmoClientId: p[3] || '',
        netatmoClientSecret: p[4] || '',
        netatmoDeviceId: p[5] || '',
        netatmoForecastDeviceId: p[6] || '',
        netatmoForecastModuleId: p[7] || '',
        netatmoForecastBearer: p[8] || '',
      };
    case 'energy':
      return {
        tibberApiKey: p[0] || '',
        tibberHomeId: p[1] || '',
        __tibberDataTokens: p[2] || '',
      };
    case 'news': {
      try {
        const m = JSON.parse(data);
        return {
          newsProvider: m.newsProvider || 'newsdata',
          newsKeyNewsdata: m.newsKeyNewsdata || '',
          newsKeyThenewsapi: m.newsKeyThenewsapi || '',
          newsKeyCurrents: m.newsKeyCurrents || '',
          newsKeyNewsapiorg: m.newsKeyNewsapiorg || '',
          newsSources: m.newsSources || '',
          newsLanguage: m.newsLanguage || 'en',
          newsExclude: m.newsExclude || '',
          newsCategories: m.newsCategories || '',
        };
      } catch (e) {
        return {
          newsSources: p[1] || '',
          newsLanguage: p[2] || 'en',
          newsExclude: p[3] || '',
          newsCategories: p[4] || '',
        };
      }
    }
    case 'stocks':
      return {quotes: data};
    case 'calendar':
      return {
        calSharedUrl: p[0] || '',
        calHolidayUrl: p[1] || '',
      };
    case 'music': {
      try {
        const m = JSON.parse(data);
        return {
          sonosIp: m.sonosIp || '',
          sonosName: m.sonosName || '',
          sonosGroup: m.sonosGroup || '',
          sonosRegion: m.sonosRegion || '2311',
          quickPicks: m.quickPicks || [],
          __spotifyTokens: m.spotifyTokens || '',
        };
      } catch (e) {
        return {
          sonosIp: p[0] || '',
          sonosName: p[1] || '',
          sonosGroup: p[2] || '',
          sonosRegion: p[3] || '2311',
        };
      }
    }
    case 'smartDevices': {
      try {
        const m = JSON.parse(data);
        return {
          smartDeviceType: m.smartDeviceType || '',
          lmSerialNumber: m.lmSerialNumber || '',
          lmMachineName: m.lmMachineName || '',
          lmShowWidget: m.lmShowWidget !== '0',
          __lmAuth: m.lmAuth || '',
        };
      } catch (e) {
        return {};
      }
    }
    default:
      return {};
  }
};

export const parseQrValue = (value) => {
  if (!value || !value.startsWith('HB:')) return null;
  const firstColon = value.indexOf(':');
  const secondColon = value.indexOf(':', firstColon + 1);
  if (secondColon === -1) return null;
  const section = value.substring(firstColon + 1, secondColon);
  const data = value.substring(secondColon + 1);
  return {section, fields: parseSectionData(section, data)};
};
