import { useEffect, useState } from "react";
import PromoGrid from "../components/home/PromoGrid";
import CategoryStrip from "../components/home/CategoryStrip";
import HeroBanner from "../components/home/HeroBanner";
import ScallopDivider from "../components/home/ScallopDivider";
import ProductCarousel from "../components/home/ProductCarousel";
import TrustBar from "../components/home/TrustBar";
import CustomizeSection from "../components/home/CustomizeSection";
import Testimonials from "../components/home/Testimonials";
import FeaturedIn from "../components/home/FeaturedIn";
import ShopByType from "../components/home/ShopByType";
import BrandStory from "../components/home/BrandStory";
import BlockRenderer from "../components/cms/BlockRenderer.jsx";
import { productsAPI, contentAPI } from "../utils/api";
import { normalizeProducts } from "../utils/productAdapters";
import { cacheProducts } from "../utils/productCache";
import { NAV_CATEGORIES, TRUST_POINTS, CATCH_TYPES, TESTIMONIALS, FEATURED_IN } from "../data/homeData";
import { useSEO } from "../hooks/useSEO.js";


function DefaultHome({ cart, onInc, onDec, onFirstAdd, onProductClick, onShopNow, onCategorySelect, bestsellers }) {
  const AMBER = "#F0A63C";
  return (
    <>
      {/* 1. Promo grid hero (large left + 2 stacked right) */}
      <PromoGrid onShopNow={onShopNow} />

      {/* 2. Circular category shortcuts */}
      <CategoryStrip categories={NAV_CATEGORIES} onSelect={onCategorySelect} />

      {/* 3. Amber block: "Don't Overthink It" + best sellers */}
      <ScallopDivider baseColor={AMBER} bumpColor="#ffffff" bumpsAt="top" />
      <div className="bg-[#F0A63C]">
        <HeroBanner onShopNow={onShopNow} />
        <ProductCarousel
          title="Explore Greatest Hits"
          subtitle="The Dry Catch our customers never order just once"
          products={bestsellers}
          cart={cart}
          onInc={onInc}
          onDec={onDec}
          onFirstAdd={onFirstAdd}
          onProductClick={onProductClick}
          onViewAll={onShopNow}
          viewAllLabel="View All"
          onOrange
        />
      </div>

      <TrustBar points={TRUST_POINTS} />

      <CustomizeSection onCustomize={onShopNow} />

      <Testimonials testimonials={TESTIMONIALS} />

      <FeaturedIn mentions={FEATURED_IN} />

      <ShopByType types={CATCH_TYPES} onSelect={onCategorySelect} onExploreMore={onShopNow} />

      <BrandStory onShopNow={onShopNow} />
    </>
  );
}

export default function Home({
  cart = {},
  onInc = () => {},
  onDec = () => {},
  onFirstAdd = () => {},
  onProductClick = () => {},
  onShopNow = () => {},
  onCategorySelect = () => {},
}) {
  const [bestsellers, setBestsellers] = useState([]);
  const [cmsBlocks, setCmsBlocks] = useState(null); // null = still loading, [] = loaded-but-empty
  const [cmsSeo, setCmsSeo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    productsAPI
      .getFeatured()
      .then((data) => {
        if (cancelled) return;
        const normalized = normalizeProducts(data.products || []);
        cacheProducts(normalized);
        setBestsellers(normalized);
      })
      .catch(() => {
        if (!cancelled) setBestsellers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    contentAPI
      .getHomepage()
      .then((data) => {
        if (cancelled) return;
        setCmsBlocks(Array.isArray(data.blocks) ? data.blocks : []);
        setCmsSeo(data.seo || null);
      })
      .catch(() => {
        if (!cancelled) setCmsBlocks([]); // CMS unreachable — fall back to the default homepage
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Phase 23 — centralized metadata (replaces the previous manual title/
  // meta-description effect) + Organization/WebSite structured data, since
  // the homepage is the natural place for site-wide schema.org markup.
  useSEO({
    title: cmsSeo?.title || "DryCatch — Coastal Dry Catch, Delivered",
    description: cmsSeo?.metaDescription,
    canonical: "/",
    jsonLd: [
      { "@context": "https://schema.org", "@type": "Organization", name: "DryCatch", url: window.location.origin },
      { "@context": "https://schema.org", "@type": "WebSite", name: "DryCatch", url: window.location.origin },
    ],
  });

  const hasCmsContent = Array.isArray(cmsBlocks) && cmsBlocks.length > 0;

  return (
    <div className="flex-1 min-w-0 w-full bg-white">
      {hasCmsContent ? (
        <BlockRenderer blocks={cmsBlocks} />
      ) : (
        <DefaultHome
          cart={cart}
          onInc={onInc}
          onDec={onDec}
          onFirstAdd={onFirstAdd}
          onProductClick={onProductClick}
          onShopNow={onShopNow}
          onCategorySelect={onCategorySelect}
          bestsellers={bestsellers}
        />
      )}
    </div>
  );
}
