import * as synonymService from "../services/search/synonymService.js";
import * as searchRuleService from "../services/search/searchRuleService.js";
import * as indexingService from "../services/search/indexingService.js";
import * as searchAnalyticsService from "../services/search/searchAnalyticsService.js";
import { getSearchProvider } from "../services/search/providers/searchProviderFactory.js";

// ---- Synonyms ----
export async function listSynonyms(req, res) {
  res.json({ synonyms: await synonymService.listSynonyms() });
}
export async function createSynonym(req, res) {
  res.status(201).json({ synonym: await synonymService.createSynonym(req.user._id, req.body) });
}
export async function updateSynonym(req, res) {
  res.json({ synonym: await synonymService.updateSynonym(req.params.id, req.body) });
}
export async function deleteSynonym(req, res) {
  await synonymService.deleteSynonym(req.params.id);
  res.json({ ok: true });
}

// ---- Merchandising rules ----
export async function listRules(req, res) {
  res.json({ rules: await searchRuleService.listRules(req.query) });
}
export async function createRule(req, res) {
  res.status(201).json({ rule: await searchRuleService.createRule(req.user._id, req.body) });
}
export async function updateRule(req, res) {
  res.json({ rule: await searchRuleService.updateRule(req.params.id, req.body) });
}
export async function deleteRule(req, res) {
  await searchRuleService.deleteRule(req.params.id);
  res.json({ ok: true });
}

// ---- Indexing ----
export async function postReindex(req, res) {
  const result = await indexingService.reindexAll();
  res.json(result);
}
export async function postReconcile(req, res) {
  const result = await indexingService.reconcile();
  res.json(result);
}
export async function getHealth(req, res) {
  const health = await getSearchProvider().healthCheck();
  res.json(health);
}

// ---- Analytics dashboard ----
export async function getAnalytics(req, res) {
  const days = Number(req.query.days) || 30;
  const [topQueries, zeroResultQueries, ctr, zeroResultRate] = await Promise.all([
    searchAnalyticsService.getTopQueries({ days }),
    searchAnalyticsService.getZeroResultQueries({ days }),
    searchAnalyticsService.getClickThroughRate({ days }),
    searchAnalyticsService.getZeroResultRate({ days }),
  ]);
  res.json({ topQueries, zeroResultQueries, ctr, zeroResultRate });
}
