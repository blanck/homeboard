import {isIngredientHeading, isStepHeading, parseRecipe} from '../src/utils/recipe';

const page = recipe =>
  `<html><script type="application/ld+json">${JSON.stringify(recipe)}</script></html>`;

describe('ingredient headings', () => {
  test.each([
    ['Fresh black pepper', 'foodnetwork.com'],
    ['Salz und Pfeffer', 'chefkoch.de'],
    ['Pepe nero q.b.', 'giallozafferano.it'],
    ['ACEITE DE OLIVA', 'recetasgratis.net'],
  ])('%s from %s is a real ingredient', (item, source) => {
    expect(isIngredientHeading(item, source)).toBe(false);
  });

  test('a colon marks a heading on any site', () => {
    expect(isIngredientHeading('For the sauce:', 'bbcgoodfood.com')).toBe(true);
  });

  test('Köket bare headings still count', () => {
    expect(isIngredientHeading('Till servering', 'koket.se')).toBe(true);
    expect(isIngredientHeading('1 dl sylt', 'koket.se')).toBe(false);
  });
});

test('step headings work beyond Swedish letters', () => {
  expect(isStepHeading('Äppelmos')).toBe(true);
  expect(isStepHeading('Für die Soße')).toBe(true);
  expect(isStepHeading('Bake for 20 minutes.')).toBe(false);
});

test('a single instruction string splits on its line breaks', () => {
  const {steps} = parseRecipe(
    page({'@type': 'Recipe', name: 'X', recipeInstructions: 'Mix it.\nBake it.\n\nServe it.'}),
    'https://example.com/x',
  );
  expect(steps).toEqual(['Mix it.', 'Bake it.', 'Serve it.']);
});

test('falls back to microdata when a page has no JSON-LD', () => {
  const {ingredients, steps} = parseRecipe(
    `<ul><li itemprop="recipeIngredient">1 tablespoon butter</li>
     <li itemprop="recipeIngredient">1 medium onion</li></ul>
     <div class="jetpack-recipe-directions"><p>Heat the pan.</p><p>Add the onion.</p></div>`,
    'https://smittenkitchen.com/x',
  );
  expect(ingredients).toEqual(['1 tablespoon butter', '1 medium onion']);
  expect(steps).toEqual(['Heat the pan.', 'Add the onion.']);
});
