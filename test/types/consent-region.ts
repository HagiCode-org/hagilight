// Type fixture for @hagicode/hagilight-core/consent-region. Each `@ts-expect-error` line must stay an error.
import {
  classifyTimeZone,
  getRegionDecision,
  isAssignedCountryCode,
  pageRegionSource,
  resolveRegionDecision,
  startRegionResolution,
  type RegionConfig,
  type RegionDecision,
  type RegionSource,
} from '@hagicode/hagilight-core/consent-region';

const decision: RegionDecision = classifyTimeZone('Europe/Berlin');
const pending: RegionDecision | 'pending' = getRegionDecision();
const config: RegionConfig = { regions: 'default', countryCode: 'DE', regionHook: () => 'notRequired' };
const listed: RegionConfig = { regions: ['DE', 'FR'] };
const resolved: Promise<RegionDecision> = resolveRegionDecision(config);
const started: Promise<RegionDecision> = startRegionResolution(listed);
const source: RegionSource = pageRegionSource();
const valid: boolean = isAssignedCountryCode('DE');
void decision; void pending; void resolved; void started; void source; void valid;
// @ts-expect-error a decision is one of the three states.
const invalidDecision: RegionDecision = 'maybe';
// @ts-expect-error regions must be 'default' or a list of strings.
const invalidRegions: RegionConfig = { regions: 'all' };
void invalidDecision; void invalidRegions;
