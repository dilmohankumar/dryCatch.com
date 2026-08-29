import { Component } from "react";
import HeroBlock from "./blocks/HeroBlock.jsx";
import RichTextBlock from "./blocks/RichTextBlock.jsx";
import ImageBlock from "./blocks/ImageBlock.jsx";
import ImageTextBlock from "./blocks/ImageTextBlock.jsx";
import ProductGridBlock from "./blocks/ProductGridBlock.jsx";
import CategoryGridBlock from "./blocks/CategoryGridBlock.jsx";
import CollectionGridBlock from "./blocks/CollectionGridBlock.jsx";
import BannerBlock from "./blocks/BannerBlock.jsx";
import FAQBlock from "./blocks/FAQBlock.jsx";
import TestimonialsBlock from "./blocks/TestimonialsBlock.jsx";
import NewsletterBlock from "./blocks/NewsletterBlock.jsx";
import CTABlock from "./blocks/CTABlock.jsx";
import BlogGridBlock from "./blocks/BlogGridBlock.jsx";
import ReviewSummaryBlock from "./blocks/ReviewSummaryBlock.jsx";
import SpacerBlock from "./blocks/SpacerBlock.jsx";

// Centralized type -> component catalog (mirrors the backend's
// blockRegistry.js single-source-of-truth pattern) — adding a block type
// means adding one entry here, never a growing if/else chain. `blogGrid`
// IS registered here even though the backend doesn't pre-resolve its posts
// (see contentApiService.js/docs/cms.md) — BlogGridBlock fetches its own
// posts via contentAPI, per this phase's deliverables.
const REGISTRY = {
  hero: HeroBlock,
  richText: RichTextBlock,
  image: ImageBlock,
  imageText: ImageTextBlock,
  productGrid: ProductGridBlock,
  categoryGrid: CategoryGridBlock,
  collectionGrid: CollectionGridBlock,
  banner: BannerBlock,
  faq: FAQBlock,
  testimonials: TestimonialsBlock,
  newsletter: NewsletterBlock,
  cta: CTABlock,
  blogGrid: BlogGridBlock,
  reviewSummary: ReviewSummaryBlock,
  spacer: SpacerBlock,
};

// One broken/unknown block must never take down the whole page — each
// block gets its own error boundary (a plain try/catch around JSX creation
// wouldn't catch errors React throws while actually rendering the
// component, so a real error boundary class is used instead).
class BlockErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("[CMS] block render failed:", error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function BlockRenderer({ blocks = [] }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  // Blocks with visibility:"hidden" are already filtered server-side —
  // no client-side re-filtering here (docs/cms.md).
  const ordered = [...blocks].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));

  return (
    <>
      {ordered.map((block, i) => {
        if (!block || !block.type) return null;
        const BlockComponent = REGISTRY[block.type];
        if (!BlockComponent) return null; // unknown block type — skip silently
        return (
          <BlockErrorBoundary key={block._id || `${block.type}-${i}`}>
            <BlockComponent data={block.data || {}} settings={block.settings || {}} />
          </BlockErrorBoundary>
        );
      })}
    </>
  );
}
