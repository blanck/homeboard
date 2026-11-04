import {jsonAt, parseArla, parseBbcGoodFood, parseWordPress, mergeResults} from '../src/utils/recipeSearch';

test('arla cards come out of the entity-encoded page JSON', () => {
  const html =
    '{&quot;type&quot;:&quot;recipe&quot;,&quot;uid&quot;:&quot;rdb:1&quot;,&quot;title&quot;:&quot;Snabb kebab med vitl&#xF6;kss&#xE5;s&quot;,' +
    '&quot;url&quot;:&quot;/recept/snabb-kebab/&quot;,&quot;imageResizer&quot;:{&quot;name&quot;:&quot;X&quot;},' +
    '&quot;picture&quot;:{&quot;url&quot;:&quot;https://images.arla.com/a.jpg&quot;}}';
  expect(parseArla(html)).toEqual([
    {title: 'Snabb kebab med vitlökssås', url: 'https://www.arla.se/recept/snabb-kebab/', image: 'https://images.arla.com/a.jpg', source: 'Arla'},
  ]);
});

test('bbc good food keeps free recipes from searchResults', () => {
  const html =
    'x "searchResults":{"items":[' +
    '{"title":"Doner kebab","url":"https://www.bbcgoodfood.com/recipes/doner-kebab","isPremium":false,"image":{"url":"i.jpg"},"postType":"recipe"},' +
    '{"title":"Vegan kebabs","url":"https://www.bbcgoodfood.com/premium/vegan-kebabs","isPremium":true,"postType":"recipe"},' +
    '{"title":"Kebab guide","url":"https://www.bbcgoodfood.com/howto/guide","postType":"article"}]} y';
  expect(parseBbcGoodFood(html)).toEqual([
    {title: 'Doner kebab', url: 'https://www.bbcgoodfood.com/recipes/doner-kebab', image: 'i.jpg', source: 'BBC Good Food'},
  ]);
});

test('wordpress posts map to results', () => {
  const json = JSON.stringify([{link: 'https://a/x/', title: {rendered: 'Kofta &amp; sauce'}, yoast_head_json: {og_image: [{url: 'o.jpg'}]}}]);
  expect(parseWordPress(json, 'A')).toEqual([{title: 'Kofta & sauce', url: 'https://a/x/', image: 'o.jpg', source: 'A'}]);
  expect(parseWordPress('<html>', 'A')).toEqual([]);
});

test('jsonAt skips braces inside strings', () => {
  expect(jsonAt('k: {"a":"}{","b":[1,2]} tail', 0)).toEqual({a: '}{', b: [1, 2]});
});

test('merge interleaves sources and drops duplicates', () => {
  const a = [{title: 'a1', url: '1'}, {title: 'a2', url: '2'}];
  const b = [{title: 'b1', url: '3'}, {title: 'dup', url: '1'}];
  expect(mergeResults([a, b]).map((r) => r.title)).toEqual(['a1', 'b1', 'a2']);
});

describe('query handling', () => {
  const {searchTerms, rankByTitle} = require('../src/utils/recipeSearch');

  test('drops filler words in English and Swedish', () => {
    expect(searchTerms('Kebab with pita')).toEqual(['kebab', 'pita']);
    expect(searchTerms('kyckling med ris och sås')).toEqual(['kyckling', 'ris', 'sås']);
  });

  test('ranks titles naming more words first and drops unrelated ones', () => {
    const results = [
      {title: 'Chicken soup', url: 'a'},
      {title: 'Pita bread', url: 'b'},
      {title: 'Chicken kebab in pita', url: 'c'},
    ];
    expect(rankByTitle(results, ['kebab', 'pita']).map((r) => r.url)).toEqual(['c', 'b']);
  });

  test('keeps the site results when no title matches', () => {
    const results = [{title: 'Döner', url: 'a'}];
    expect(rankByTitle(results, ['kebab'])).toEqual(results);
  });
});
