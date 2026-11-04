// Older configs keep playlists as {key: {title, type, list: [[uri, name]]}};
// Settings only edits quickPicks, so loadSettings converts them once
export const legacyToQuickPicks = (playlist) =>
  Object.values(playlist || {})
    .filter((p) => p && Array.isArray(p.list))
    .map((p) => ({
      name: p.title || '',
      items: p.list
        .filter((entry) => Array.isArray(entry) && entry[0])
        .map(([uri, title]) => ({
          title: title || uri,
          uri,
          ...(p.type === 'radio' ? {radio: true} : null),
        })),
    }));

// The settings fields to write when a stored config still has old playlists, else null
export const migratePlaylists = (settings) => {
  const legacy = legacyToQuickPicks(settings?.playlist);
  if (!legacy.length) return null;
  return {quickPicks: [...(settings.quickPicks || []), ...legacy], playlist: {}};
};
