# Versions and peer ranges

Pin every `@hagicode/hagilight*` package to the same exact version. Feature packages depend on the matching `@hagicode/hagilight-core` version, so install the feature package and core at one exact version, for example `0.1.0`, and never a range such as `^0.1.0`.

## Peer ranges

These are the peer ranges each package declares. Install a peer that satisfies its range; the table is checked against the package manifests by `test/website-skills.test.mjs`.

| Package | Peer | Range |
| --- | --- | --- |
| `@hagicode/hagilight` | `astro` | `>=7` |
| `@hagicode/hagilight-core` | `astro` | `>=7` |
| `@hagicode/hagilight-starlight` | `astro` | `^7.3.5` |
| `@hagicode/hagilight-starlight` | `@astrojs/starlight` | `^0.42.4` |
| `@hagicode/hagilight-docusaurus` | `@docusaurus/core` | `^3.9.2` |
| `@hagicode/hagilight-docusaurus` | `@docusaurus/theme-classic` | `^3.9.2` |
