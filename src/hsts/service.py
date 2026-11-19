import json
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from .domain import (ADMISSION, PROGRESSION, VERIFICATION, ROLES, choice, fail,
                     required, valid_date, transition, progress_transition)
from .security import require_role, require_owner_or_staff, hash_password, public_user, reset_rate_limiter

STUDENT, COORDINATOR, ADMIN = ROLES

def now():
    return datetime.now(timezone.utc).isoformat()

class Service:
    def __init__(self, repo):
        self.db = repo

    def audit(self, actor, action, entity, entity_id, detail=''):
        self.db.run('INSERT INTO audit_records(actor_id,action,entity,entity_id,detail,timestamp) VALUES(?,?,?,?,?,?)',
                    (actor['id'], action, entity, entity_id, detail, now()))

    def record(self, user, record_id):
        record = self.db.one('SELECT * FROM higher_study_records WHERE id=?', (record_id,))
        if not record:
            fail('NOT_FOUND', 'Higher-study record not found.', 404)
        require_owner_or_staff(user, record)
        return record

    def detail(self, user, record_id):
        record = self.record(user, record_id)
        record['student'] = public_user(self.db.one('SELECT * FROM users WHERE id=?', (record['student_id'],)))
        for key, table in [('admission_history','admission_updates'), ('progression_history','progress_updates'), ('verification_history','verifications')]:
            record[key] = self.db.all(f'SELECT * FROM {table} WHERE record_id=? ORDER BY id', (record_id,))
        return record

    def profile(self, user):
        return public_user(user)

    def update_profile(self, user, data):
        name = required(data.get('name'), 'Name')
        contact = str(data.get('contact_info', '')).strip()
        with self.db.transaction():
            self.db.run('UPDATE users SET name=?,contact_info=? WHERE id=?', (name, contact, user['id']))
            self.audit(user, 'PROFILE_UPDATED', 'user', user['id'])
        return public_user(self.db.one('SELECT * FROM users WHERE id=?', (user['id'],)))

    def master(self, kind):
        if kind not in ('countries','institutions','programmes'):
            fail('NOT_FOUND', 'Resource not found.', 404)
        return self.db.all(f'SELECT * FROM {kind} ORDER BY name')

    def _reference(self, table, value, label):
        if isinstance(value, bool) or not str(value).isdigit():
            fail('VALIDATION_ERROR', f'{label} is required.', 422)
        value = int(value)
        row = self.db.one(f'SELECT * FROM {table} WHERE id=? AND active=1', (value,))
        if not row:
            fail('VALIDATION_ERROR', f'{label} must reference active master data.', 422)
        return row

    def _record_fields(self, data):
        inst = self._reference('institutions', data.get('institution_id'), 'Institution')
        prog = self._reference('programmes', data.get('programme_id'), 'Programme')
        country = self._reference('countries', data.get('country_id'), 'Country')
        if prog['institution_id'] != inst['id']:
            fail('VALIDATION_ERROR', 'Programme must belong to the selected institution.', 422)
        admission = choice(data.get('admission_status'), ADMISSION, 'Admission status')
        start = valid_date(data['start_date'], 'Start date') if data.get('start_date') else None
        end = valid_date(data['expected_completion_date'], 'Expected completion date') if data.get('expected_completion_date') else None
        if start and end and end < start:
            fail('VALIDATION_ERROR', 'Expected completion date must not precede start date.', 422)
        return inst['id'], prog['id'], country['id'], admission, str(data.get('admission_evidence') or '').strip(), start, end

    def create_record(self, user, data):
        require_role(user, STUDENT)
        fields = self._record_fields(data)
        with self.db.transaction():
            cur = self.db.run('''INSERT INTO higher_study_records(student_id,institution_id,programme_id,country_id,admission_status,admission_evidence,start_date,expected_completion_date,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?)''', (user['id'], *fields, now(), now()))
            rid = cur.lastrowid
            self.db.run('INSERT INTO admission_updates(record_id,status,remarks,update_date,updated_by) VALUES(?,?,?,?,?)',
                        (rid, fields[3], 'Initial admission status', now(), user['id']))
            self.audit(user, 'RECORD_CREATED', 'higher_study_record', rid)
        return self.detail(user, rid)

    def edit_record(self, user, rid, data):
        require_role(user, STUDENT)
        old = self.record(user, rid)
        if old['verification_status'] == 'Submitted':
            fail('INVALID_STATE_TRANSITION', 'Submitted records cannot be edited.', 409)
        fields = self._record_fields(data)
        new_state = transition(old['verification_status'], 'edit') if old['verification_status'] in ('Verified','Correction Required') else 'Draft'
        with self.db.transaction():
            self.db.run('''UPDATE higher_study_records SET institution_id=?,programme_id=?,country_id=?,admission_status=?,admission_evidence=?,start_date=?,expected_completion_date=?,verification_status=?,correction_reason='',updated_at=? WHERE id=?''',
                        (*fields, new_state, now(), rid))
            if fields[3] != old['admission_status']:
                self.db.run('INSERT INTO admission_updates(record_id,status,remarks,update_date,updated_by) VALUES(?,?,?,?,?)',
                            (rid, fields[3], 'Student record edit', now(), user['id']))
            self.audit(user, 'RECORD_EDITED', 'higher_study_record', rid, f'{old["verification_status"]} to {new_state}')
        return self.detail(user, rid)

    def submit(self, user, rid):
        require_role(user, STUDENT)
        record = self.record(user, rid)
        state = transition(record['verification_status'], 'submit')
        with self.db.transaction():
            self.db.run('UPDATE higher_study_records SET verification_status=?,correction_reason=?,updated_at=? WHERE id=?', (state, '', now(), rid))
            self.audit(user, 'RECORD_SUBMITTED', 'higher_study_record', rid)
        return self.detail(user, rid)

    def decide(self, user, rid, decision, reason=''):
        require_role(user, COORDINATOR)
        record = self.record(user, rid)
        decision = choice(decision, ('Verified','Correction Required'), 'Decision')
        if decision == 'Correction Required':
            reason = required(reason, 'Correction reason')
        else:
            reason = ''
        state = transition(record['verification_status'], 'verify' if decision == 'Verified' else 'correct')
        with self.db.transaction():
            self.db.run('INSERT INTO verifications(record_id,reviewer_id,decision,reason,decision_date) VALUES(?,?,?,?,?)',
                        (rid, user['id'], decision, reason, now()))
            self.db.run('UPDATE higher_study_records SET verification_status=?,correction_reason=?,updated_at=? WHERE id=?',
                        (state, reason, now(), rid))
            self.audit(user, 'RECORD_VERIFIED' if decision == 'Verified' else 'CORRECTION_REQUESTED', 'higher_study_record', rid, reason)
            self.db.run('INSERT INTO notifications(recipient_id,record_id,message,created_at) VALUES(?,?,?,?)',
                        (record['student_id'], rid, f'Record #{rid}: {decision}' + (f' — {reason}' if reason else ''), now()))
        return self.detail(user, rid)

    def update_progression(self, user, rid, data):
        require_role(user, COORDINATOR)
        record = self.record(user, rid)
        status = progress_transition(record['progression_status'], data.get('status'))
        date = valid_date(data.get('update_date'), 'Update date')
        remarks = str(data.get('remarks') or '').strip()
        with self.db.transaction():
            self.db.run('INSERT INTO progress_updates(record_id,status,remarks,update_date,updated_by) VALUES(?,?,?,?,?)',
                        (rid, status, remarks, date, user['id']))
            self.db.run('UPDATE higher_study_records SET progression_status=?,updated_at=? WHERE id=?', (status, now(), rid))
            self.audit(user, 'PROGRESSION_UPDATED', 'higher_study_record', rid, f'{record["progression_status"]} to {status}')
        return self.detail(user, rid)

    def update_admission(self, user, rid, data):
        require_role(user, COORDINATOR)
        record = self.record(user, rid)
        status = choice(data.get('status'), ADMISSION, 'Admission status')
        if status == record['admission_status']:
            fail('CONFLICT', 'Admission status is unchanged.', 409)
        date = valid_date(data.get('update_date'), 'Update date')
        remarks = str(data.get('remarks') or '').strip()
        with self.db.transaction():
            self.db.run('INSERT INTO admission_updates(record_id,status,remarks,update_date,updated_by) VALUES(?,?,?,?,?)',
                        (rid, status, remarks, date, user['id']))
            self.db.run('UPDATE higher_study_records SET admission_status=?,updated_at=? WHERE id=?', (status, now(), rid))
            self.audit(user, 'ADMISSION_UPDATED', 'higher_study_record', rid, f'{record["admission_status"]} to {status}')
        return self.detail(user, rid)

    def search(self, user, filters):
        sql = '''SELECT r.*,u.name AS student_name,u.email AS student_email,i.name AS institution_name,p.name AS programme_name,c.name AS country_name
                 FROM higher_study_records r JOIN users u ON r.student_id=u.id JOIN institutions i ON r.institution_id=i.id
                 JOIN programmes p ON r.programme_id=p.id JOIN countries c ON r.country_id=c.id WHERE 1=1'''
        args = []
        if user['role'] == STUDENT:
            sql += ' AND r.student_id=?'; args.append(user['id'])
        elif filters.get('student'):
            sql += ' AND (u.name LIKE ? OR u.email LIKE ?)'
            term = '%' + str(filters['student']).strip() + '%'; args.extend((term,term))
        for key in ('institution_id','programme_id','country_id'):
            if filters.get(key):
                try: val = int(filters[key])
                except ValueError: fail('VALIDATION_ERROR', f'{key} must be an integer.', 422)
                sql += f' AND r.{key}=?'; args.append(val)
        for key, values in [('admission_status',ADMISSION),('progression_status',PROGRESSION),('verification_status',VERIFICATION)]:
            if filters.get(key):
                sql += f' AND r.{key}=?'; args.append(choice(filters[key], values, key))
        return self.db.all(sql + ' ORDER BY r.id DESC', args)

    def reports(self, user):
        require_role(user, COORDINATOR, ADMIN)
        def group(expr, join=''):
            return self.db.all(f'SELECT {expr} AS label,COUNT(*) AS count FROM higher_study_records r {join} GROUP BY {expr} ORDER BY label')
        return {'by_institution': group('i.name','JOIN institutions i ON i.id=r.institution_id'),
                'by_country': group('c.name','JOIN countries c ON c.id=r.country_id'),
                'by_programme': group('p.name','JOIN programmes p ON p.id=r.programme_id'),
                'by_admission_status': group('r.admission_status'),
                'by_progression_status': group('r.progression_status'),
                'by_verification_status': group('r.verification_status')}

    def users(self, user):
        require_role(user, ADMIN)
        return [public_user(x) for x in self.db.all('SELECT * FROM users ORDER BY id')]

    def create_user(self, user, data):
        require_role(user, ADMIN)
        name = required(data.get('name'), 'Name')
        email = required(data.get('email'), 'Email').lower().strip()
        if not email.endswith('@lnmiit.ac.in'):
            fail('VALIDATION_ERROR', 'Only @lnmiit.ac.in email addresses are permitted.', 422)
        role = choice(data.get('role'), ROLES, 'Role')
        password = required(data.get('password'), 'Password')
        # Password policy is enforced by the active feature files in features/
        # (password-min-length-8.js, password-max-length-10.js, password-first-letter-capital.js,
        #  password-require-number.js, password-require-special-char.js, etc.)
        # Commenting/uncommenting those files in feature-router.js toggles each rule.
        try:
            with self.db.transaction():
                cur = self.db.run('INSERT INTO users(name,email,contact_info,role,password_hash) VALUES(?,?,?,?,?)',
                                  (name,email,str(data.get('contact_info') or ''),role,hash_password(password)))
                self.audit(user, 'USER_CREATED', 'user', cur.lastrowid, role)
        except sqlite3.IntegrityError:
            fail('CONFLICT', 'Email already exists.', 409)
        return public_user(self.db.one('SELECT * FROM users WHERE id=?', (cur.lastrowid,)))

    def update_user(self, user, uid, data):
        require_role(user, ADMIN)
        target = self.db.one('SELECT * FROM users WHERE id=?', (uid,))
        if not target: fail('NOT_FOUND', 'User not found.', 404)
        role = choice(data.get('role', target['role']), ROLES, 'Role')
        active = data.get('active', target['active'])
        if active not in (0,1,False,True): fail('VALIDATION_ERROR', 'Active must be a boolean.', 422)
        if uid == user['id'] and (role != ADMIN or not active):
            fail('CONFLICT', 'Administrator cannot remove their own access.', 409)
        with self.db.transaction():
            self.db.run('UPDATE users SET role=?,active=? WHERE id=?', (role,int(active),uid))
            if not active: self.db.run('DELETE FROM sessions WHERE user_id=?', (uid,))
            self.audit(user, 'USER_UPDATED', 'user', uid, json.dumps({'role':role,'active':bool(active)}))
        return public_user(self.db.one('SELECT * FROM users WHERE id=?', (uid,)))

    def save_master(self, user, kind, data, item_id=None):
        require_role(user, ADMIN)
        if kind not in ('countries','institutions','programmes'): fail('NOT_FOUND', 'Resource not found.', 404)
        old = self.db.one(f'SELECT * FROM {kind} WHERE id=?', (item_id,)) if item_id else None
        if item_id and not old: fail('NOT_FOUND', 'Master-data item not found.', 404)
        merged = {**(old or {}), **data}
        name = required(merged.get('name'), 'Name')
        active = merged.get('active', 1)
        if active not in (0,1,False,True): fail('VALIDATION_ERROR', 'Active must be a boolean.', 422)
        values = {'name':name,'active':int(active)}
        if kind == 'countries':
            values['code'] = required(merged.get('code'), 'Country code').upper()
        elif kind == 'institutions':
            values['city'] = required(merged.get('city'), 'City')
            values['country_id'] = self._reference('countries',merged.get('country_id'),'Country')['id']
        else:
            values['institution_id'] = self._reference('institutions',merged.get('institution_id'),'Institution')['id']
            values['degree_type'] = required(merged.get('degree_type'), 'Degree type')
            values['duration'] = str(merged.get('duration') or '')
        try:
            with self.db.transaction():
                if item_id:
                    setter = ','.join(f'{k}=?' for k in values)
                    self.db.run(f'UPDATE {kind} SET {setter} WHERE id=?', (*values.values(),item_id))
                    result_id = item_id
                else:
                    cols = ','.join(values)
                    markers = ','.join('?' for _ in values)
                    result_id = self.db.run(f'INSERT INTO {kind}({cols}) VALUES({markers})', tuple(values.values())).lastrowid
                self.audit(user, 'MASTER_UPDATED' if item_id else 'MASTER_CREATED', kind, result_id)
        except sqlite3.IntegrityError:
            fail('CONFLICT', 'Master-data value conflicts with an existing item.', 409)
        return self.db.one(f'SELECT * FROM {kind} WHERE id=?', (result_id,))

    def audit_list(self, user):
        require_role(user, ADMIN)
        return self.db.all('SELECT * FROM audit_records ORDER BY id DESC LIMIT 200')

    def notifications(self, user):
        return self.db.all('SELECT * FROM notifications WHERE recipient_id=? ORDER BY id DESC', (user['id'],))

    def request_password_reset(self, email, client_ip='127.0.0.1'):
        rate_key = f"{client_ip}:reset"
        if reset_rate_limiter.is_rate_limited(rate_key):
            fail('RATE_LIMIT_EXCEEDED', 'Too many password reset requests. Please wait 5 minutes.', 429)
        email = required(email, 'Email').lower().strip()
        if not email.endswith('@lnmiit.ac.in'):
            fail('VALIDATION_ERROR', 'Only @lnmiit.ac.in email addresses are permitted for password reset.', 422)
        user = self.db.one('SELECT * FROM users WHERE LOWER(email)=? AND active=1', (email,))
        if not user:
            reset_rate_limiter.record_failure(rate_key)
            fail('NOT_FOUND', 'No active user found with this email address.', 404)
        code = f"{secrets.randbelow(900000) + 100000}"
        expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        with self.db.transaction():
            self.db.run('UPDATE password_resets SET used=1 WHERE user_id=?', (user['id'],))
            self.db.run('INSERT INTO password_resets(user_id,code,expires_at,used) VALUES(?,?,?,0)',
                        (user['id'], code, expiry))
            self.audit(user, 'PASSWORD_RESET_REQUESTED', 'user', user['id'])
        return 200, {
            'message': 'Verification code generated successfully. For testing/demo, your code is provided.',
            'code': code
        }

    def reset_password(self, email, password, code='', client_ip='127.0.0.1'):
        rate_key = f"{client_ip}:reset"
        if reset_rate_limiter.is_rate_limited(rate_key):
            fail('RATE_LIMIT_EXCEEDED', 'Too many attempts. Please wait 5 minutes.', 429)
        email = required(email, 'Email').lower().strip()
        if not email.endswith('@lnmiit.ac.in'):
            fail('VALIDATION_ERROR', 'Only @lnmiit.ac.in email addresses are permitted for password reset.', 422)
        password = required(password, 'Password')
        # Password policy is enforced by the active feature files in features/
        # (password-min-length-8.js, password-max-length-10.js, password-first-letter-capital.js,
        #  password-require-number.js, password-require-special-char.js, etc.)
        # Commenting/uncommenting those files in feature-router.js toggles each rule.
        user = self.db.one('SELECT * FROM users WHERE LOWER(email)=? AND active=1', (email,))
        if not user:
            reset_rate_limiter.record_failure(rate_key)
            fail('NOT_FOUND', 'No active user found with this email address.', 404)
        code = required(code, 'Verification code')
        now_iso = now()
        reset_entry = self.db.one(
            'SELECT * FROM password_resets WHERE user_id=? AND code=? AND used=0 AND expires_at>? ORDER BY id DESC LIMIT 1',
            (user['id'], code.strip(), now_iso)
        )
        if not reset_entry:
            reset_rate_limiter.record_failure(rate_key)
            fail('VALIDATION_ERROR', 'Invalid or expired verification code.', 422)
        reset_rate_limiter.record_success(rate_key)
        with self.db.transaction():
            self.db.run('UPDATE users SET password_hash=? WHERE id=?', (hash_password(password), user['id']))
            self.db.run('UPDATE password_resets SET used=1 WHERE id=?', (reset_entry['id'],))
            self.db.run('DELETE FROM sessions WHERE user_id=?', (user['id'],))
            self.audit(user, 'PASSWORD_RESET', 'user', user['id'], 'Password reset verified via secure code')
        return 200, {'message': 'Password reset successfully. You can now log in.'}
