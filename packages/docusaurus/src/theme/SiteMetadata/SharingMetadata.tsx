import type { Props as HeadProps } from '@docusaurus/Head';
import type { ReactElement, ReactNode } from 'react';

export interface SharingMetadataProps {
  Head: (props: HeadProps) => ReactNode;
  siteName: string;
  image: string | undefined;
}

export function SharingMetadata({ Head, siteName, image }: SharingMetadataProps): ReactElement {
  return (
    <Head>
      <meta property="og:site_name" content={siteName} />
      {image !== undefined && <meta property="og:image" content={image} />}
      {image !== undefined && <meta name="twitter:image" content={image} />}
    </Head>
  );
}
