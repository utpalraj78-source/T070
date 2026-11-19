/**
 * ============================================================================
 * FEATURE ROUTER & REGISTRY (feature-router.js)
 * ============================================================================
 * This route file connects modular features to the main HSTS application.
 *
 * HOW IT WORKS FOR DEVELOPERS:
 * 1. Each feature exists as an independent, self-contained file in this folder.
 * 2. To ENABLE a feature, simply add its filename to `ACTIVE_FEATURE_ROUTES`.
 * 3. To DISABLE a feature, simply comment it out or remove it from `ACTIVE_FEATURE_ROUTES`.
 *    The file remains safely in this folder ("just there"); it will not be executed
 *    unless its filename is added to the active routes below.
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // ACTIVE FEATURE ROUTES
  // Add or remove filenames here to toggle features in the main project.
  // --------------------------------------------------------------------------
  const ACTIVE_FEATURE_ROUTES = [
    // 1. Password Visibility Toggle (Show / Hide password icon)
    // 'password-show-hide-toggle.js',

    // 2. Dark / Light Theme Switcher
    // 'theme-toggle-dark-light.js',

    // 3. Reset Password on Login Page
    // 'login-reset-password.js',

    // 4. Character limits for individual text fields (separate file per field)
    // 'text-limit-user-name.js',            // Max 50 chars: User Name (Profile, User Management)
    // 'text-limit-user-email.js',           // Max 80 chars: User Email Address (Login, Create User, Reset Password)
    // 'text-limit-user-password.js',        // Max 64 chars: Password (Default limit for Login, Create User, Reset)
    // 'text-limit-contact-info.js',         // Max 100 chars: Contact Information / Phone (Profile, User Setup)
    // 'text-limit-admission-evidence.js',   // Max 200 chars: Admission Evidence Reference / Link / Doc ID
    // 'text-limit-correction-reason.js',    // Max 300 chars: Verification Correction Reason (Reviewer feedback)
    // 'text-limit-progression-remarks.js',  // Max 300 chars: Progression Update Remarks (Status notes)
    // 'text-limit-admission-remarks.js',    // Max 300 chars: Admission Update Remarks (Admission record notes)
    // 'text-limit-master-name.js',          // Max 80 chars: Master Data Entity Name (Country, Institution, Programme)
    // 'text-limit-master-city.js',          // Max 60 chars: Master Data Institution City
    // 'text-limit-master-code.js',          // Max 10 chars: Master Data Country Code (e.g., IN, US, GB)
    // 'text-limit-master-degree-type.js',   // Max 50 chars: Master Data Programme Degree Type (e.g., MS, MTech, PhD)
    // 'text-limit-master-duration.js',      // Max 30 chars: Master Data Programme Duration (e.g., 2 years)
    // 'text-limit-search-student.js',       // Max 50 chars: Student Name Search Filter on Records/Queue list
    // 'text-limit-reset-code.js',           // Max 6 chars: Password Reset Verification Code (6-digit code)


    // Restriction: Only alphabetic characters (A-Z, a-z) allowed in student fields
    // 'student-field-alphabets-only.js',

    // 5. LNMIIT Email Domain Validator (@lnmiit.ac.in)
    // 'email-domain-validator-lnmiit.js',

    // 6. Password First Letter Capital Requirement
    // 'password-first-letter-capital.js',

    // 7. Password Maximum 10 Characters Limit
    // 'password-max-10-characters.js',

    // 7b. Password Maximum 10 Words Limit
    // 'password-max-10-words.js',

    // 8. Password Minimum 8 Characters Requirement
    // 'password-min-length-8.js',

    // 9. Password Must Contain at least 1 Number (0-9)
    // 'password-require-number.js',

    // 10. Password Must Contain at least 1 Special Character
    // 'password-require-special-char.js',

    // 11. Optional Starting-Character Rules (Uncomment to activate):
    // 'password-start-with-number.js',              // First char must be a number (0-9)
    // 'password-start-with-special-char.js',        // First char must be a special char
    // 'password-start-with-number-or-special.js'     // First char must be a number OR special char
  ];

  // --------------------------------------------------------------------------
  // FEATURE ROUTER CORE ENGINE
  // --------------------------------------------------------------------------
  window.FeatureRouter = {
    features: {},
    activeRoutes: [...ACTIVE_FEATURE_ROUTES],

    /**
     * Register a feature module with the router.
     * @param {string} name - Unique feature name
     * @param {Object} module - Object containing init() and optional onDOMChange()
     */
    register(name, module) {
      this.features[name] = module;
      if (typeof module.init === 'function') {
        try {
          module.init();
        } catch (err) {
          console.error(`[FeatureRouter] Error initializing ${name}:`, err);
        }
      }
    },

    /**
     * Notify registered features when the DOM tree updates (e.g. view changes).
     */
    notifyDOMChange() {
      for (const [name, mod] of Object.entries(this.features)) {
        if (typeof mod.onDOMChange === 'function') {
          try {
            mod.onDOMChange();
          } catch (err) {
            console.error(`[FeatureRouter] Error in ${name}.onDOMChange:`, err);
          }
        }
      }
    },

    /**
     * Dynamically load an individual script file.
     * @param {string} fileName - File path relative to /features/
     */
    loadScript(fileName) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `/features/${fileName}`;
        script.async = false;
        script.onload = () => {
          console.log(`[FeatureRouter] Successfully routed & loaded: ${fileName}`);
          resolve();
        };
        script.onerror = () => {
          console.warn(`[FeatureRouter] Failed to load route: ${fileName}`);
          reject(new Error(`Failed to load ${fileName}`));
        };
        document.head.appendChild(script);
      });
    },

    /**
     * Injects custom CSS rules into document head.
     * @param {string} id - Unique style tag ID
     * @param {string} cssContent - CSS rules string
     */
    injectCSS(id, cssContent) {
      if (document.getElementById(id)) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = cssContent;
      document.head.appendChild(style);
    },

    /**
     * Bootstrap and load all registered active routes.
     */
    async bootstrap() {
      console.log(`[FeatureRouter] Initializing ${this.activeRoutes.length} active routes...`);
      for (const route of this.activeRoutes) {
        try {
          await this.loadScript(route);
        } catch (e) {
          // Continue loading others even if one fails
        }
      }

      // Observe DOM mutations across the entire body so dialogs/modals and view changes are caught
      const observer = new MutationObserver(() => {
        this.notifyDOMChange();
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Initial run
      setTimeout(() => this.notifyDOMChange(), 100);
    }
  };

  // Start the feature router when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.FeatureRouter.bootstrap());
  } else {
    window.FeatureRouter.bootstrap();
  }
})();
