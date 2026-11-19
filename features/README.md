# Modular Feature Extensions & Feature Router

This directory contains standalone, modular features for the **Higher Studies Tracking System (HSTS)**. Each feature is encapsulated in its own separate file with an intuitive, self-explanatory filename.

---

## 🗂️ Directory Overview & Filename Mapping

| Requirement | Filename | Description |
|---|---|---|
| **Route File** | `feature-router.js` | Central router file. Registers and activates features dynamically in the main project. |
| **1. Password Visibility** | `password-show-hide-toggle.js` | Adds an interactive show/hide (👁️ / 🙈) icon to password fields. |
| **2. Dark / Light Theme** | `theme-toggle-dark-light.js` | Adds a header button allowing users to switch between Light and Dark themes with persistence. |
| **3. Reset Password** | `login-reset-password.js` | Adds a "Forgot / Reset Password?" modal on the login page with email domain verification. |
| **4.1 Text Limit** | `text-limit-user-name.js` | Max 50 characters on User Name inputs with live character counter. |
| **4.2 Text Limit** | `text-limit-user-email.js` | Max 80 characters on Email inputs with live character counter. |
| **4.3 Text Limit** | `text-limit-user-password.js` | Max 64 characters on Password inputs with live character counter. |
| **4.4 Text Limit** | `text-limit-contact-info.js` | Max 100 characters on Contact Information input with live character counter. |
| **4.5 Text Limit** | `text-limit-admission-evidence.js` | Max 200 characters on Admission Evidence input with live character counter. |
| **4.6 Text Limit** | `text-limit-correction-reason.js` | Max 300 characters on Correction Reason textarea with live character counter. |
| **4.7 Text Limit** | `text-limit-progression-remarks.js` | Max 300 characters on Progression Remarks textarea with live character counter. |
| **4.8 Text Limit** | `text-limit-admission-remarks.js` | Max 300 characters on Admission Remarks textarea with live character counter. |
| **4.9 Text Limit** | `text-limit-master-name.js` | Max 80 characters on Master Data entity name inputs (remaining / max). |
| **4.10 Text Limit** | `text-limit-master-city.js` | Max 60 characters on Institution City input (remaining / max). |
| **4.11 Text Limit** | `text-limit-master-code.js` | Max 10 characters on Country Code input (remaining / max). |
| **4.12 Text Limit** | `text-limit-master-degree-type.js` | Max 50 characters on Programme Degree Type input (remaining / max). |
| **4.13 Text Limit** | `text-limit-master-duration.js` | Max 30 characters on Programme Duration input (remaining / max). |
| **4.14 Text Limit** | `text-limit-search-student.js` | Max 50 characters on Student Search filter input (remaining / max). |
| **4.15 Text Limit** | `text-limit-reset-code.js` | Max 6 characters on Password Reset Verification Code (remaining / max). |
| **5. Email Placeholder** | `email-placeholder-lnmiit.js` | Sets the email input placeholder to `@lnmiit.ac.in` (replaces `e.g. 24ucs144@lnmiit.ac.in`). |
| **6. Email Domain Check** | `email-domain-validator-lnmiit.js` | Enforces that email addresses must strictly belong to `@lnmiit.ac.in`. |
| **6. Password First Capital** | `password-first-letter-capital.js` | Enforces that the first character of any password must be an uppercase capital letter (A-Z). |
| **7. Password Max 10 Chars** | `password-max-10-characters.js` | Enforces a maximum limit of 10 characters on password fields with live counter. |
| **7b. Password Max 10 Words** | `password-max-10-words.js` | Enforces a maximum limit of 10 words on password fields with word counter. |
| **8. Password Min 8 Chars** | `password-min-length-8.js` | Enforces minimum length of 8 characters with live status badge. |
| **9. Password Number Check** | `password-require-number.js` | Requires at least 1 numeric digit (0-9) with live status badge. |
| **10. Password Special Char** | `password-require-special-char.js` | Requires at least 1 special character (!@#$%^&*...) with live status badge. |
| **11a. Password Starts Number** | `password-start-with-number.js` | Enforces that the first character must be a numeric digit (0-9). |
| **11b. Password Starts Special** | `password-start-with-special-char.js` | Enforces that the first character must be a special character (!@#$...). |
| **11c. Password Starts Num/Spec** | `password-start-with-number-or-special.js` | Enforces that the first character must be a number or special character. |

---

## 🚀 How the Feature Router Works (`feature-router.js`)

The `feature-router.js` file serves as the routing switchboard.

### To Enable or Add a Feature:
Open `feature-router.js` and ensure the filename is in the `ACTIVE_FEATURE_ROUTES` array:

```javascript
const ACTIVE_FEATURE_ROUTES = [
  'password-show-hide-toggle.js',
  'theme-toggle-dark-light.js',
  'login-reset-password.js',
  // ... any other feature file
];
```

### To Disable a Feature:
Comment out or remove the filename from `ACTIVE_FEATURE_ROUTES`:

```javascript
const ACTIVE_FEATURE_ROUTES = [
  'password-show-hide-toggle.js',
  // 'theme-toggle-dark-light.js', <-- Disabled! The file is "just there" without running
  'login-reset-password.js',
];
```

The feature files can remain safely in this directory without affecting the main project. Whenever a developer wants to activate a feature in the future, they simply add the file name to the route list in `feature-router.js`.
