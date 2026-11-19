import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from hsts.domain import (AppError, ADMISSION, PROGRESSION, choice, progress_transition,
                         required, transition, valid_date)
from hsts.security import hash_password, check_password, require_role, require_owner_or_staff, authenticate
from hsts.db import Repository
from hsts.seed import seed
from hsts.service import Service

class DomainTests(unittest.TestCase):
    def assert_code(self, code, fn):
        with self.assertRaises(AppError) as e: fn()
        self.assertEqual(e.exception.code, code)

    def test_UT_STATE_001_draft_submit(self): self.assertEqual(transition('Draft','submit'),'Submitted')
    def test_UT_STATE_002_correction_resubmit(self): self.assertEqual(transition('Correction Required','submit'),'Submitted')
    def test_UT_STATE_003_verified_edit_new_cycle(self): self.assertEqual(transition('Verified','edit'),'Draft')
    def test_UT_STATE_004_duplicate_verify(self): self.assert_code('INVALID_STATE_TRANSITION',lambda:transition('Verified','verify'))
    def test_UT_STATE_005_submitted_edit(self): self.assert_code('INVALID_STATE_TRANSITION',lambda:transition('Submitted','edit'))
    def test_UT_PROG_001_start_ongoing(self): self.assertEqual(progress_transition('Not Started','Ongoing'),'Ongoing')
    def test_UT_PROG_002_ongoing_complete(self): self.assertEqual(progress_transition('Ongoing','Completed'),'Completed')
    def test_UT_PROG_003_terminal_reject(self): self.assert_code('INVALID_STATE_TRANSITION',lambda:progress_transition('Completed','Ongoing'))
    def test_UT_PROG_004_same_status_reject(self): self.assert_code('INVALID_STATE_TRANSITION',lambda:progress_transition('Ongoing','Ongoing'))
    def test_UT_DTO_001_required(self): self.assert_code('VALIDATION_ERROR',lambda:required(' ','Name'))
    def test_UT_DTO_002_choice(self): self.assert_code('VALIDATION_ERROR',lambda:choice('unknown',ADMISSION,'Admission'))
    def test_UT_DTO_003_invalid_date(self): self.assert_code('VALIDATION_ERROR',lambda:valid_date('2026-02-31','Date'))
    def test_UT_DTO_004_valid_leap_date(self): self.assertEqual(valid_date('2024-02-29','Date'),'2024-02-29')
    def test_UT_AUTH_001_password_hash(self):
        h=hash_password('example-pass')
        self.assertNotIn('example-pass',h)
        self.assertTrue(check_password('example-pass',h))
        self.assertFalse(check_password('wrong',h))
    def test_UT_RBAC_001_student_forbidden_coordinator(self): self.assert_code('AUTHORIZATION_ERROR',lambda:require_role({'role':'Student/Alumni'},'Higher Studies Coordinator'))
    def test_UT_RBAC_002_owner_allowed(self): require_owner_or_staff({'role':'Student/Alumni','id':1},{'student_id':1})
    def test_UT_RBAC_003_other_student_forbidden(self): self.assert_code('AUTHORIZATION_ERROR',lambda:require_owner_or_staff({'role':'Student/Alumni','id':2},{'student_id':1}))
    def test_UT_RBAC_004_staff_allowed(self): require_owner_or_staff({'role':'Higher Studies Coordinator','id':3},{'student_id':1})

class ServiceUnitTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.path=str(Path(self.tmp.name)/'test.db')
        seed(self.path)
        self.db=Repository(self.path)
        self.s=Service(self.db)
        self.student=self.db.one('SELECT * FROM users WHERE id=1')
        self.other=self.db.one('SELECT * FROM users WHERE id=2')
        self.coord=self.db.one('SELECT * FROM users WHERE id=3')
        self.admin=self.db.one('SELECT * FROM users WHERE id=4')
    def tearDown(self): self.db.conn.close();self.tmp.cleanup()
    def assert_code(self,code,fn):
        with self.assertRaises(AppError) as e: fn()
        self.assertEqual(e.exception.code,code)
    def payload(self): return {'institution_id':1,'programme_id':1,'country_id':2,'admission_status':'Applied'}
    def test_UT_AUTH_002_valid_login(self): self.assertEqual(authenticate(self.db,'24ucs144@lnmiit.ac.in','Laxita123!')[1]['id'],1)
    def test_UT_AUTH_003_invalid_generic(self): self.assert_code('AUTHENTICATION_ERROR',lambda:authenticate(self.db,'24ucs144@lnmiit.ac.in','wrong'))
    def test_UT_AUTH_004_inactive(self):
        self.db.run('UPDATE users SET active=0 WHERE id=1')
        self.assert_code('AUTHENTICATION_ERROR',lambda:authenticate(self.db,'24ucs144@lnmiit.ac.in','Laxita123!'))
    def test_UT_AUTH_005_domain_restriction(self):
        self.assert_code('AUTHENTICATION_ERROR',lambda:authenticate(self.db,'outsider@gmail.com','Laxita123!'))
    # Password policy rules are enforced ONLY by feature files in features/feature-router.js.
    # Commenting/uncommenting a file there toggles the rule - backend accepts any non-empty password.
    def test_UT_USER_003_password_accepted_any_non_empty(self):
        # Backend does not enforce password complexity - feature router controls each rule.
        result=self.s.create_user(self.admin,{'name':'Test User','email':'testuser@lnmiit.ac.in','role':'Student/Alumni','password':'anypass'})
        self.assertEqual(result['email'],'testuser@lnmiit.ac.in')
    def test_UT_USER_004_password_empty_rejected(self):
        # Only rule the backend keeps: password must not be blank.
        self.assert_code('VALIDATION_ERROR',lambda:self.s.create_user(self.admin,{'name':'Test User','email':'testuser2@lnmiit.ac.in','role':'Student/Alumni','password':' '}))
    def test_UT_REC_001_create_draft(self): self.assertEqual(self.s.create_record(self.student,self.payload())['verification_status'],'Draft')
    def test_UT_REC_002_missing_reference(self): self.assert_code('VALIDATION_ERROR',lambda:self.s.create_record(self.student,{**self.payload(),'institution_id':None}))
    def test_UT_REC_003_wrong_programme_institution(self): self.assert_code('VALIDATION_ERROR',lambda:self.s.create_record(self.student,{**self.payload(),'programme_id':3}))
    def test_UT_REC_004_invalid_country(self): self.assert_code('VALIDATION_ERROR',lambda:self.s.create_record(self.student,{**self.payload(),'country_id':999}))
    def test_UT_REC_009_fractional_reference_rejected(self): self.assert_code('VALIDATION_ERROR',lambda:self.s.create_record(self.student,{**self.payload(),'institution_id':1.5}))
    def test_UT_REC_005_staff_cannot_create_student_record(self): self.assert_code('AUTHORIZATION_ERROR',lambda:self.s.create_record(self.coord,self.payload()))
    def test_UT_REC_006_private_record(self): self.assert_code('AUTHORIZATION_ERROR',lambda:self.s.detail(self.other,1))
    def test_UT_REC_007_missing(self): self.assert_code('NOT_FOUND',lambda:self.s.detail(self.coord,9999))
    def test_UT_REC_008_verified_edit_returns_draft(self):
        x=self.s.edit_record(self.other,3,{'institution_id':3,'programme_id':4,'country_id':1,'admission_status':'Admitted'})
        self.assertEqual(x['verification_status'],'Draft')
        self.assertEqual(len(x['verification_history']),1)
    def test_UT_VER_001_coordinator_verifies(self): self.assertEqual(self.s.decide(self.coord,2,'Verified')['verification_status'],'Verified')
    def test_UT_VER_002_student_forbidden(self): self.assert_code('AUTHORIZATION_ERROR',lambda:self.s.decide(self.student,2,'Verified'))
    def test_UT_VER_003_duplicate(self):
        self.s.decide(self.coord,2,'Verified')
        self.assert_code('INVALID_STATE_TRANSITION',lambda:self.s.decide(self.coord,2,'Verified'))
    def test_UT_VER_004_correction_reason_required(self): self.assert_code('VALIDATION_ERROR',lambda:self.s.decide(self.coord,2,'Correction Required',' '))
    def test_UT_VER_005_correction_saved(self): self.assertEqual(self.s.decide(self.coord,2,'Correction Required','Fix evidence')['correction_reason'],'Fix evidence')
    def test_UT_PROG_005_history_preserved(self):
        x=self.s.update_progression(self.coord,2,{'status':'Completed','update_date':'2026-10-27'})
        self.assertEqual(x['progression_status'],'Completed')
        self.assertEqual(len(x['progression_history']),2)
    def test_UT_PROG_006_invalid_no_change(self):
        self.assert_code('VALIDATION_ERROR',lambda:self.s.update_progression(self.coord,1,{'status':'Unknown','update_date':'2026-10-27'}))
        self.assertEqual(self.db.one('SELECT progression_status FROM higher_study_records WHERE id=1')['progression_status'],'Not Started')
    def test_UT_PROG_007_date_required(self): self.assert_code('VALIDATION_ERROR',lambda:self.s.update_progression(self.coord,1,{'status':'Ongoing'}))
    def test_UT_PROG_008_student_forbidden(self): self.assert_code('AUTHORIZATION_ERROR',lambda:self.s.update_progression(self.student,1,{'status':'Ongoing','update_date':'2026-10-27'}))
    def test_UT_MASTER_001_admin_add_country(self): self.assertEqual(self.s.save_master(self.admin,'countries',{'name':'Canada','code':'CA'})['code'],'CA')
    def test_UT_MASTER_002_student_forbidden(self): self.assert_code('AUTHORIZATION_ERROR',lambda:self.s.save_master(self.student,'countries',{'name':'Canada','code':'CA'}))
    def test_UT_MASTER_003_programme_parent_required(self): self.assert_code('VALIDATION_ERROR',lambda:self.s.save_master(self.admin,'programmes',{'name':'AI','institution_id':999,'degree_type':'MS'}))
    def test_UT_SEARCH_001_student_scope(self): self.assertEqual(len(self.s.search(self.student,{})),2)
    def test_UT_SEARCH_002_combined_filters(self): self.assertEqual([r['id'] for r in self.s.search(self.coord,{'institution_id':'2','verification_status':'Submitted'})],[2])
    def test_UT_REPORT_001_aggregate(self): self.assertEqual(sum(x['count'] for x in self.s.reports(self.coord)['by_country']),4)
    def test_UT_REPORT_002_student_forbidden(self): self.assert_code('AUTHORIZATION_ERROR',lambda:self.s.reports(self.student))
    def test_UT_ADM_001_history(self): self.assertEqual(len(self.s.update_admission(self.coord,1,{'status':'Admitted','update_date':'2026-10-27'})['admission_history']),2)
    def test_UT_USER_001_role_change(self): self.assertEqual(self.s.update_user(self.admin,1,{'role':'Higher Studies Coordinator'})['role'],'Higher Studies Coordinator')
    def test_UT_USER_002_deactivate(self): self.assertEqual(self.s.update_user(self.admin,1,{'active':False})['active'],0)

if __name__=='__main__': unittest.main()
