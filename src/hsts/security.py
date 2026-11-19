import base64
import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from .domain import fail, ROLES

class RateLimiter:
    """Thread-safe sliding-window rate limiter for brute-force prevention."""
    def __init__(self, max_attempts=5, window_seconds=300):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.attempts = defaultdict(list)
        self.lock = threading.Lock()

    def is_rate_limited(self, key):
        with self.lock:
            now = time.time()
            cutoff = now - self.window_seconds
            self.attempts[key] = [t for t in self.attempts[key] if t > cutoff]
            return len(self.attempts[key]) >= self.max_attempts

    def record_failure(self, key):
        with self.lock:
            self.attempts[key].append(time.time())

    def record_success(self, key):
        with self.lock:
            self.attempts.pop(key, None)

login_rate_limiter = RateLimiter(max_attempts=5, window_seconds=300)
reset_rate_limiter = RateLimiter(max_attempts=5, window_seconds=300)

def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 210000)
    return base64.b64encode(salt).decode() + '$' + base64.b64encode(digest).decode()

def check_password(password, stored):
    try:
        salt, expected = (base64.b64decode(x) for x in stored.split('$'))
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 210000)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False

def authenticate(repo, email, password, client_ip='127.0.0.1'):
    email = (email or '').strip().lower()
    rate_key = f"{client_ip}:{email}"
    if login_rate_limiter.is_rate_limited(rate_key):
        fail('RATE_LIMIT_EXCEEDED', 'Too many failed login attempts. Please wait 5 minutes.', 429)

    if not email.endswith('@lnmiit.ac.in'):
        login_rate_limiter.record_failure(rate_key)
        fail('AUTHENTICATION_ERROR', 'Only @lnmiit.ac.in email addresses are permitted.', 401)

    user = repo.one('SELECT * FROM users WHERE email=?', (email,))
    if not user or not user['active'] or not check_password(password, user['password_hash']):
        login_rate_limiter.record_failure(rate_key)
        fail('AUTHENTICATION_ERROR', 'Invalid credentials.', 401)

    login_rate_limiter.record_success(rate_key)
    token = secrets.token_urlsafe(32)
    expiry = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()
    repo.run('INSERT INTO sessions VALUES (?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), user['id'], expiry))
    return token, public_user(user)

def current_user(repo, header, cookie_str=''):
    token = ''
    if header.startswith('Bearer '):
        token = header[7:].strip()
    elif cookie_str:
        for item in cookie_str.split(';'):
            if item.strip().startswith('hsts_session='):
                token = item.strip().split('=', 1)[1]
                break

    if not token:
        fail('AUTHENTICATION_ERROR', 'Authentication required.', 401)

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now_iso = datetime.now(timezone.utc).isoformat()
    user = repo.one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1', (token_hash, now_iso))
    if not user:
        repo.run('DELETE FROM sessions WHERE token_hash=?', (token_hash,))
        fail('AUTHENTICATION_ERROR', 'Authentication required.', 401)
    return user

def require_role(user, *roles):
    if user['role'] not in roles:
        fail('AUTHORIZATION_ERROR', 'You do not have permission for this action.', 403)

def require_owner_or_staff(user, record):
    if user['role'] == ROLES[0] and user['id'] != record['student_id']:
        fail('AUTHORIZATION_ERROR', 'You do not have permission for this record.', 403)

def public_user(user):
    return {k: user[k] for k in ('id','name','email','contact_info','role','active')}
