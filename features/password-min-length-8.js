/**
 * ============================================================================
 * FEATURE: Password Minimum 8 Characters Requirement
 * Filename: password-min-length-8.js
 * ============================================================================
 * Enforces that passwords must have at least 8 characters.
 * Provides real-time feedback, visual status badges, and intercepts
 * form submissions if the password is shorter than 8 characters.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-min-length-8';
  const MIN_LENGTH = 8;
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function setupMin8Validation() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS(
        'password-min-length-8-styles',
        `
        .pwd-min8-feedback {
          display: block;
          font-size: 0.75rem;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .pwd-min8-hint { color: #0284c7; }
        .pwd-min8-error { color: #ef4444; }
        .pwd-min8-success { color: #10b981; }
        input.invalid-pwd-min8 {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        [data-theme="dark"] input.invalid-pwd-min8 {
          background-color: #451a1a !important;
          border-color: #f87171 !important;
        }
        `
      );
    }

    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.min8Attached === 'true') return;
      input.dataset.min8Attached = 'true';

      const container = input.closest('.pwd-toggle-container') || input.parentNode;
      let msg = container.parentNode.querySelector('.pwd-min8-feedback');
      if (!msg) {
        msg = document.createElement('small');
        msg.className = 'pwd-min8-feedback pwd-min8-hint';
        msg.textContent = `Rule: Minimum ${MIN_LENGTH} characters required`;
        container.insertAdjacentElement('afterend', msg);
      }

      function validateMin8() {
        const val = input.value;
        if (!val) {
          msg.textContent = `Rule: Minimum ${MIN_LENGTH} characters required`;
          msg.className = 'pwd-min8-feedback pwd-min8-hint';
          input.classList.remove('invalid-pwd-min8');
          return true;
        }

        if (val.length >= MIN_LENGTH) {
          msg.textContent = `✓ Minimum ${MIN_LENGTH} characters met (${val.length} chars)`;
          msg.className = 'pwd-min8-feedback pwd-min8-success';
          input.classList.remove('invalid-pwd-min8');
          return true;
        } else {
          msg.textContent = `✕ Password must be at least ${MIN_LENGTH} characters (currently ${val.length})`;
          msg.className = 'pwd-min8-feedback pwd-min8-error';
          input.classList.add('invalid-pwd-min8');
          return false;
        }
      }

      input.addEventListener('input', validateMin8);
      input.addEventListener('blur', validateMin8);

      const form = input.closest('form');
      if (form && !form.dataset.min8SubmitIntercepted) {
        form.dataset.min8SubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            const val = input.value;
            if (val && val.length < MIN_LENGTH) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert(`Password validation failed: Password must be at least ${MIN_LENGTH} characters long.`);
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: setupMin8Validation,
      onDOMChange: setupMin8Validation
    });
  } else {
    document.addEventListener('DOMContentLoaded', setupMin8Validation);
  }
})();
