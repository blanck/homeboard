import {legacyToQuickPicks, migratePlaylists} from '../src/utils/quickPicks';

const legacy = {
  dinner: {title: 'Dinner', type: 'spotify', list: [['spotify:playlist:1', 'Trattoria']]},
  radio: {title: 'Radio', type: 'radio', list: [['s41848', 'Cat Country']]},
};

test('converts old playlists into quick pick categories', () => {
  expect(legacyToQuickPicks(legacy)).toEqual([
    {name: 'Dinner', items: [{title: 'Trattoria', uri: 'spotify:playlist:1'}]},
    {name: 'Radio', items: [{title: 'Cat Country', uri: 's41848', radio: true}]},
  ]);
});

test('migration appends to existing quick picks and clears the old shape', () => {
  const out = migratePlaylists({quickPicks: [{name: 'Mine', items: []}], playlist: legacy});
  expect(out.quickPicks.map((c) => c.name)).toEqual(['Mine', 'Dinner', 'Radio']);
  expect(out.playlist).toEqual({});
});

test('nothing to migrate returns null', () => {
  expect(migratePlaylists({playlist: {}})).toBeNull();
  expect(migratePlaylists({})).toBeNull();
});
