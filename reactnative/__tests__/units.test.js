import {convertUnits, deviceUnits, resolveUnits} from '../src/utils/units';

const metric = text => convertUnits(text, 'metric');
const imperial = text => convertUnits(text, 'imperial');

describe('to imperial', () => {
  test.each([
    ['500 g de farine', '1.1 lb de farine'],
    ['100g self-raising flour', '3.5 oz self-raising flour'],
    ['Spaghetti 320 g', 'Spaghetti 11.5 oz'],
    ['1 x 300g tin of peeled new potatoes', '1 x 10.5 oz tin of peeled new potatoes'],
    ['4 dl mjölk', '1⅔ cups mjölk'],
    ['2,5 dl grädde', '1 cup grädde'],
    ['1-2 dl vatten', '½-¾ cup vatten'],
    ['300ml milk', '1¼ cups milk'],
    ['2 l vatten', '2.1 qt vatten'],
    ['1 krm salt', '1 krm salt'],
    ['2 msk smör', '2 msk smör'],
  ])('%s', (input, expected) => expect(imperial(input)).toBe(expected));
});

describe('to metric', () => {
  test.each([
    ['1/2 pound elbow macaroni', '230 g elbow macaroni'],
    ['2 lb boneless, skinless chicken thighs, cubed', '910 g boneless, skinless chicken thighs, cubed'],
    ['1 cup soy sauce', '240 ml soy sauce'],
    ['1½ cups raw walnuts', '350 ml raw walnuts'],
    ['1 1/2 cups milk', '350 ml milk'],
    ['½ cup plain breadcrumbs (70g, $0.17*)', '120 ml plain breadcrumbs (70g, $0.17*)'],
    [
      '1 (4-pound) pumpkin (or 2 (15-ounce) cans pumpkin puree)',
      '1 (1.8 kg) pumpkin (or 2 (430 g) cans pumpkin puree)',
    ],
    ['8 fl oz stock', '240 ml stock'],
    ['2 to 3 cups water', '470-710 ml water'],
    ['3 tablespoons butter', '3 tablespoons butter'],
    ['2 large eggs', '2 large eggs'],
  ])('%s', (input, expected) => expect(metric(input)).toBe(expected));
});

describe('text already in both systems stays put', () => {
  test.each([
    ['200g/7oz butter'],
    ['3 1/2 cups (397g) apples, peeled'],
    ['1 tbsp (15ml) oil'],
  ])('%s', input => {
    expect(metric(input)).toBe(input);
    expect(imperial(input)).toBe(input);
  });
});

describe('oven temperatures', () => {
  test.each([
    ['Sätt ugnen på 200 grader varmluft.', 'Sätt ugnen på 400°F varmluft.'],
    ['Heat oven to 200C/180C fan/gas 6.', 'Heat oven to 400°F/350°F fan/gas 6.'],
    ['Bake at 180-200 °C', 'Bake at 350-400°F'],
  ])('%s to imperial', (input, expected) => expect(imperial(input)).toBe(expected));

  test.each([
    ['Preheat the oven to 350°F.', 'Preheat the oven to 180°C.'],
    ['Bake at 425 F for 20 minutes', 'Bake at 220°C for 20 minutes'],
  ])('%s to metric', (input, expected) => expect(metric(input)).toBe(expected));

  test('leaves a line that already gives both alone', () => {
    expect(imperial('Bake at 180C/350F')).toBe('Bake at 180C/350F');
  });
});

describe('defaults', () => {
  const realIntl = global.Intl;
  const device = (locale, timeZone) => {
    global.Intl = {
      DateTimeFormat: function () {
        return {resolvedOptions: () => ({locale, timeZone})};
      },
    };
  };
  afterEach(() => {
    global.Intl = realIntl;
  });

  test('follows the device region', () => {
    device('en-US', 'America/Chicago');
    expect(deviceUnits()).toBe('imperial');
    device('sv-SE', 'Europe/Stockholm');
    expect(deviceUnits()).toBe('metric');
    device('en-GB', 'Europe/London');
    expect(deviceUnits()).toBe('metric');
  });

  test('a tablet left on en-US abroad stays metric', () => {
    device('en-US', 'Europe/Stockholm');
    expect(deviceUnits()).toBe('metric');
  });

  test('an explicit choice beats the device', () => {
    device('sv-SE', 'Europe/Stockholm');
    expect(resolveUnits('imperial')).toBe('imperial');
    expect(resolveUnits('auto')).toBe('metric');
  });
});
