"""Packaging guards with a read-only object-store fixture; no Git writes or live services."""
import importlib.util,io,json,os,sys,tempfile,unittest,zipfile
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('package_source_driver',Path(__file__).resolve().parents[1]/'package-source.py')
driver=importlib.util.module_from_spec(spec);sys.modules[spec.name]=driver;spec.loader.exec_module(driver)
COMMIT='1'*40;TIMESTAMP=1792300000;TOOL='2'*64
class ObjectFixture:
    """Keys are Git blob identities, deliberately independent of working-tree filenames."""
    def __init__(self,files):
        self.objects={};self.entries=[]
        for path,data in files.items():
            oid=driver.blob_oid(data);self.objects[oid]=data;self.entries.append(driver.Entry(path,oid,len(data)))
        self.entries.sort(key=lambda e:e.path)
    def read(self,entry):return self.objects[entry.oid]

class PackageSource(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name).resolve();self.store=ObjectFixture({'README.md':b'Synthetic source fixture\n','frontend/src/app.ts':b'export const value = "committed";\n','backend/src/TokenCodec.java':b'// token is a necessary source symbol, not a credential file\n','database/migrations/V001__test.sql':b'CREATE TABLE fixture(id INT PRIMARY KEY);\n'})
    def tearDown(self):self.temp.cleanup()
    def build(self,name='source.zip',store=None,omit=False):
        store=store or self.store;target=self.root/name
        manifest,raw,introduction=driver.build_zip(target,COMMIT,TIMESTAMP,store.entries,store,driver.REPOSITORY,TOOL,omit)
        return target,manifest
    def rewrite(self,path,change=None,extra=None):
        rebuilt=self.root/'rewritten.zip'
        with zipfile.ZipFile(path) as source,zipfile.ZipFile(rebuilt,'w') as destination:
            for item in source.infolist():
                data=source.read(item.filename)
                if change:data=change(item.filename,data)
                destination.writestr(item,data)
            if extra:
                name,data=extra;destination.writestr(driver.zip_info(name,TIMESTAMP),data)
        return rebuilt
    def test_archive_reads_committed_blobs_instead_of_dirty_or_untracked_files(self):
        dirty=self.root/'frontend/src/app.ts';dirty.parent.mkdir(parents=True);dirty.write_text('dirty working-tree content')
        (self.root/'untracked-password.env').write_text('not reviewed')
        target,manifest=self.build()
        with zipfile.ZipFile(target) as archive:
            self.assertEqual(archive.read(driver.PREFIX+'frontend/src/app.ts'),b'export const value = "committed";\n')
            self.assertNotIn('untracked-password.env',archive.namelist())
            self.assertIn(driver.PREFIX+'backend/src/TokenCodec.java',archive.namelist())
        self.assertFalse(manifest['packager']['identical_tool_in_selected_commit'])
        self.assertEqual(driver.verify_zip(target)['source_commit'],COMMIT)
    def test_repeatable_archive_and_manifest_and_trusted_digest(self):
        first,manifest=self.build('first.zip');second,_=self.build('second.zip')
        self.assertEqual(first.read_bytes(),second.read_bytes())
        actual=driver.sha256(first.read_bytes());self.assertEqual(driver.verify_zip(first,actual)['zip_sha256'],actual)
        with self.assertRaises(driver.PackageError):driver.verify_zip(first,'0'*64)
        self.assertEqual(manifest['source_bytes'],sum(e.size for e in self.store.entries))
    def test_traversal_absolute_windows_controls_and_ambiguous_paths_rejected(self):
        for path in ['../escape','/absolute','C:/drive','docs/a\\b','docs/a/../b','docs/name\n','docs/trailing ','docs/.','docs//double']:
            with self.subTest(path=path),self.assertRaises(driver.PackageError):driver.validate_entry(driver.Entry(path,'a'*40,1))
        collision=ObjectFixture({'frontend/Name.ts':b'a','frontend/name.ts':b'b'})
        with self.assertRaises(driver.PackageError):self.build(store=collision)
        self.assertFalse((self.root/'source.zip').exists())
    def test_dangerous_tracked_paths_and_nonregular_sources_fail_closed(self):
        for path in ['.runtime/demo.env','backend/target/app.jar','frontend/node_modules/native','deploy/.env','deploy/.env.live','deploy/private/backend.env','database/database.sql','docs/example.sql','docs/token.txt','docs/recording.mp4','docs/evidence/new-runtime.log']:
            with self.subTest(path=path),self.assertRaises(driver.PackageError):driver.validate_entry(driver.Entry(path,'a'*40,1))
        for mode in ['120000','160000','100600']:
            with self.assertRaises(driver.PackageError):driver.validate_entry(driver.Entry('frontend/src/link','a'*40,1,mode))
    def test_high_confidence_secret_and_nonplaceholder_env_are_rejected_without_echo(self):
        token=b'ghp_'+b'A'*40;store=ObjectFixture({'README.md':token})
        with self.assertRaises(driver.PackageError) as failure:self.build(store=store)
        self.assertNotIn(token.decode(),str(failure.exception));self.assertFalse((self.root/'source.zip').exists())
        store=ObjectFixture({'deploy/.env.example':b'APP_TOKEN_SECRET=actually-private-value\n'})
        with self.assertRaises(driver.PackageError):self.build(store=store)
        store=ObjectFixture({'deploy/.env.example':b'APP_TOKEN_SECRET=REQUIRED_RANDOM_SECRET\n'})
        target,_=self.build(store=store);self.assertEqual(driver.verify_zip(target)['source_file_count'],1)
    def test_dump_schema_switch_lfs_and_inconsistent_object_identity_rejected(self):
        for data in [b'-- MySQL dump\nCREATE TABLE copied(id INT);',b'USE live_database;\n',b'CREATE DATABASE live_database;\n']:
            store=ObjectFixture({'database/migrations/V999__bad.sql':data})
            with self.assertRaises(driver.PackageError):self.build(store=store)
        store=ObjectFixture({'design/v2/assets/pointer.png':b'version https://git-lfs.github.com/spec/v1\noid sha256:unknown\n'})
        with self.assertRaises(driver.PackageError):self.build(store=store)
        entry=self.store.entries[0]
        with self.assertRaises(driver.PackageError):driver.validate_content(driver.Entry(entry.path,'0'*40,entry.size),self.store.read(entry))
    def test_historical_schema_exception_is_exact_path_and_hash_only(self):
        path=next(iter(driver.HISTORICAL_SCHEMA));entry=driver.Entry(path,'a'*40,1)
        driver.validate_entry(entry)
        changed=ObjectFixture({path:b'CREATE TABLE changed(id INT);\n'})
        with self.assertRaises(driver.PackageError):self.build(store=changed)
        with self.assertRaises(driver.PackageError):driver.validate_entry(driver.Entry('docs/evidence/other-schema.sql','a'*40,1))
    def test_reviewed_historical_logs_require_unchanged_exact_hash(self):
        for path in driver.HISTORICAL_LOGS:
            driver.validate_entry(driver.Entry(path,'a'*40,1))
            with self.subTest(path=path),self.assertRaises(driver.PackageError):self.build(store=ObjectFixture({path:b'Historical evidence changed\n'}))
        with self.assertRaises(driver.PackageError):driver.validate_entry(driver.Entry('docs/evidence/implementation-foundation/unreviewed.log','a'*40,1))
    def test_optional_archive_omission_is_explicit_and_never_omits_source_assets(self):
        store=ObjectFixture({'design/v2/assets/attempt.png':b'needed-image','docs/evidence/demo/attempts/old.png':b'archived-image','docs/evidence/demo/attempts/result.json':b'{"status":"FAILED"}'})
        target,manifest=self.build(store=store,omit=True)
        self.assertEqual([r['path'] for r in manifest['excluded']],['docs/evidence/demo/attempts/old.png'])
        self.assertIn(COMMIT,manifest['excluded'][0]['git_blob_url'])
        with zipfile.ZipFile(target) as archive:
            self.assertIn(driver.PREFIX+'design/v2/assets/attempt.png',archive.namelist());self.assertIn(driver.PREFIX+'docs/evidence/demo/attempts/result.json',archive.namelist())
        self.assertEqual(driver.verify_zip(target)['excluded_file_count'],1)
    def test_zip_content_tampering_and_unlisted_members_fail_verification(self):
        target,_=self.build()
        changed=self.rewrite(target,lambda name,data:b'changed' if name.endswith('frontend/src/app.ts') else data)
        with self.assertRaises(driver.PackageError):driver.verify_zip(changed)
        changed.unlink();changed=self.rewrite(target,extra=(driver.PREFIX+'docs/unlisted.txt',b'unlisted'))
        with self.assertRaises(driver.PackageError):driver.verify_zip(changed)
    def test_manifest_count_and_git_oid_tampering_are_detected(self):
        target,_=self.build()
        def mutate(name,data):
            if name!='SOURCE-MANIFEST.json':return data
            value=json.loads(data);value['source_file_count']+=1;return driver.stable_json(value)
        changed=self.rewrite(target,mutate)
        with self.assertRaises(driver.PackageError):driver.verify_zip(changed)
        changed.unlink()
        def mutate_oid(name,data):
            if name!='SOURCE-MANIFEST.json':return data
            value=json.loads(data);value['files'][0]['git_blob_oid']='0'*40;return driver.stable_json(value)
        changed=self.rewrite(target,mutate_oid)
        with self.assertRaises(driver.PackageError):driver.verify_zip(changed)
    def test_zip_path_traversal_never_extracts_files(self):
        target,_=self.build();changed=self.rewrite(target,extra=('../escape',b'bad'))
        with self.assertRaises(driver.PackageError):driver.verify_zip(changed)
        self.assertFalse((self.root.parent/'escape').exists())
    def test_output_outside_repo_and_no_symlink_parent(self):
        repo=self.root/'repo';repo.mkdir()
        with self.assertRaises(driver.PackageError):driver.safe_output(repo/'inside',repo)
        outside=self.root/'outside';outside.mkdir();link=self.root/'link';link.symlink_to(outside,target_is_directory=True)
        with self.assertRaises(driver.PackageError):driver.safe_output(link/'delivery',repo)
        self.assertEqual(list(outside.iterdir()),[])
        self.assertEqual(driver.safe_output(self.root/'delivery',repo),self.root/'delivery')
    def test_explicit_commit_and_credential_free_repo_url_are_required(self):
        with patch.object(driver,'git') as git:
            for value in ['HEAD','main','98ac1c2;echo unsafe','--all','123']:
                with self.assertRaises(driver.PackageError):driver.committed_tree(self.root,value)
            git.assert_not_called()
        for url in ['http://github.com/a/b','https://token@github.com/a/b','https://github.com/a/b?token=bad','https://evil.example/a/b']:
            with self.assertRaises(driver.PackageError):driver.repository_url(url)

if __name__=='__main__':unittest.main()
