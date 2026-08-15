// Preset chores for the quick-add picker, so setting up a household does not
// mean typing 30 names on a wall tablet. `key` is stored on the created chore
// so the picker knows what is already added.

export const CHORE_LIBRARY = [
  {
    key: 'kitchen',
    label: {en: 'Kitchen', sv: 'Kök'},
    chores: [
      {key: 'setTable', icon: 'silverware-fork-knife', points: 2, recurrence: 'daily', en: 'Set the table', sv: 'Duka bordet'},
      {key: 'clearTable', icon: 'silverware-clean', points: 2, recurrence: 'daily', en: 'Clear the table', sv: 'Duka av bordet'},
      {key: 'loadDishwasher', icon: 'dishwasher', points: 2, recurrence: 'daily', en: 'Load the dishwasher', sv: 'Fylla diskmaskinen'},
      {key: 'emptyDishwasher', icon: 'dishwasher', points: 2, recurrence: 'daily', en: 'Empty the dishwasher', sv: 'Tömma diskmaskinen'},
      {key: 'wipeCounters', icon: 'spray-bottle', points: 2, recurrence: 'daily', en: 'Wipe the counters', sv: 'Torka av bänkarna'},
      {key: 'cookDinner', icon: 'chef-hat', points: 5, recurrence: 'daily', en: 'Cook dinner', sv: 'Laga middag'},
      {key: 'packLunch', icon: 'food-apple', points: 3, recurrence: 'daily', en: 'Pack lunch', sv: 'Packa matlåda'},
    ],
  },
  {
    key: 'cleaning',
    label: {en: 'Cleaning', sv: 'Städning'},
    chores: [
      {key: 'vacuum', icon: 'vacuum', points: 5, recurrence: 'weekly', en: 'Vacuum', sv: 'Dammsuga'},
      {key: 'mopFloor', icon: 'bucket-outline', points: 5, recurrence: 'weekly', en: 'Mop the floor', sv: 'Moppa golvet'},
      {key: 'dust', icon: 'feather', points: 3, recurrence: 'weekly', en: 'Dust the shelves', sv: 'Damma hyllorna'},
      {key: 'tidyLivingRoom', icon: 'sofa', points: 3, recurrence: 'daily', en: 'Tidy the living room', sv: 'Plocka undan i vardagsrummet'},
      {key: 'takeOutTrash', icon: 'trash-can-outline', points: 3, recurrence: 'weekly', en: 'Take out the trash', sv: 'Ta ut soporna'},
      {key: 'recycling', icon: 'recycle', points: 3, recurrence: 'weekly', en: 'Sort the recycling', sv: 'Sortera återvinningen'},
      {key: 'windows', icon: 'window-closed-variant', points: 8, recurrence: 'monthly', en: 'Clean the windows', sv: 'Putsa fönstren'},
    ],
  },
  {
    key: 'bedroom',
    label: {en: 'Bedroom', sv: 'Sovrum'},
    chores: [
      {key: 'makeBed', icon: 'bed', points: 2, recurrence: 'daily', en: 'Make the bed', sv: 'Bädda sängen'},
      {key: 'tidyRoom', icon: 'teddy-bear', points: 3, recurrence: 'daily', en: 'Tidy your room', sv: 'Städa ditt rum'},
      {key: 'changeSheets', icon: 'bed-outline', points: 5, recurrence: 'monthly', en: 'Change the sheets', sv: 'Byta lakan'},
      {key: 'putAwayToys', icon: 'controller-classic', points: 2, recurrence: 'daily', en: 'Put away the toys', sv: 'Plocka undan leksakerna'},
    ],
  },
  {
    key: 'laundry',
    label: {en: 'Laundry', sv: 'Tvätt'},
    chores: [
      {key: 'runLaundry', icon: 'washing-machine', points: 3, recurrence: 'weekly', en: 'Run the laundry', sv: 'Köra en tvätt'},
      {key: 'hangLaundry', icon: 'hanger', points: 3, recurrence: 'weekly', en: 'Hang the laundry', sv: 'Hänga tvätten'},
      {key: 'foldLaundry', icon: 'tshirt-crew', points: 3, recurrence: 'weekly', en: 'Fold the laundry', sv: 'Vika tvätten'},
      {key: 'putAwayClothes', icon: 'wardrobe-outline', points: 2, recurrence: 'weekly', en: 'Put away your clothes', sv: 'Lägg in dina kläder'},
      {key: 'ironing', icon: 'iron', points: 5, recurrence: 'weekly', en: 'Do the ironing', sv: 'Stryka kläder'},
    ],
  },
  {
    key: 'bathroom',
    label: {en: 'Bathroom', sv: 'Badrum'},
    chores: [
      {key: 'cleanBathroom', icon: 'shower', points: 8, recurrence: 'weekly', en: 'Clean the bathroom', sv: 'Städa badrummet'},
      {key: 'cleanToilet', icon: 'toilet', points: 5, recurrence: 'weekly', en: 'Clean the toilet', sv: 'Rengöra toaletten'},
      {key: 'freshTowels', icon: 'tshirt-crew-outline', points: 2, recurrence: 'weekly', en: 'Fresh towels', sv: 'Byta handdukar'},
    ],
  },
  {
    key: 'pets',
    label: {en: 'Pets', sv: 'Husdjur'},
    chores: [
      {key: 'walkDog', icon: 'dog', points: 5, recurrence: 'daily', en: 'Walk the dog', sv: 'Gå ut med hunden'},
      {key: 'feedPets', icon: 'paw', points: 2, recurrence: 'daily', en: 'Feed the pets', sv: 'Mata djuren'},
      {key: 'litterBox', icon: 'cat', points: 3, recurrence: 'daily', en: 'Clean the litter box', sv: 'Rensa kattlådan'},
      {key: 'feedFish', icon: 'fish', points: 2, recurrence: 'daily', en: 'Feed the fish', sv: 'Mata fiskarna'},
    ],
  },
  {
    key: 'outdoor',
    label: {en: 'Outdoor', sv: 'Utomhus'},
    chores: [
      {key: 'waterPlants', icon: 'watering-can', points: 3, recurrence: 'weekly', en: 'Water the plants', sv: 'Vattna blommorna'},
      {key: 'mowLawn', icon: 'grass', points: 8, recurrence: 'weekly', en: 'Mow the lawn', sv: 'Klippa gräset'},
      {key: 'rakeLeaves', icon: 'leaf', points: 5, recurrence: 'weekly', en: 'Rake the leaves', sv: 'Kratta löv'},
      {key: 'shovelSnow', icon: 'snowflake', points: 5, recurrence: 'daily', en: 'Shovel the snow', sv: 'Skotta snö'},
      {key: 'washCar', icon: 'car-wash', points: 8, recurrence: 'monthly', en: 'Wash the car', sv: 'Tvätta bilen'},
      {key: 'getMail', icon: 'mailbox', points: 1, recurrence: 'daily', en: 'Get the mail', sv: 'Hämta posten'},
    ],
  },
  {
    key: 'school',
    label: {en: 'School', sv: 'Skola'},
    chores: [
      {key: 'homework', icon: 'book-open-page-variant', points: 5, recurrence: 'daily', en: 'Do your homework', sv: 'Göra läxorna'},
      {key: 'packBag', icon: 'school', points: 2, recurrence: 'daily', en: 'Pack your school bag', sv: 'Packa skolväskan'},
      {key: 'reading', icon: 'pencil', points: 3, recurrence: 'daily', en: 'Read for 20 minutes', sv: 'Läs i 20 minuter'},
      {key: 'practice', icon: 'music', points: 3, recurrence: 'daily', en: 'Practice your instrument', sv: 'Öva på instrumentet'},
    ],
  },
  {
    key: 'selfcare',
    label: {en: 'Routines', sv: 'Rutiner'},
    chores: [
      {key: 'brushTeeth', icon: 'tooth-outline', points: 1, recurrence: 'daily', en: 'Brush teeth', sv: 'Borsta tänderna'},
      {key: 'shower', icon: 'shower-head', points: 1, recurrence: 'daily', en: 'Shower', sv: 'Duscha'},
      {key: 'screenTimeOff', icon: 'television-off', points: 2, recurrence: 'daily', en: 'Screens off on time', sv: 'Släck skärmarna i tid'},
      {key: 'bedTime', icon: 'weather-night', points: 2, recurrence: 'daily', en: 'In bed on time', sv: 'I säng i tid'},
    ],
  },
  {
    key: 'errands',
    label: {en: 'Errands', sv: 'Ärenden'},
    chores: [
      {key: 'groceries', icon: 'shopping', points: 5, recurrence: 'weekly', en: 'Do the grocery shopping', sv: 'Handla mat'},
      {key: 'unpackGroceries', icon: 'cart', points: 3, recurrence: 'weekly', en: 'Unpack the groceries', sv: 'Plocka upp maten'},
      {key: 'parcels', icon: 'package-variant', points: 3, recurrence: 'once', en: 'Collect the parcel', sv: 'Hämta paketet'},
      {key: 'changeBulbs', icon: 'lightbulb', points: 2, recurrence: 'once', en: 'Change the light bulbs', sv: 'Byta glödlampor'},
    ],
  },
];

export const libraryChoreName = (preset, lang) =>
  (lang === 'sv' ? preset.sv : preset.en) || preset.en;
