import { useEffect, useRef } from "react";
import { contentAPI } from "../../../utils/api.js";
import { resolveImageUrl } from "../cmsUtils.js";

export default function BannerBlock({ data = {} }) {
  const banner = data.banner;
  const fired = useRef(false);

  useEffect(() => {
    if (!banner?._id || fired.current) return;
    fired.current = true; // guards StrictMode's double-invoke of effects in dev
    contentAPI.trackBannerImpression(banner._id).catch(() => {});
  }, [banner?._id]);

  if (!banner) return null;
  const imageUrl = resolveImageUrl(banner.image);
  const mobileImageUrl = resolveImageUrl(banner.mobileImage);
  if (!imageUrl) return null;

  const handleClick = () => {
    contentAPI.trackBannerClick(banner._id).catch(() => {});
    // fire-and-forget — never blocks the actual navigation via the <a> href
  };

  return (
    <section className="w-full">
      <a href={banner.link || "#"} onClick={handleClick} className="block">
        <picture>
          {mobileImageUrl && <source media="(max-width: 640px)" srcSet={mobileImageUrl} />}
          <img src={imageUrl} alt={banner.title || banner.cta || ""} className="w-full h-auto object-cover" />
        </picture>
      </a>
    </section>
  );
}
