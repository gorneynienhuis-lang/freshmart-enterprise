"""Offline guards for the CI shadow copy and opt-in entrypoints; no build, download, Docker or service."""
import importlib.util,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('ci_verify',Path(__file__).with_name('verify.py'));driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
class Guards(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name).resolve()
        for name in ['backend/src','database/migrations','frontend/src','contracts','design/v2','design/r04','scripts','deploy/ci']:(self.root/name).mkdir(parents=True,exist_ok=True)
        for name,text in [('backend/src/code.java','class Example {}'),('backend/target/live.jar','live'),('frontend/node_modules/host-native','mac-only'),('deploy/private/secret','should-never-copy'),('database/generated/seed.sql','private-seed'),('.dockerignore','*')]:
            file=self.root/name;file.parent.mkdir(parents=True,exist_ok=True);file.write_text(text)
        self.globals=patch.multiple(driver,ROOT=self.root,CI=self.root/'deploy/ci');self.globals.start()
    def tearDown(self):self.globals.stop();self.temp.cleanup()
    def test_shadow_excludes_live_builds_dependencies_and_credentials(self):
        work,source,hashes=driver.snapshot()
        self.assertTrue(work.is_relative_to(self.root/'deploy/ci/.work'));self.assertIn('backend/src/code.java',hashes)
        for name in ['backend/target','frontend/node_modules','deploy/private','database/generated','deploy/ci/.work']:self.assertFalse((source/name).exists())
        (source/'backend/src/code.java').write_text('modified shadow')
        self.assertEqual((self.root/'backend/src/code.java').read_text(),'class Example {}')
        self.assertEqual((self.root/'backend/target/live.jar').read_text(),'live')
    def test_linked_source_is_rejected(self):
        (self.root/'frontend/src/link').symlink_to(self.root/'deploy/private/secret')
        with self.assertRaises(RuntimeError):driver.snapshot()
    def test_linked_private_output_cannot_change_an_outside_directory(self):
        outside=self.root/'outside';outside.mkdir();os.chmod(outside,0o755)
        (self.root/'deploy/ci/.work').symlink_to(outside,target_is_directory=True)
        with self.assertRaises(RuntimeError):driver.snapshot()
        self.assertEqual(outside.stat().st_mode&0o777,0o755);self.assertEqual(list(outside.iterdir()),[])
    def test_child_environment_omits_live_application_credentials(self):
        with patch.dict(os.environ,{'APP_TOKEN_SECRET':'synthetic-secret','DB_PASSWORD':'synthetic-password','REDIS_PASSWORD':'synthetic-password','SANDBOX_SECRET':'synthetic-secret','PATH':'/safe/bin'}):
            env=driver.environment();self.assertEqual(env['PATH'],'/safe/bin');self.assertFalse(any(key.startswith(('APP_','DB_','REDIS_','SANDBOX_')) for key in env))
    def test_missing_explicit_execute_never_creates_shadow_or_runs_commands(self):
        with patch('sys.argv',['verify.py','--scope','all']),patch.object(driver,'snapshot') as snapshot,patch.object(driver.subprocess,'run') as run:
            self.assertEqual(driver.main(),2);snapshot.assert_not_called();run.assert_not_called()
if __name__=='__main__':unittest.main()
