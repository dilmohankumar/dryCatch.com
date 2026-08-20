import ContentRevision from "../../models/ContentRevision.js";

// One generic revision writer/reader for both Page and BlogPost (rule
// #72-75). Append-only — nothing in this file ever updates or deletes a
// revision.
export async function recordRevision(contentType, contentId, version, snapshot, authorId, changeSummary) {
  return ContentRevision.create({ contentType, contentId, version, snapshot, author: authorId, changeSummary });
}

export async function listRevisions(contentType, contentId) {
  return ContentRevision.find({ contentType, contentId }).sort({ version: -1 }).populate("author", "firstName lastName");
}

export async function getRevision(contentType, contentId, version) {
  return ContentRevision.findOne({ contentType, contentId, version });
}
