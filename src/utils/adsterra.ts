/**
 * Adsterra Advertising Integration Controller for kycapproved.online
 *
 * Current Status:
 * - Native Banner: ENABLED
 * - Popunder: DISABLED BY DEFAULT (call enableAdsterraPopunder() when ready)
 * - Social Bar: DISABLED BY DEFAULT (call enableAdsterraSocialBar() when ready)
 */

export const AdsterraConfig = {
  nativeBanner: {
    scriptUrl: 'https://bauval.org/21/0a08f64ff2d23f4d7c70a4a60eecbe08',
    containerId: 'container-0a08f64ff2d23f4d7c70a4a60eecbe08',
    enabled: true,
  },
  popunder: {
    scriptUrl: 'https://abscloud.org/1/6332326cc7cce78ac5bc49c81124887a',
    enabled: true,
  },
  socialBar: {
    scriptUrl: 'https://bauval.org/14/6018abf9b1ce1da2dbd6ed0f586c2e07',
    enabled: true,
  },
};

/**
 * Loads the Adsterra Native Banner script safely without duplicate insertion.
 */
export function loadAdsterraNativeBanner(): void {
  if (typeof document === 'undefined') return;
  const url = AdsterraConfig.nativeBanner.scriptUrl;
  if (document.querySelector(`script[src="${url}"]`)) return;

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.setAttribute('data-cfasync', 'false');
  script.src = url;
  document.body.appendChild(script);
}

/**
 * Enables the Adsterra Popunder tag.
 * Kept disabled initially by default. Call explicitly to activate.
 */
export function enableAdsterraPopunder(): void {
  if (typeof document === 'undefined') return;
  const url = AdsterraConfig.popunder.scriptUrl;
  if (document.querySelector(`script[src="${url}"]`)) {
    AdsterraConfig.popunder.enabled = true;
    return;
  }

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('data-cfasync', 'false');
  script.src = url;
  document.body.appendChild(script);
  AdsterraConfig.popunder.enabled = true;
  console.info('[Adsterra] Popunder script initialized.');
}

/**
 * Enables the Adsterra Social Bar tag.
 * Kept disabled initially by default. Call explicitly to activate.
 */
export function enableAdsterraSocialBar(): void {
  if (typeof document === 'undefined') return;
  const url = AdsterraConfig.socialBar.scriptUrl;
  if (document.querySelector(`script[src="${url}"]`)) {
    AdsterraConfig.socialBar.enabled = true;
    return;
  }

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('data-cfasync', 'false');
  script.src = url;
  document.body.appendChild(script);
  AdsterraConfig.socialBar.enabled = true;
  console.info('[Adsterra] Social Bar script initialized.');
}
