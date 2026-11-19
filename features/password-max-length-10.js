/**
 * ============================================================================
 * FEATURE: Maximum 10 Characters Limit for Password Fields
 * Filename: password-max-length-10.js (alias for password-max-10-characters.js)
 * ============================================================================
 * Enforces that passwords cannot exceed 10 characters in length.
 * Displays a live remaining character counter, enforces HTML maxlength=10,
 * and intercepts submissions if the character limit is exceeded.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-max-length-10';
  const MAX_CHARS = 10;
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function applyMax10Chars() {
    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.max10CharsAttached === 'true') return;
      input.dataset.max10CharsAttached = 'true';

      // Enforce strict HTML maxlength attribute of 10
      input.setAttribute('maxlength', MAX_CHARS);

      const container = input.closest('.pwd-toggle-container') || input.parentNode;

      // Clean up previous 64-char counter badge if present to prevent duplicate badges
      const oldCounter = container.parentNode.querySelector('.char-limit-user-password');
      if (oldCounter) {
        oldCounter.remove();
      }

      let counter = container.parentNode.querySelector('.char-limit-pwd-max10chars');
      if (!counter) {
        counter = document.createElement('small');
        counter.className = 'char-limit-pwd-max10chars char-counter-badge';
        counter.style.cssText = 'display:block; text-align:right; font-size:0.78rem; font-weight:500; color:#64748b; margin-top:4px;';
        container.insertAdjacentElement('afterend', counter);
      }

      function updateCounter() {
        if (input.value.length > MAX_CHARS) {
          input.value = input.value.slice(0, MAX_CHARS);
        }

        const currentLength = input.value.length;
        const remaining = Math.max(0, MAX_CHARS - currentLength);

        counter.textContent = `${remaining} / ${MAX_CHARS} characters remaining (max 10 chars)`;

        if (remaining === 0) {
          counter.style.color = '#ef4444';
        } else if (remaining <= 2) {
          counter.style.color = '#f59e0b';
        } else {
          counter.style.color = '#64748b';
        }
      }

      input.addEventListener('input', updateCounter);
      updateCounter();

      // Intercept form submission if longer than 10 characters
      const form = input.closest('form');
      if (form && !form.dataset.max10CharsSubmitIntercepted) {
        form.dataset.max10CharsSubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            if (input.value.length > MAX_CHARS) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert(`Password character limit error: Password must be at most ${MAX_CHARS} characters.`);
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: applyMax10Chars,
      onDOMChange: applyMax10Chars
    });
  } else {
    document.addEventListener('DOMContentLoaded', applyMax10Chars);
  }
})();
