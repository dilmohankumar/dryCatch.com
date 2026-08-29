// Full-width mega menu panel — columns of links + yellow promo cards on the right.
export default function MegaMenu({ menu, onNavigate, onClose }) {
  if (!menu) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 bg-white border-t border-gray-100 shadow-xl"
      onMouseLeave={onClose}
    >
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-8">
        {/* Link columns */}
        <div className="col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {menu.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold text-gray-900 mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate({
                          slug: menu.slug,
                          filter: link.filter,
                          tag: link.tag,
                          label: link.label,
                        });
                        onClose();
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900 hover:underline underline-offset-2 text-left transition-colors"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Promo cards */}
        <div className="col-span-4 flex flex-col gap-4">
          {menu.promos.map((promo) => (
            <button
              key={promo.title}
              type="button"
              onClick={() => {
                onNavigate({
                  slug: menu.slug,
                  filter: promo.filter,
                  tag: promo.tag,
                  label: promo.title,
                });
                onClose();
              }}
              className="text-left group"
            >
              <div className="rounded-xl overflow-hidden bg-[#F4B740] aspect-[16/9] relative">
                <img
                  src={promo.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-logo text-white text-xl sm:text-2xl drop-shadow-md tracking-wide text-center px-3">
                    {promo.subtitle}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-900 group-hover:underline underline-offset-2">
                {promo.title}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
