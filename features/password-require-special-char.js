/**
 * ============================================================================
 * FEATURE: Password Must Contain at least 1 Special Character
 * Filename: password-require-special-char.js
 * ============================================================================
 * Enforces that passwords must contain at least one special character
 * (!@#$%^&*()_+-=[]{};':"|,.<>/?`~).
 * Provides live feedback, validation badges, and blocks submissions
 * if no special character is present.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-require-special-char';
  const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function setupSpecialCharValidation() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS(
        'password-require-special-char-styles',
        `
        .pwd-special-feedback {
          display: block;
          font-size: 0.75rem;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .pwd-special-hint { color: #0284c7; }
        .pwd-special-error { color: #ef4444; }
        .pwd-special-success { color: #10b981; }
        input.invalid-pwd-special {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        [data-theme="dark"] input.invalid-pwd-special {
          background-color: #451a1a !important;
          border-color: #f87171 !important;
        }
        `
      );
    }

    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.requireSpecialAttached === 'true') return;
      input.dataset.requireSpecialAttached = 'true';

      const container = input.closest('.pwd-toggle-container') || input.parentNode;
      let msg = container.parentNode.querySelector('.pwd-special-feedback');
      if (!msg) {
        msg = document.createElement('small');
        msg.className = 'pwd-special-feedback pwd-special-hint';
        msg.textContent = 'Rule: Must contain at least 1 special character (!@#$%^&*...)';
        container.insertAdjacentElement('afterend', msg);
      }

      function validateSpecial() {
        const val = input.value;
        if (!val) {
          msg.textContent = 'Rule: Must contain at least 1 special character (!@#$%^&*...)';
          msg.className = 'pwd-special-feedback pwd-special-hint';
          input.classList.remove('invalid-pwd-special');
          return true;
        }

        const hasSpecial = SPECIAL_CHAR_REGEX.test(val);
        if (hasSpecial) {
          msg.textContent = '✓ Contains at least 1 special character';
          msg.className = 'pwd-special-feedback pwd-special-success';
          input.classList.remove('invalid-pwd-special');
          return true;
        } else {
          msg.textContent = '✕ Must contain at least 1 special character (!@#$%^&*...)';
          msg.className = 'pwd-special-feedback pwd-special-error';
          input.classList.add('invalid-pwd-special');
          return false;
        }
      }

      input.addEventListener('input', validateSpecial);
      input.addEventListener('blur', validateSpecial);

      const form = input.closest('form');
      if (form && !form.dataset.specialSubmitIntercepted) {
        form.dataset.specialSubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            const val = input.value;
            if (val && !SPECIAL_CHAR_REGEX.test(val)) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert('Password validation failed: Password must contain at least 1 special character (!@#$%^&*...).');
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: setupSpecialCharValidation,
      onDOMChange: setupSpecialCharValidation
    });
  } else {
    document.addEventListener('DOMContentLoaded', setupSpecialCharValidation);
  }
})();
