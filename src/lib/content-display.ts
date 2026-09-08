export {
  formatRelativeTime,
  newsSourceMeta,
  newsSourceLogoPath,
  ossAudienceTags,
  ossHeatLabel,
  rankingPickReason,
} from '../../lib/content-display.js';

export type NewsSourceMeta = {
  label: string;
  key: string;
  mark: string;
  domain?: string;
  logo?: string;
};
