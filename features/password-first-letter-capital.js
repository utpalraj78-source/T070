/**
 * ============================================================================
 * FEATURE: Password First Letter Capital Requirement
 * Filename: password-first-letter-capital.js
 * ============================================================================
 * Enforces that the first character of any password must be an uppercase
 * capital letter (A-Z).
 *
 * Provides real-time feedback indicator, visual validation styling, and
 * intercepts form submission if the password does not start with a capital letter.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-first-letter-capital';
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function setupFirstLetterCapitalValidation() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS(
        'password-first-letter-capital-styles',
        `
        .pwd-capital-feedback {
          display: block;
          font-size: 0.75rem;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .pwd-capital-hint {
          color: #0284c7;
        }
        .pwd-capital-error {
          color: #ef4444;
        }
        .pwd-capital-success {
          color: #10b981;
        }
        input.invalid-pwd-capital {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        [data-theme="dark"] input.invalid-pwd-capital {
          background-color: #451a1a !important;
          border-color: #f87171 !important;
        }
        `
      );
    }

    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.firstCapitalAttached === 'true') return;
      input.dataset.firstCapitalAttached = 'true';

      const container = input.closest('.pwd-toggle-container') || input.parentNode;
      let msg = container.parentNode.querySelector('.pwd-capital-feedback');
      if (!msg) {
        msg = document.createElement('small');
        msg.className = 'pwd-capital-feedback pwd-capital-hint';
        msg.textContent = 'Rule: First letter must be Capital (A-Z)';
        container.insertAdjacentElement('afterend', msg);
      }

      function validateCapital() {
        const val = input.value;
        if (!val) {
          msg.textContent = 'Rule: First letter must be Capital (A-Z)';
          msg.className = 'pwd-capital-feedback pwd-capital-hint';
          input.classList.remove('invalid-pwd-capital');
          return true;
        }

        const firstChar = val.charAt(0);
        const isCapital = /^[A-Z]$/.test(firstChar);

        if (isCapital) {
          msg.textContent = '✓ First letter is capital (A-Z)';
          msg.className = 'pwd-capital-feedback pwd-capital-success';
          input.classList.remove('invalid-pwd-capital');
          return true;
        } else {
          msg.textContent = '✕ First letter must be a capital letter (A-Z)';
          msg.className = 'pwd-capital-feedback pwd-capital-error';
          input.classList.add('invalid-pwd-capital');
          return false;
        }
      }

      input.addEventListener('input', validateCapital);
      input.addEventListener('blur', validateCapital);

      // Intercept form submit if first letter is not capital
      const form = input.closest('form');
      if (form && !form.dataset.capitalSubmitIntercepted) {
        form.dataset.capitalSubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            const val = input.value;
            if (val && !/^[A-Z]/.test(val)) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert('Password validation failed: The first letter of the password must be a capital letter (A-Z).');
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: setupFirstLetterCapitalValidation,
      onDOMChange: setupFirstLetterCapitalValidation
    });
  } else {
    document.addEventListener('DOMContentLoaded', setupFirstLetterCapitalValidation);
  }
})();
