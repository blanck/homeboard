// Meals are stored per local date: config.meals.days['YYYY-MM-DD'] = meal
export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Monday-based week, the norm in Sweden and most of Europe
export const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));

export const hasMeal = (meal) => !!(meal && (meal.name || meal.url));

export const hasRecipe = (meal) => !!(meal?.ingredients?.length || meal?.steps?.length || meal?.url);

// Keeps a week of history so "copy last week" still has something to copy
export const pruneMeals = (days = {}, today = new Date()) => {
  const cutoff = dateKey(addDays(today, -8));
  return Object.fromEntries(
    Object.entries(days).filter(([key, meal]) => key >= cutoff && hasMeal(meal)),
  );
};
