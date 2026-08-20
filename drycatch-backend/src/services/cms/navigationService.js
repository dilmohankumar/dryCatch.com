import NavigationMenu from "../../models/NavigationMenu.js";

// One document per named menu, upserted — never a growing collection of
// near-duplicate "header" menus (rule #41/#45's singleton-per-name shape).
export async function getMenu(name) {
  return NavigationMenu.findOne({ name }) || { name, items: [] };
}

export async function updateMenu(name, items) {
  return NavigationMenu.findOneAndUpdate({ name }, { $set: { items } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

export async function listMenus() {
  return NavigationMenu.find();
}
