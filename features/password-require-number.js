/**
 * ============================================================================
 * FEATURE: Password Must Contain at least 1 Number
 * Filename: password-require-number.js
 * ============================================================================
 * Enforces that passwords must include at least one numeric digit (0-9).
 * Provides live feedback, validation badges, and blocks submissions
 * if no numeric digit is found.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-require-number';
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function setupNumberValidation() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS(
        'password-require-number-styles',
        `
        .pwd-number-feedback {
          display: block;
          font-size: 0.75rem;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .pwd-number-hint { color: #0284c7; }
        .pwd-number-error { color: #ef4444; }
        .pwd-number-success { color: #10b981; }
        input.invalid-pwd-number {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        [data-theme="dark"] input.invalid-pwd-number {
          background-color: #451a1a !important;
          border-color: #f87171 !important;
        }
        `
      );
    }

    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.requireNumberAttached === 'true') return;
      input.dataset.requireNumberAttached = 'true';

      const container = input.closest('.pwd-toggle-container') || input.parentNode;
      let msg = container.parentNode.querySelector('.pwd-number-feedback');
      if (!msg) {
        msg = document.createElement('small');
        msg.className = 'pwd-number-feedback pwd-number-hint';
        msg.textContent = 'Rule: Must contain at least 1 number (0-9)';
        container.insertAdjacentElement('afterend', msg);
      }

      function validateNumber() {
        const val = input.value;
        if (!val) {
          msg.textContent = 'Rule: Must contain at least 1 number (0-9)';
          msg.className = 'pwd-number-feedback pwd-number-hint';
          input.classList.remove('invalid-pwd-number');
          return true;
        }

        const hasNumber = /[0-9]/.test(val);
        if (hasNumber) {
          msg.textContent = '✓ Contains at least 1 number (0-9)';
          msg.className = 'pwd-number-feedback pwd-number-success';
          input.classList.remove('invalid-pwd-number');
          return true;
        } else {
          msg.textContent = '✕ Must contain at least 1 number (0-9)';
          msg.className = 'pwd-number-feedback pwd-number-error';
          input.classList.add('invalid-pwd-number');
          return false;
        }
      }

      input.addEventListener('input', validateNumber);
      input.addEventListener('blur', validateNumber);

      const form = input.closest('form');
      if (form && !form.dataset.numberSubmitIntercepted) {
        form.dataset.numberSubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            const val = input.value;
            if (val && !/[0-9]/.test(val)) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert('Password validation failed: Password must contain at least 1 number (0-9).');
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: setupNumberValidation,
      onDOMChange: setupNumberValidation
    });
  } else {
    document.addEventListener('DOMContentLoaded', setupNumberValidation);
  }
})();
