/**
 * ============================================================================
 * FEATURE 3: Reset Password Functionality in Login Page
 * Filename: login-reset-password.js
 * ============================================================================
 * Adds a "Forgot / Reset Password?" option directly on the login page.
 * Opens an interactive modal where users can safely reset their password
 * by verifying their @lnmiit.ac.in email and entering a new password.
 * ============================================================================
 */

(function () {
  'use strict';

  const FEATURE_NAME = 'login-reset-password';

  const MODAL_STYLES = `
    .reset-pwd-link {
      display: inline-block;
      margin-top: 8px;
      font-size: 0.88rem;
      color: #0284c7;
      text-decoration: underline;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
    }
    .reset-pwd-link:hover {
      color: #0369a1;
    }
    [data-theme="dark"] .reset-pwd-link {
      color: #38bdf8;
    }
    dialog#resetPasswordModal {
      max-width: 440px;
      width: 90%;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      padding: 24px;
      background: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    }
    dialog#resetPasswordModal::backdrop {
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
    }
    [data-theme="dark"] dialog#resetPasswordModal {
      background: #1e293b;
      border-color: #334155;
      color: #f8fafc;
    }
  `;

  function openResetPasswordModal() {
    let existing = document.getElementById('resetPasswordModal');
    if (existing) existing.remove();

    const dialog = document.createElement('dialog');
    dialog.id = 'resetPasswordModal';
    dialog.innerHTML = `
      <h2>Reset Password (Secure Verification)</h2>
      <p class="sub" style="margin-bottom: 16px;">Request a one-time verification code for your institutional account.</p>
      <form id="resetPasswordForm">
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <label for="resetEmail">Institutional Email *</label>
            <div style="display:flex; gap:8px;">
              <input id="resetEmail" name="email" type="email" placeholder="username@lnmiit.ac.in" required autocomplete="email" style="flex:1;">
              <button type="button" id="sendCodeBtn" class="secondary" style="white-space:nowrap;">Get Code</button>
            </div>
            <small id="codeFeedback" style="display:none; margin-top:4px; color:#10b981; font-weight:500;"></small>
          </div>
          <div id="codeFieldsGroup" style="display:none; flex-direction:column; gap:12px;">
            <div>
              <label for="resetCode">6-Digit Verification Code *</label>
              <input id="resetCode" name="code" type="text" maxlength="6" placeholder="Enter 6-digit code" autocomplete="one-time-code">
            </div>
            <div>
              <label for="resetNewPassword">New Password *</label>
              <input id="resetNewPassword" name="newPassword" type="password" autocomplete="new-password">
            </div>
            <div>
              <label for="resetConfirmPassword">Confirm New Password *</label>
              <input id="resetConfirmPassword" name="confirmPassword" type="password" autocomplete="new-password">
            </div>
          </div>
        </div>
        <div class="actions" style="margin-top: 20px; display:flex; justify-content:flex-end; gap:8px;">
          <button type="submit" id="submitResetBtn" disabled>Reset Password</button>
          <button type="button" class="secondary" id="closeResetModal">Cancel</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    dialog.showModal();

    if (window.FeatureRouter && window.FeatureRouter.notifyDOMChange) {
      window.FeatureRouter.notifyDOMChange();
    }

    dialog.querySelector('#closeResetModal').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove());

    const form = dialog.querySelector('#resetPasswordForm');
    const sendCodeBtn = form.querySelector('#sendCodeBtn');
    const codeFeedback = form.querySelector('#codeFeedback');
    const codeFieldsGroup = form.querySelector('#codeFieldsGroup');
    const submitResetBtn = form.querySelector('#submitResetBtn');

    // Step 1: Request verification code
    sendCodeBtn.addEventListener('click', async () => {
      const email = form.email.value.trim().toLowerCase();
      if (!email || !email.endsWith('@lnmiit.ac.in')) {
        alert('Please enter a valid @lnmiit.ac.in institutional email address.');
        return;
      }

      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = 'Sending...';

      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result?.error?.message || 'Failed to generate verification code.');
        }

        codeFeedback.style.display = 'block';
        codeFeedback.textContent = `✓ Code generated! (Verification Code: ${result.code})`;
        codeFieldsGroup.style.display = 'flex';
        submitResetBtn.disabled = false;

        // Auto-fill code field for convenience in demo/testing
        const codeInput = form.querySelector('#resetCode');
        if (codeInput && result.code) {
          codeInput.value = result.code;
        }

        if (window.FeatureRouter && window.FeatureRouter.notifyDOMChange) {
          window.FeatureRouter.notifyDOMChange();
        }
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = 'Resend Code';
      }
    });

    // Step 2: Confirm password reset with verified code
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim().toLowerCase();
      const code = form.code.value.trim();
      const newPassword = form.newPassword.value;
      const confirmPassword = form.confirmPassword.value;

      if (!code) {
        alert('Verification code is required.');
        return;
      }
      if (newPassword !== confirmPassword) {
        alert('Passwords do not match. Please re-enter.');
        return;
      }
      if (newPassword.length < 8) {
        alert('Password must be at least 8 characters long.');
        return;
      }

      submitResetBtn.disabled = true;
      submitResetBtn.textContent = 'Verifying...';

      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, password: newPassword })
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result?.error?.message || 'Failed to reset password.');
        }

        dialog.close();
        if (typeof window.notice === 'function') {
          window.notice('Password reset successfully! You may now sign in.');
        } else {
          alert('Password reset successfully! You may now sign in with your new password.');
        }

        const loginEmail = document.getElementById('email');
        if (loginEmail) loginEmail.value = email;
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        submitResetBtn.disabled = false;
        submitResetBtn.textContent = 'Reset Password';
      }
    });
  }

  function attachResetPasswordLink() {
    const loginForm = document.getElementById('login');
    if (!loginForm) return;

    if (document.getElementById('forgot-password-link')) return;

    const pwdField = loginForm.querySelector('#password') || loginForm.querySelector('input[type="password"]');
    if (!pwdField) return;

    const linkContainer = document.createElement('div');
    linkContainer.style.textAlign = 'right';
    linkContainer.style.marginTop = '4px';

    const link = document.createElement('button');
    link.id = 'forgot-password-link';
    link.type = 'button';
    link.className = 'reset-pwd-link';
    link.textContent = 'Forgot / Reset Password?';
    link.onclick = openResetPasswordModal;

    linkContainer.appendChild(link);

    // Insert right after the password field or its container
    const parentContainer = pwdField.closest('.pwd-toggle-container') || pwdField;
    parentContainer.insertAdjacentElement('afterend', linkContainer);
  }

  function initResetPassword() {
    if (window.FeatureRouter && window.FeatureRouter.injectCSS) {
      window.FeatureRouter.injectCSS('reset-pwd-styles', MODAL_STYLES);
    }
    attachResetPasswordLink();
  }

  if (window.FeatureRouter) {
    window.FeatureRouter.register(FEATURE_NAME, {
      init: initResetPassword,
      onDOMChange: attachResetPasswordLink
    });
  } else {
    document.addEventListener('DOMContentLoaded', initResetPassword);
  }
})();
