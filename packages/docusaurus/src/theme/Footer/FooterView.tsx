import type { ReactElement } from 'react';
import { siteLinkGaAttributes } from '@hagicode/hagilight-core/analytics-events';
import type { SiteLink } from '@hagicode/hagilight-core/links';
import type { FooterLinks } from '../../footer.js';

export interface FooterViewProps {
  links: FooterLinks;
  version: string;
  year: number;
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

export function FooterView({ links, version, year }: FooterViewProps): ReactElement {
  const { labels } = links;
  return (
    <footer className="hagilight-footer">
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
      </p>
    </footer>
  );
}
