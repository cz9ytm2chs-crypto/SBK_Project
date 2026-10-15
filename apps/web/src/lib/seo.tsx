/**
 * Page head tags. React 19 hoists <title>/<meta>/<link> into <head>.
 * In production the server also injects these for crawlers (apps/api/src/seo).
 */
export function Seo({
  title,
  description,
  image,
  noindex,
  canonical,
  jsonLd,
}: {
  title: string;
  description?: string;
  image?: string | null;
  noindex?: boolean;
  canonical?: string;
  jsonLd?: unknown;
}) {
  const fullTitle = title.includes('SILT') ? title : `${title} — SILT`;
  const url = canonical ?? (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined);
  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {url && <link rel="canonical" href={url} />}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      ) : null}
    </>
  );
}
