import { Fragment, type CSSProperties, type ReactElement } from 'react';
import { siteLinkGaAttributes } from '@hagicode/hagilight-core/analytics-events';
import { buildInfoItems, type BuildInfo } from '@hagicode/hagilight-core/build-info';
import { pickFooterBrandLinks, resolveFooterBrand } from '@hagicode/hagilight-core/footer-brand';
import { footerAvatarImageAttributes } from '@hagicode/hagilight-core/footer-avatar';
import { randomPoolAttribute } from '@hagicode/hagilight-core/random-image';
import type { SiteLink } from '@hagicode/hagilight-core/links';
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
}

interface LinkSectionProps {
  heading: string;
  navLabel: string;
  links: readonly SiteLink[];
  tagged: boolean;
}

function LinkSection({ heading, navLabel, links, tagged }: LinkSectionProps): ReactElement {
  return (
    <section>
      <h2>{heading}</h2>
      <nav aria-label={navLabel}>
        <ul>
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                target={link.target}
                rel={link.rel}
                aria-label={link.ariaLabel}
                {...(tagged ? siteLinkGaAttributes(link, 'footer') : {})}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

function FooterBrand({ locale, links, avatar }: { locale: string; links: readonly SiteLink[]; avatar?: FooterAvatar }): ReactElement {
  const brand = resolveFooterBrand(locale);
  const { primary, secondary } = pickFooterBrandLinks(links);
  return (
    <section className="hagilight-brand" lang={brand.locale} aria-labelledby="hagilight-brand-title">
      <div className="hagilight-brand__lead">
        <div className="hagilight-brand__title">
          {avatar && (
            <picture className="hagilight-brand__avatar" data-random-pool={avatar.randomPool && randomPoolAttribute(avatar.randomPool)}>
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
                  href={primary.href}
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
                  href={secondary.href}
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

export function FooterView({ links, version, year, buildInfo, avatar }: FooterViewProps): ReactElement {
  const { labels } = links;
  const buildItems = buildInfoItems(buildInfo);
  return (
    <footer className="hagilight-footer">
      <FooterBrand locale={links.locale} links={links.quick} avatar={avatar} />
      <div className="hagilight-footer__sections">
        {links.relatedSites.length > 0 && (
          <section>
            <h2>{labels.relatedSites}</h2>
            <nav aria-label={labels.navigation.relatedSites}>
              <ul>
                {links.relatedSites.map((site) => (
                  <li key={site.id}>
                    <a href={site.href} target={site.target} rel={site.rel}>{site.name}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </section>
        )}
        <LinkSection
          heading={labels.quickLinks}
          navLabel={labels.navigation.quickLinks}
          links={links.quick}
          tagged
        />
        <LinkSection
          heading={labels.community}
          navLabel={labels.navigation.community}
          links={links.community}
          tagged
        />
      </div>
      {links.filings.length > 0 && (
        <nav className="hagilight-footer__filings" aria-label={labels.navigation.filings}>
          {links.filings.map((link) => (
            <a key={link.id} href={link.href} target={link.target} rel={link.rel} aria-label={link.ariaLabel}>
              {link.label}
            </a>
          ))}
        </nav>
      )}
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
