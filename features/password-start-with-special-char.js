/**
 * ============================================================================
 * FEATURE: Password Must Start with a Special Character
 * Filename: password-start-with-special-char.js
 * ============================================================================
 * Enforces that the first character of the password must be a special character
 * (!@#$%^&*()_+-=[]{};':"|,.<>/?`~).
 * Provides live feedback, badges, and intercepts form submission.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-start-with-special-char';
  const SPECIAL_CHAR_START_REGEX = /^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function setupStartWithSpecialValidation() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS(
        'password-start-with-special-styles',
        `
        .pwd-startspec-feedback {
          display: block;
          font-size: 0.75rem;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .pwd-startspec-hint { color: #0284c7; }
        .pwd-startspec-error { color: #ef4444; }
        .pwd-startspec-success { color: #10b981; }
        input.invalid-pwd-startspec {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        [data-theme="dark"] input.invalid-pwd-startspec {
          background-color: #451a1a !important;
          border-color: #f87171 !important;
        }
        `
      );
    }

    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.startSpecialAttached === 'true') return;
      input.dataset.startSpecialAttached = 'true';

      const container = input.closest('.pwd-toggle-container') || input.parentNode;
      let msg = container.parentNode.querySelector('.pwd-startspec-feedback');
      if (!msg) {
        msg = document.createElement('small');
        msg.className = 'pwd-startspec-feedback pwd-startspec-hint';
        msg.textContent = 'Rule: First character must be a special character (!@#$%^&*...)';
        container.insertAdjacentElement('afterend', msg);
      }

      function validateStartSpecial() {
        const val = input.value;
        if (!val) {
          msg.textContent = 'Rule: First character must be a special character (!@#$%^&*...)';
          msg.className = 'pwd-startspec-feedback pwd-startspec-hint';
          input.classList.remove('invalid-pwd-startspec');
          return true;
        }

        const startsWithSpecial = SPECIAL_CHAR_START_REGEX.test(val);
        if (startsWithSpecial) {
          msg.textContent = '✓ Starts with a special character';
          msg.className = 'pwd-startspec-feedback pwd-startspec-success';
          input.classList.remove('invalid-pwd-startspec');
          return true;
        } else {
          msg.textContent = '✕ First character must be a special character (!@#$%^&*...)';
          msg.className = 'pwd-startspec-feedback pwd-startspec-error';
          input.classList.add('invalid-pwd-startspec');
          return false;
        }
      }

      input.addEventListener('input', validateStartSpecial);
      input.addEventListener('blur', validateStartSpecial);

      const form = input.closest('form');
      if (form && !form.dataset.startSpecSubmitIntercepted) {
        form.dataset.startSpecSubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            const val = input.value;
            if (val && !SPECIAL_CHAR_START_REGEX.test(val)) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert('Password validation failed: The first character of the password must be a special character (!@#$%^&*...).');
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: setupStartWithSpecialValidation,
      onDOMChange: setupStartWithSpecialValidation
    });
  } else {
    document.addEventListener('DOMContentLoaded', setupStartWithSpecialValidation);
  }
})();
