/**
 * ============================================================================
 * FEATURE: Email Field Placeholder (@lnmiit.ac.in)
 * Filename: email-placeholder-lnmiit.js
 * ============================================================================
 * Replaces the email field placeholder (such as 'e.g. 24ucs144@lnmiit.ac.in')
 * with '@lnmiit.ac.in' across email inputs in the application.
 *
 * Implemented as a separate, modular feature file outside the main codebase.
 * Connected via feature-router.js.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'email-placeholder-lnmiit';
  const TARGET_PLACEHOLDER = '@lnmiit.ac.in';

  // Selectors targeting email input fields (login, user creation, reset password, etc.)
  const SELECTORS = [
    '#email',
    'input[type="email"]',
    'input[name="email"]',
    '#resetEmail'
  ];

  function applyEmailPlaceholder() {
    SELECTORS.forEach((selector) => {
      const inputs = document.querySelectorAll(selector);
      inputs.forEach((input) => {
        if (input.placeholder !== TARGET_PLACEHOLDER) {
          input.placeholder = TARGET_PLACEHOLDER;
        }
      });
    });
  }

  // Register with Feature Router
  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: applyEmailPlaceholder,
      onDOMChange: applyEmailPlaceholder
    });
  } else {
    document.addEventListener('DOMContentLoaded', applyEmailPlaceholder);
  }
})();
