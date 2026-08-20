import FAQ from "../../models/FAQ.js";
import { sanitizePlainText } from "../../utils/sanitizeText.js";

export async function listFAQs({ category, status } = {}) {
  const filter = {};
  if (category) filter.category = category;
  if (status) filter.status = status;
  return FAQ.find(filter).sort({ category: 1, order: 1 });
}

export async function createFAQ(userId, { question, answer, category, order }) {
  return FAQ.create({ question: sanitizePlainText(question), answer: sanitizePlainText(answer), category, order, createdBy: userId });
}

export async function updateFAQ(id, { question, answer, category, order, status }) {
  const update = {};
  if (question !== undefined) update.question = sanitizePlainText(question);
  if (answer !== undefined) update.answer = sanitizePlainText(answer);
  if (category !== undefined) update.category = category;
  if (order !== undefined) update.order = order;
  if (status !== undefined) update.status = status;
  const faq = await FAQ.findByIdAndUpdate(id, update, { new: true });
  if (!faq) throw Object.assign(new Error("FAQ not found"), { statusCode: 404, code: "FAQ_NOT_FOUND" });
  return faq;
}

export async function deleteFAQ(id) {
  await FAQ.findByIdAndDelete(id);
}
