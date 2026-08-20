import FooterConfig from "../../models/FooterConfig.js";

// Singleton (rule #45) — findOneAndUpdate with upsert instead of exposing
// create/delete over what's conceptually always exactly one document.
export async function getFooter() {
  return (await FooterConfig.findOne()) || {};
}

export async function updateFooter(data) {
  return FooterConfig.findOneAndUpdate({}, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
