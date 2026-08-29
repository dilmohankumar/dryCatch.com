import { useState } from "react";
import Logo from "../Logo.jsx";

const MailIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const SocialIcon = ({ children, href = "#" }) => (
  <a href={href} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
    {children}
  </a>
);

const FOOTER_SHOP = ["Prawns", "Anchovies", "Sardines", "Mackerel", "Bombay Duck", "Tuna", "Squid", "Combo Packs"];
const FOOTER_HELP = ["Contact Us", "Help Center", "Shipping", "Track Order", "Accessibility", "FAQs"];
const FOOTER_COMPANY = ["About Us", "Our Story", "Our Team", "Careers", "Traceable Sourcing", "Media Inquiries"];
const FOOTER_ACCOUNT = ["Your Account", "Order History", "Wishlist", "Refer a Friend", "Easy Reorder"];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  // Demo-only handler — no backend wired up yet, just gives visual feedback.
  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 3000);
  };

  return (
    <footer className="bg-[#0E0E0E] text-white">
      {/* Statement + newsletter */}
      <div className="max-w-7xl mx-auto px-6 py-12 sm:py-14 grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-14 items-start border-b border-white/10">
        <div className="flex flex-col gap-4">
          <div className="text-white [&_.font-logo]:text-white">
            <Logo showCharacters={false} />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-extrabold leading-snug">
            100% Committed to Our Customers
          </h3>
          <p className="text-sm text-white/60 leading-relaxed max-w-md">
            At drycatch, customer satisfaction is our top priority. If you
            experience a problem with our products, service, or shipping,
            please let us know — we'll do whatever it takes to make it right.
          </p>
          <div className="flex gap-3 mt-1">
            <SocialIcon>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </SocialIcon>
            <SocialIcon>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </SocialIcon>
            <SocialIcon href="https://wa.me/918657537954">
              <WhatsAppIcon />
            </SocialIcon>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div className="max-w-sm md:text-right">
            <h4 className="font-bold text-base">Be the first to know</h4>
            <p className="text-sm text-white/60 mt-1">
              New products, promos &amp; exclusive offers — straight to your inbox.
            </p>
          </div>
          <form onSubmit={handleSubscribe} className="flex w-full max-w-sm gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your Email"
              className="flex-1 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-white/40"
            />
            <button
              type="submit"
              className="bg-[#F4B740] hover:bg-[#e0a52f] text-gray-900 font-bold px-5 py-2.5 rounded-full text-sm transition-colors flex-shrink-0"
            >
              {subscribed ? "Subscribed ✓" : "Subscribe"}
            </button>
          </form>
          <p className="text-[11px] text-white/40 max-w-sm md:text-right">
            By signing up for updates, you agree to our{" "}
            <a href="#" className="underline hover:text-white/70">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* Link columns */}
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div>
          <h4 className="font-bold text-sm mb-4 uppercase tracking-wide text-white/90">Shop</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-white/60">
            {FOOTER_SHOP.map((item) => (
              <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-4 uppercase tracking-wide text-white/90">Help</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-white/60">
            {FOOTER_HELP.map((item) => (
              <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
            ))}
            <li>
              <a href="mailto:hello@drycatch" className="flex items-center gap-2 hover:text-white transition-colors">
                <MailIcon /> hello@drycatch
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-4 uppercase tracking-wide text-white/90">Company</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-white/60">
            {FOOTER_COMPANY.map((item) => (
              <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm mb-4 uppercase tracking-wide text-white/90">Your Account</h4>
          <ul className="flex flex-col gap-2.5 text-sm text-white/60">
            {FOOTER_ACCOUNT.map((item) => (
              <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/40">
            <span>Copyright © 2026 drycatch. All rights reserved.</span>
            <a href="#" className="hover:text-white/70">Privacy Policy</a>
            <a href="#" className="hover:text-white/70">Terms &amp; Conditions</a>
            <a href="#" className="hover:text-white/70">Do Not Sell My Personal Information</a>
          </div>
          <div className="flex gap-2 opacity-60 flex-shrink-0">
            <div className="bg-white/10 rounded px-2 py-1 text-[10px] font-bold">VISA</div>
            <div className="bg-white/10 rounded px-2 py-1 text-[10px] font-bold">MC</div>
            <div className="bg-white/10 rounded px-2 py-1 text-[10px] font-bold">UPI</div>
            <div className="bg-white/10 rounded px-2 py-1 text-[10px] font-bold">COD</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
