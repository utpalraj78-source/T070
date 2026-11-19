/**
 * ============================================================================
 * FEATURE: Password Must Start with a Number (0-9)
 * Filename: password-start-with-number.js
 * ============================================================================
 * Enforces that the very first character of the password must be a
 * numeric digit (0-9).
 * Provides live feedback, badges, and intercepts form submission.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-start-with-number';
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function setupStartWithNumberValidation() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS(
        'password-start-with-number-styles',
        `
        .pwd-startnum-feedback {
          display: block;
          font-size: 0.75rem;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .pwd-startnum-hint { color: #0284c7; }
        .pwd-startnum-error { color: #ef4444; }
        .pwd-startnum-success { color: #10b981; }
        input.invalid-pwd-startnum {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        [data-theme="dark"] input.invalid-pwd-startnum {
          background-color: #451a1a !important;
          border-color: #f87171 !important;
        }
        `
      );
    }

    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.startNumberAttached === 'true') return;
      input.dataset.startNumberAttached = 'true';

      const container = input.closest('.pwd-toggle-container') || input.parentNode;
      let msg = container.parentNode.querySelector('.pwd-startnum-feedback');
      if (!msg) {
        msg = document.createElement('small');
        msg.className = 'pwd-startnum-feedback pwd-startnum-hint';
        msg.textContent = 'Rule: First character must be a number (0-9)';
        container.insertAdjacentElement('afterend', msg);
      }

      function validateStartNumber() {
        const val = input.value;
        if (!val) {
          msg.textContent = 'Rule: First character must be a number (0-9)';
          msg.className = 'pwd-startnum-feedback pwd-startnum-hint';
          input.classList.remove('invalid-pwd-startnum');
          return true;
        }

        const startsWithNum = /^[0-9]/.test(val);
        if (startsWithNum) {
          msg.textContent = '✓ Starts with a number (0-9)';
          msg.className = 'pwd-startnum-feedback pwd-startnum-success';
          input.classList.remove('invalid-pwd-startnum');
          return true;
        } else {
          msg.textContent = '✕ First character must be a number (0-9)';
          msg.className = 'pwd-startnum-feedback pwd-startnum-error';
          input.classList.add('invalid-pwd-startnum');
          return false;
        }
      }

      input.addEventListener('input', validateStartNumber);
      input.addEventListener('blur', validateStartNumber);

      const form = input.closest('form');
      if (form && !form.dataset.startNumSubmitIntercepted) {
        form.dataset.startNumSubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            const val = input.value;
            if (val && !/^[0-9]/.test(val)) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert('Password validation failed: The first character of the password must be a number (0-9).');
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: setupStartWithNumberValidation,
      onDOMChange: setupStartWithNumberValidation
    });
  } else {
    document.addEventListener('DOMContentLoaded', setupStartWithNumberValidation);
  }
})();
