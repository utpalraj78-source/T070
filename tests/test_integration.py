import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from hsts.api import Handler, Application
from hsts.seed import seed

class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        path=str(Path(self.tmp.name)/'integration.db')
        seed(path)
        Handler.app=Application(path)
        self.app=Handler.app
        self.http=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True)
        self.thread.start()
        self.base=f'http://127.0.0.1:{self.http.server_port}'
        self.student=self.login('24ucs144@lnmiit.ac.in','Laxita123!')
        self.other=self.login('24ucs145@lnmiit.ac.in','Vaibhav12!')
        self.coord=self.login('24ucs146@lnmiit.ac.in','Manan1234!')
        self.admin=self.login('24ucs148@lnmiit.ac.in','Harsh1234!')
    def tearDown(self):
        self.http.shutdown();self.http.server_close();self.thread.join();self.app.db.conn.close();self.tmp.cleanup()
    def request(self,method,path,body=None,token=None):
        data=json.dumps(body).encode() if body is not None else None
        h={'Content-Type':'application/json'}
        if token:h['Authorization']='Bearer '+token
        req=urllib.request.Request(self.base+'/api'+path,data=data,method=method,headers=h)
        try:r=urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:r=e
        with r:
            raw=r.read()
            return r.status, json.loads(raw) if raw else None
    def login(self,email,password):
        status,body=self.request('POST','/auth/login',{'email':email,'password':password})
        self.assertEqual(status,200)
        return body['token']
    def payload(self):return {'institution_id':1,'programme_id':1,'country_id':2,'admission_status':'Applied'}
    def test_IT_AUTH_001_login_success(self):
        status,body=self.request('GET','/profile',token=self.student)
        self.assertEqual(status,200);self.assertEqual(body['role'],'Student/Alumni')
    def test_IT_AUTH_002_failure_generic(self):
        status,body=self.request('POST','/auth/login',{'email':'24ucs144@lnmiit.ac.in','password':'wrong'})
        self.assertEqual(status,401);self.assertEqual(body['error']['message'],'Invalid credentials.')
    def test_IT_AUTH_003_inactive(self):
        self.request('PATCH','/users/1',{'active':False},self.admin)
        self.assertEqual(self.request('POST','/auth/login',{'email':'24ucs144@lnmiit.ac.in','password':'Laxita123!'})[0],401)
    def test_IT_AUTH_004_protected(self):self.assertEqual(self.request('GET','/records')[0],401)
    def test_IT_AUTH_005_logout(self):
        self.assertEqual(self.request('POST','/auth/logout',token=self.student)[0],204)
        self.assertEqual(self.request('GET','/profile',token=self.student)[0],401)
    def test_IT_PROFILE_001_update(self):
        status,body=self.request('PATCH','/profile',{'name':'Aarav S.','contact_info':'Demo contact'},self.student)
        self.assertEqual(status,200);self.assertEqual(body['name'],'Aarav S.')
        self.assertEqual(self.request('GET','/profile',token=self.student)[1]['contact_info'],'Demo contact')
    def test_IT_UC004_001_create_persists(self):
        status,body=self.request('POST','/records',self.payload(),self.student)
        self.assertEqual(status,201);self.assertEqual(body['verification_status'],'Draft')
        self.assertEqual(self.app.db.one('SELECT student_id FROM higher_study_records WHERE id=?',(body['id'],))['student_id'],1)
    def test_IT_UC004_002_invalid_master(self):self.assertEqual(self.request('POST','/records',{**self.payload(),'programme_id':4},self.student)[0],422)
    def test_IT_UC004_003_unauthorized(self):self.assertEqual(self.request('POST','/records',self.payload(),self.coord)[0],403)
    def test_IT_UC004_004_ownership(self):self.assertEqual(self.request('GET','/records/1',token=self.other)[0],403)
    def test_IT_UC004_005_submit(self):
        status,body=self.request('POST','/records/1/submit',{},self.student)
        self.assertEqual(status,200);self.assertEqual(body['verification_status'],'Submitted')
        self.assertEqual(self.request('PATCH','/records/1',self.payload(),self.student)[0],409)
    def test_IT_UC004_006_verified_edit_new_cycle(self):
        status,body=self.request('PATCH','/records/3',{'institution_id':3,'programme_id':4,'country_id':1,'admission_status':'Admitted'},self.other)
        self.assertEqual(status,200);self.assertEqual(body['verification_status'],'Draft')
        self.assertEqual(len(body['verification_history']),1)
    def test_IT_UC008_001_verify_all_rows(self):
        status,body=self.request('POST','/records/2/verification',{'decision':'Verified'},self.coord)
        self.assertEqual(status,200);self.assertEqual(body['verification_status'],'Verified')
        self.assertEqual(len(body['verification_history']),1)
        self.assertEqual(self.app.db.one("SELECT COUNT(*) n FROM audit_records WHERE action='RECORD_VERIFIED'")['n'],1)
        self.assertEqual(self.app.db.one('SELECT COUNT(*) n FROM notifications WHERE record_id=2')['n'],1)
    def test_IT_UC008_002_correction(self):
        status,body=self.request('POST','/records/2/verification',{'decision':'Correction Required','reason':'Confirm date'},self.coord)
        self.assertEqual(status,200);self.assertEqual(body['correction_reason'],'Confirm date')
        self.assertEqual(self.request('GET','/records/2',token=self.student)[1]['correction_reason'],'Confirm date')
    def test_IT_UC008_007_notification_visible(self):
        self.request('POST','/records/2/verification',{'decision':'Verified'},self.coord)
        status,body=self.request('GET','/notifications',token=self.student)
        self.assertEqual(status,200);self.assertEqual(len(body),1)
    def test_IT_UC008_003_duplicate(self):
        self.request('POST','/records/2/verification',{'decision':'Verified'},self.coord)
        self.assertEqual(self.request('POST','/records/2/verification',{'decision':'Verified'},self.coord)[0],409)
    def test_IT_UC008_004_student_forbidden(self):self.assertEqual(self.request('POST','/records/2/verification',{'decision':'Verified'},self.student)[0],403)
    def test_IT_UC008_005_missing_reason(self):self.assertEqual(self.request('POST','/records/2/verification',{'decision':'Correction Required'},self.coord)[0],422)
    def test_IT_UC008_006_rollback(self):
        self.app.db.run("CREATE TRIGGER reject_notification BEFORE INSERT ON notifications BEGIN SELECT RAISE(FAIL,'injected'); END")
        status,_=self.request('POST','/records/2/verification',{'decision':'Verified'},self.coord)
        self.assertEqual(status,500)
        self.assertEqual(self.app.db.one('SELECT verification_status FROM higher_study_records WHERE id=2')['verification_status'],'Submitted')
        self.assertEqual(self.app.db.one('SELECT COUNT(*) n FROM verifications WHERE record_id=2')['n'],0)
    def test_IT_UC006_001_progression_history(self):
        status,body=self.request('POST','/records/2/progression',{'status':'Completed','update_date':'2026-10-27','remarks':'Graduated'},self.coord)
        self.assertEqual(status,200);self.assertEqual(body['progression_status'],'Completed');self.assertEqual(len(body['progression_history']),2)
    def test_IT_UC006_002_invalid(self):self.assertEqual(self.request('POST','/records/1/progression',{'status':'Unknown','update_date':'2026-10-27'},self.coord)[0],422)
    def test_IT_UC006_003_missing_record(self):self.assertEqual(self.request('POST','/records/999/progression',{'status':'Ongoing','update_date':'2026-10-27'},self.coord)[0],404)
    def test_IT_UC006_004_forbidden(self):self.assertEqual(self.request('POST','/records/1/progression',{'status':'Ongoing','update_date':'2026-10-27'},self.student)[0],403)
    def test_IT_UC006_005_rollback(self):
        self.app.db.run("CREATE TRIGGER reject_progress BEFORE INSERT ON progress_updates BEGIN SELECT RAISE(FAIL,'injected'); END")
        self.assertEqual(self.request('POST','/records/1/progression',{'status':'Ongoing','update_date':'2026-10-27'},self.coord)[0],500)
        self.assertEqual(self.app.db.one('SELECT progression_status FROM higher_study_records WHERE id=1')['progression_status'],'Not Started')
    def test_IT_ADM_001_update_and_history(self):
        status,body=self.request('POST','/records/1/admission',{'status':'Admitted','update_date':'2026-10-27'},self.coord)
        self.assertEqual(status,200);self.assertEqual(body['admission_status'],'Admitted')
        self.assertEqual(len(body['admission_history']),2)
    def test_IT_SEARCH_001_combined(self):
        status,body=self.request('GET','/records?institution_id=2&verification_status=Submitted',token=self.coord)
        self.assertEqual(status,200);self.assertEqual([r['id'] for r in body],[2])
    def test_IT_SEARCH_002_student_scope(self):self.assertEqual(len(self.request('GET','/records',token=self.student)[1]),2)
    def test_IT_REPORT_001_summary(self):
        status,body=self.request('GET','/reports',token=self.coord)
        self.assertEqual(status,200);self.assertEqual(sum(x['count'] for x in body['by_institution']),4)
    def test_IT_ADMIN_001_role(self):self.assertEqual(self.request('PATCH','/users/1',{'role':'Higher Studies Coordinator'},self.admin)[1]['role'],'Higher Studies Coordinator')
    def test_IT_ADMIN_002_deactivate(self):self.assertEqual(self.request('PATCH','/users/1',{'active':False},self.admin)[1]['active'],0)
    def test_IT_ADMIN_003_country(self):self.assertEqual(self.request('POST','/master/countries',{'name':'Canada','code':'CA'},self.admin)[0],201)
    def test_IT_ADMIN_004_institution(self):self.assertEqual(self.request('POST','/master/institutions',{'name':'McGill','city':'Montreal','country_id':1},self.admin)[0],201)
    def test_IT_ADMIN_005_programme(self):self.assertEqual(self.request('POST','/master/programmes',{'name':'Physics','institution_id':1,'degree_type':'MS'},self.admin)[0],201)
    def test_IT_ADMIN_006_forbidden(self):self.assertEqual(self.request('POST','/master/countries',{'name':'Canada','code':'CA'},self.student)[0],403)
    def test_IT_ADMIN_007_audit(self):self.assertEqual(self.request('GET','/audit',token=self.student)[0],403)
    def test_IT_ADMIN_008_master_deactivation(self):
        self.assertEqual(self.request('PATCH','/master/programmes/1',{'active':False},self.admin)[1]['active'],0)
        self.assertEqual(self.request('POST','/records',self.payload(),self.student)[0],422)

if __name__=='__main__':unittest.main()
