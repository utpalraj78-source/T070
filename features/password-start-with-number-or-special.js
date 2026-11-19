/**
 * ============================================================================
 * FEATURE: Password Must Start with a Number (0-9) OR Special Character
 * Filename: password-start-with-number-or-special.js
 * ============================================================================
 * Enforces that the first character of the password must be either a numeric
 * digit (0-9) or a special character (!@#$%^&*()_+-=[]{};':"|,.<>/?`~).
 * Provides live feedback, badges, and intercepts form submission.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-start-with-number-or-special';
  const NUM_OR_SPECIAL_REGEX = /^[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function setupStartWithNumOrSpecialValidation() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS(
        'password-start-with-number-or-special-styles',
        `
        .pwd-startnumspec-feedback {
          display: block;
          font-size: 0.75rem;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .pwd-startnumspec-hint { color: #0284c7; }
        .pwd-startnumspec-error { color: #ef4444; }
        .pwd-startnumspec-success { color: #10b981; }
        input.invalid-pwd-startnumspec {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        [data-theme="dark"] input.invalid-pwd-startnumspec {
          background-color: #451a1a !important;
          border-color: #f87171 !important;
        }
        `
      );
    }

    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.startNumOrSpecialAttached === 'true') return;
      input.dataset.startNumOrSpecialAttached = 'true';

      const container = input.closest('.pwd-toggle-container') || input.parentNode;
      let msg = container.parentNode.querySelector('.pwd-startnumspec-feedback');
      if (!msg) {
        msg = document.createElement('small');
        msg.className = 'pwd-startnumspec-feedback pwd-startnumspec-hint';
        msg.textContent = 'Rule: First character must be a number (0-9) or special character';
        container.insertAdjacentElement('afterend', msg);
      }

      function validateStartNumOrSpecial() {
        const val = input.value;
        if (!val) {
          msg.textContent = 'Rule: First character must be a number (0-9) or special character';
          msg.className = 'pwd-startnumspec-feedback pwd-startnumspec-hint';
          input.classList.remove('invalid-pwd-startnumspec');
          return true;
        }

        const valid = NUM_OR_SPECIAL_REGEX.test(val);
        if (valid) {
          msg.textContent = '✓ Starts with a number or special character';
          msg.className = 'pwd-startnumspec-feedback pwd-startnumspec-success';
          input.classList.remove('invalid-pwd-startnumspec');
          return true;
        } else {
          msg.textContent = '✕ First character must be a number (0-9) or special character';
          msg.className = 'pwd-startnumspec-feedback pwd-startnumspec-error';
          input.classList.add('invalid-pwd-startnumspec');
          return false;
        }
      }

      input.addEventListener('input', validateStartNumOrSpecial);
      input.addEventListener('blur', validateStartNumOrSpecial);

      const form = input.closest('form');
      if (form && !form.dataset.startNumSpecSubmitIntercepted) {
        form.dataset.startNumSpecSubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            const val = input.value;
            if (val && !NUM_OR_SPECIAL_REGEX.test(val)) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert('Password validation failed: The first character of the password must be a number (0-9) or special character.');
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: setupStartWithNumOrSpecialValidation,
      onDOMChange: setupStartWithNumOrSpecialValidation
    });
  } else {
    document.addEventListener('DOMContentLoaded', setupStartWithNumOrSpecialValidation);
  }
})();
