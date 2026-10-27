import { Fragment, type CSSProperties, type ReactElement } from 'react';
import { siteLinkGaAttributes } from '@hagicode/hagilight-core/analytics-events';
import { buildInfoItems, type BuildInfo } from '@hagicode/hagilight-core/build-info';
import { pickFooterBrandLinks, resolveFooterBrand } from '@hagicode/hagilight-core/footer-brand';
import { footerAvatarImageAttributes } from '@hagicode/hagilight-core/footer-avatar';
import { randomPoolAttribute } from '@hagicode/hagilight-core/random-image';
import { withCampaignUtm, type SiteLink } from '@hagicode/hagilight-core/links';
import type { FooterColumnEntry } from '@hagicode/hagilight-core/links';
import type { FooterLinks } from '../../footer.js';

/** The decorative avatar: the vendored default pair and, when the random option is on, the baked pool. */
export interface FooterAvatar {
  avif: string;
  webp: string;
  randomPool?: readonly string[];
}

export interface FooterViewProps {
  links: FooterLinks;
  version: string;
  year: number;
  buildInfo?: BuildInfo;
  avatar?: FooterAvatar;
  /** Identifies the hosting site in campaign tags; without it the brand links stay untagged. */
  siteId?: string;
  /** The hosting site's URL, used only to recognise same-origin destinations that must stay untagged. */
  siteUrl?: string;
  /** The localized "Cookie settings" label. Set only when the consent popup is mounted. */
  consentLabel?: string;
}

function ColumnLink({ entry }: { entry: FooterColumnEntry }): ReactElement {
  return (
    <a
      href={entry.href}
      target={entry.target}
      rel={entry.rel}
      aria-label={entry.ariaLabel}
      {...(entry.source === 'link' ? siteLinkGaAttributes(entry, 'footer') : {})}
    >
      {entry.label}
    </a>
  );
}

function FooterBrand({ locale, links, avatar, siteId, siteUrl }: {
  locale: string;
  links: readonly SiteLink[];
  avatar?: FooterAvatar;
  siteId?: string;
  siteUrl?: string;
}): ReactElement {
  const brand = resolveFooterBrand(locale);
  const { primary, secondary } = pickFooterBrandLinks(links);
  const origin = (() => {
    try {
      return siteUrl ? new URL(siteUrl).origin : undefined;
    } catch {
      return undefined;
    }
  })();
  // Re-tagged from the untagged destination, so the brand block's content reads `footer_brand`.
  const brandHref = (link: SiteLink) => withCampaignUtm(link.untaggedHref ?? link.href, {
    siteId,
    medium: 'footer',
    campaign: link.id,
    content: 'footer_brand',
    origin,
  });
  return (
    <section className="hagilight-brand" lang={brand.locale} aria-labelledby="hagilight-brand-title">
      <div className="hagilight-brand__lead">
        <div className="hagilight-brand__title">
          {avatar && (
            <picture className="hagilight-brand__avatar" data-random-fan={avatar.randomPool && randomPoolAttribute(avatar.randomPool)}>
              <source type="image/avif" srcSet={avatar.avif} />
              <source type="image/webp" srcSet={avatar.webp} />
              <img src={avatar.webp} {...footerAvatarImageAttributes()} />
            </picture>
          )}
          <h2 className="hagilight-brand__headline" id="hagilight-brand-title">{brand.headline}</h2>
        </div>
        <div className="hagilight-brand__body">
          <p className="hagilight-brand__summary">{brand.summary}</p>
          {(primary || secondary) && (
            <div className="hagilight-brand__actions">
              {primary && (
                <a
                  className="hagilight-brand__primary"
                  href={brandHref(primary)}
                  target={primary.target}
                  rel={primary.rel}
                  aria-label={primary.ariaLabel}
                  {...siteLinkGaAttributes(primary, 'footer_brand')}
                >
                  <span>{primary.label}</span>
                  <svg className="hagilight-brand__arrow" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                    <path d="M2.5 8h10M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
              {secondary && (
                <a
                  className="hagilight-brand__secondary"
                  href={brandHref(secondary)}
                  target={secondary.target}
                  rel={secondary.rel}
                  aria-label={secondary.ariaLabel}
                  {...siteLinkGaAttributes(secondary, 'footer_brand')}
                >
                  {secondary.label}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      <dl className="hagilight-brand__pillars">
        {brand.pillars.map((pillar, index) => (
          <div
            key={pillar.id}
            className="hagilight-brand__pillar"
            data-pillar={pillar.id}
            style={{ '--hagilight-brand-i': index } as CSSProperties}
          >
            <dt>{pillar.label}</dt>
            <dd>{pillar.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FooterView({ links, version, year, buildInfo, avatar, siteId, siteUrl, consentLabel }: FooterViewProps): ReactElement {
  const { labels } = links;
  const buildItems = buildInfoItems(buildInfo);
  return (
    <footer className="hagilight-footer">
      <FooterBrand locale={links.locale} links={links.quick} avatar={avatar} siteId={siteId} siteUrl={siteUrl} />
      <div className="hagilight-footer__sections">
        <div className="hagilight-cols">
          {links.columns.map((column, index) => (
            <nav
              key={column.id}
              className="hagilight-col"
              data-column={column.id}
              style={{ '--hagilight-col-i': index } as CSSProperties}
              aria-labelledby={`hagilight-col-${column.id}`}
            >
              <h2 id={`hagilight-col-${column.id}`}>{labels.columns[column.id]}</h2>
              <ul>
                {column.entries.map((entry) => (
                  <li key={entry.id}>
                    <ColumnLink entry={entry} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="hagilight-footer__base">
        {links.feeds.length > 0 && (
          <nav className="hagilight-footer__feeds" aria-label={labels.navigation.feeds}>
            {links.feeds.map((entry) => (
              <ColumnLink key={entry.id} entry={entry} />
            ))}
          </nav>
        )}
        {(links.filings.length > 0 || consentLabel) && (
          <nav className="hagilight-footer__filings" aria-label={labels.navigation.filings}>
            {links.filings.map((link) => (
              <a key={link.id} href={link.href} target={link.target} rel={link.rel} aria-label={link.ariaLabel}>
                {link.label}
              </a>
            ))}
            {consentLabel && (
              <button type="button" className="hagilight-footer__consent" data-consent-preferences>
                {consentLabel}
              </button>
            )}
          </nav>
        )}
      </div>
      <p className="hagilight-footer__copyright">
        <span>© {year} HagiCode</span>
        {' | '}
        <span className="hagilight-footer__attribution">Powered By hagilight-docusaurus@{version}</span>
        {buildItems.map((item) => (
          <Fragment key={item.field}>
            {' | '}
            <span
              className="hagilight-footer__build"
              data-build-field={item.field}
              title={item.title}
              data-build-commit={item.title}
            >
              {item.label}: {item.datetime ? <time dateTime={item.datetime}>{item.text}</time> : item.text}
            </span>
          </Fragment>
        ))}
      </p>
    </footer>
  );
}
