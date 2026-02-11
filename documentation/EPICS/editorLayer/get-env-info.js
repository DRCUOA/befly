/**
 * Run in Chrome DevTools Console to capture environment info for undo/redo test results.
 * Copy from: documentation/EPICS/editorLayer/get-env-info.js
 */
(function() {
  const n = navigator;
  const s = window.screen;
  const env = {
    userAgent: n.userAgent,
    platform: n.platform,
    language: n.language,
    languages: [...n.languages],
    cookieEnabled: n.cookieEnabled,
    hardwareConcurrency: n.hardwareConcurrency || 'unknown',
    deviceMemory: n.deviceMemory || 'unknown',
    maxTouchPoints: n.maxTouchPoints,
    onLine: n.onLine,
    webdriver: n.webdriver,
    vendor: n.vendor,
    screen: {
      width: s.width,
      height: s.height,
      availWidth: s.availWidth,
      availHeight: s.availHeight,
      colorDepth: s.colorDepth,
      devicePixelRatio: window.devicePixelRatio || 1
    }
  };

  const json = JSON.stringify(env, null, 2);
  const summary = `Browser: ${n.vendor} ${n.userAgent.match(/\b(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[0] || 'unknown'}
Platform: ${n.platform}
Language: ${n.language}
Screen: ${s.width}x${s.height}
CPU cores: ${env.hardwareConcurrency}`;

  console.log('=== Environment for Undo/Redo Tests ===\n');
  console.log(summary);
  console.log('\n--- JSON (copy for results) ---\n');
  console.log(json);

  // Copy to clipboard if available
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(
      () => console.log('\n✓ JSON copied to clipboard'),
      () => console.log('\n(Copy manually from above)')
    );
  }

  return env;
})();
