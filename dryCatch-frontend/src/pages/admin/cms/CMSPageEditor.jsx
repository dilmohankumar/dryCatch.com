import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cmsPagesAPI } from "../../../utils/api.js";
import { friendlyError, STATUS_LABELS } from "./cmsAdminUtils.js";

const BLOCK_TYPES = [
  "hero", "richText", "image", "imageText", "productGrid", "categoryGrid",
  "collectionGrid", "banner", "faq", "testimonials", "newsletter", "cta",
  "blogGrid", "reviewSummary", "spacer",
];

function newBlockRow(type = "richText") {
  return { type, dataText: "{}" };
}

// Converts a saved page's blocks (real objects) into the editor's row shape
// (type + a JSON textarea string per block, kept in sync on every edit).
function blocksToRows(blocks = []) {
  return blocks
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((b) => ({ type: b.type, dataText: JSON.stringify(b.data || {}, null, 2) }));
}

export default function CMSPageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [page, setPage] = useState(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [pageType, setPageType] = useState("static");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    cmsPagesAPI
      .getById(id)
      .then((res) => {
        const p = res.page;
        setPage(p);
        setTitle(p.title || "");
        setSlug(p.slug || "");
        setPageType(p.pageType || "static");
        setSeoTitle(p.seo?.title || "");
        setSeoDescription(p.seo?.metaDescription || "");
        setRows(blocksToRows(p.blocks));
      })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const isPublished = page?.status === "published" || page?.status === "archived";

  const addBlock = () => setRows((r) => [...r, newBlockRow()]);
  const removeBlock = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const moveBlock = (i, dir) => {
    setRows((r) => {
      const next = [...r];
      const j = i + dir;
      if (j < 0 || j >= next.length) return r;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const updateRowType = (i, type) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, type } : row)));
  const updateRowData = (i, dataText) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, dataText } : row)));

  const buildBlocksPayload = () => {
    return rows.map((row, i) => {
      let data;
      try {
        data = JSON.parse(row.dataText || "{}");
      } catch {
        throw new Error(`Block ${i + 1} (${row.type}): data is not valid JSON.`);
      }
      return { type: row.type, order: i, data };
    });
  };

  const handleSave = async () => {
    setSaveError(null);
    let blocks;
    try {
      blocks = buildBlocksPayload();
    } catch (err) {
      setSaveError(err.message);
      return;
    }

    const payload = {
      title,
      slug,
      pageType,
      blocks,
      seo: { title: seoTitle, metaDescription: seoDescription },
    };

    setSaving(true);
    try {
      if (isNew) {
        const res = await cmsPagesAPI.create(payload);
        navigate(`/admin/cms/pages/${res.page._id}`, { replace: true });
      } else {
        const res = await cmsPagesAPI.update(id, payload);
        setPage(res.page);
      }
    } catch (err) {
      setSaveError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSendBack = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      const res = await cmsPagesAPI.sendBack(id);
      setPage(res.page);
    } catch (err) {
      setSaveError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-400 text-center py-10">Loading…</div>;
  if (error) return <div className="text-sm text-red-500 text-center py-10">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? "New Page" : "Edit Page"}</h1>
        {page && (
          <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">
            {STATUS_LABELS[page.status] || page.status}
          </span>
        )}
      </div>

      {isPublished && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-5 flex items-center justify-between gap-4">
          <span>
            This page is {page.status} and can't be edited directly. Send it back to draft first.
          </span>
          <button
            disabled={busy}
            onClick={handleSendBack}
            className="bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
          >
            Send Back to Draft
          </button>
        </div>
      )}

      {saveError && <p className="text-sm text-red-500 mb-4 whitespace-pre-wrap">{saveError}</p>}

      <fieldset disabled={isPublished} className="space-y-5 disabled:opacity-60">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-gray-600 font-medium">Page Type</span>
          <select
            value={pageType}
            onChange={(e) => setPageType(e.target.value)}
            className="mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
          >
            <option value="static">Static</option>
            <option value="landing">Landing</option>
            <option value="homepage">Homepage</option>
          </select>
        </label>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3">SEO</h2>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-gray-600">Meta Title</span>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Meta Description</span>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
              />
            </label>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">Blocks</h2>
            <button
              type="button"
              onClick={addBlock}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              + Add Block
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-gray-400">No blocks yet.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
                    <select
                      value={row.type}
                      onChange={(e) => updateRowType(i, e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
                    >
                      {BLOCK_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <div className="ml-auto flex gap-2">
                      <button type="button" onClick={() => moveBlock(i, -1)} className="text-xs text-gray-500 hover:text-gray-800">↑</button>
                      <button type="button" onClick={() => moveBlock(i, 1)} className="text-xs text-gray-500 hover:text-gray-800">↓</button>
                      <button type="button" onClick={() => removeBlock(i)} className="text-xs text-red-500 hover:underline">Remove</button>
                    </div>
                  </div>
                  <textarea
                    value={row.dataText}
                    onChange={(e) => updateRowData(i, e.target.value)}
                    rows={5}
                    spellCheck={false}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="bg-[#1A3A5C] text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#142d47] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
      </fieldset>
    </div>
  );
}
