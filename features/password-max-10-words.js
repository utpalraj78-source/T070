/**
 * ============================================================================
 * FEATURE: Maximum 10 Words Limit for Password Fields
 * Filename: password-max-10-words.js
 * ============================================================================
 * Enforces that passwords cannot exceed 10 words (space-separated tokens).
 * Displays a live word count indicator, visual validation styling,
 * and intercepts form submission if more than 10 words are entered.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'password-max-10-words';
  const MAX_WORDS = 10;
  const SELECTOR = 'input[type="password"], input[name="password"], input[name="newPassword"], input[name="confirmPassword"]';

  function countWords(str) {
    if (!str) return 0;
    const tokens = str.trim().split(/\s+/).filter(Boolean);
    return tokens.length;
  }

  function setupMax10WordsValidation() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS(
        'password-max-10-words-styles',
        `
        .pwd-max10words-feedback {
          display: block;
          font-size: 0.75rem;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .pwd-max10words-hint { color: #0284c7; }
        .pwd-max10words-error { color: #ef4444; }
        .pwd-max10words-success { color: #10b981; }
        input.invalid-pwd-max10words {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        [data-theme="dark"] input.invalid-pwd-max10words {
          background-color: #451a1a !important;
          border-color: #f87171 !important;
        }
        `
      );
    }

    const inputs = document.querySelectorAll(SELECTOR);
    inputs.forEach((input) => {
      if (input.dataset.max10WordsAttached === 'true') return;
      input.dataset.max10WordsAttached = 'true';

      const container = input.closest('.pwd-toggle-container') || input.parentNode;
      let msg = container.parentNode.querySelector('.pwd-max10words-feedback');
      if (!msg) {
        msg = document.createElement('small');
        msg.className = 'pwd-max10words-feedback pwd-max10words-hint';
        msg.textContent = `Rule: Maximum ${MAX_WORDS} words allowed`;
        container.insertAdjacentElement('afterend', msg);
      }

      function validateMax10Words() {
        const val = input.value;
        const words = countWords(val);

        if (!val) {
          msg.textContent = `Rule: Maximum ${MAX_WORDS} words allowed`;
          msg.className = 'pwd-max10words-feedback pwd-max10words-hint';
          input.classList.remove('invalid-pwd-max10words');
          return true;
        }

        if (words <= MAX_WORDS) {
          msg.textContent = `✓ Word limit valid (${words} / ${MAX_WORDS} words)`;
          msg.className = 'pwd-max10words-feedback pwd-max10words-success';
          input.classList.remove('invalid-pwd-max10words');
          return true;
        } else {
          msg.textContent = `✗ Exceeds word limit (${words} words, max ${MAX_WORDS})`;
          msg.className = 'pwd-max10words-feedback pwd-max10words-error';
          input.classList.add('invalid-pwd-max10words');
          return false;
        }
      }

      input.addEventListener('input', validateMax10Words);
      validateMax10Words();

      const form = input.closest('form');
      if (form && !form.dataset.max10WordsSubmitIntercepted) {
        form.dataset.max10WordsSubmitIntercepted = 'true';
        form.addEventListener(
          'submit',
          (e) => {
            const words = countWords(input.value);
            if (words > MAX_WORDS) {
              e.preventDefault();
              e.stopImmediatePropagation();
              input.focus();
              alert(`Password word limit error: Password must have at most ${MAX_WORDS} words (currently ${words} words).`);
            }
          },
          true
        );
      }
    });
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: setupMax10WordsValidation,
      onDOMChange: setupMax10WordsValidation
    });
  } else {
    document.addEventListener('DOMContentLoaded', setupMax10WordsValidation);
  }
})();
