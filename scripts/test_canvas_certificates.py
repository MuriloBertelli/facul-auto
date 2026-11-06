"""Isolated transport/state tests: no credentials, PDFs or hosted fixtures."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location('certificates', Path(__file__).with_name('canvas-certificates.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakeCanvas:
    def __init__(self, item, unknown=False):
        self.item, self.unknown, self.writes = item, unknown, []
        self.assignment = {'id': 2, 'name': 'Certificate fixture', 'due_at': None,
                           'can_submit': True, 'locked_for_user': False, 'submission_types': ['online_upload']}
        self.receipt = {'assignment_id': 2, 'workflow_state': 'unsubmitted', 'attempt': None}

    def api(self, method, path, payload=None):
        if path == '/api/v1/users/self/profile':
            return {'name': 'Owner Fixture'}
        if method == 'GET':
            return self.assignment
        self.writes.append(('submission', payload))
        self.receipt = {'assignment_id': 2, 'submission_type': 'online_upload', 'attempt': 1,
                        'workflow_state': 'submitted', 'submitted_at': '2026-11-06T00:00:00Z',
                        'attachments': [{'id': file_id} for file_id in payload['submission']['file_ids']]}
        if self.unknown:
            raise module.Stop('Unknown network result')
        return self.receipt

    def submission(self, item):
        return copy.deepcopy(self.receipt)

    def upload(self, item, file, data, on_pending=None):
        self.writes.append(('upload', file['sha256']))
        return 100


class CertificateTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.pdf = self.root / 'fixture.pdf'
        self.pdf.write_bytes(b'\r\n\r\n%PDF-1.4\nFixture only\n')
        self.item = {'course_id': '1', 'assignment_id': '2', 'title': 'Certificate fixture',
                     'url': 'https://pucpr.instructure.com/courses/1/assignments/2', 'due_at': None,
                     'existing_attempt': None, 'files': [{'path': str(self.pdf), 'name': self.pdf.name,
                         'size': self.pdf.stat().st_size, 'sha256': hashlib.sha256(self.pdf.read_bytes()).hexdigest()}]}
        self.plan = {'canvas_origin': 'https://pucpr.instructure.com', 'expected_owner_name': 'Owner Fixture', 'items': [self.item]}
        self.plan['plan_sha256'] = module.digest(self.plan)
        self.journal = {'plan_sha256': self.plan['plan_sha256'], 'items': {}}
        self.journal_path = self.root / 'journal.json'

    def run_plan(self, canvas):
        contents = module.validate_plan(self.plan, self.plan['plan_sha256'])
        return module.execute(canvas, self.plan, contents, self.journal, self.journal_path)

    def test_modified_file_is_blocked_before_network(self):
        self.pdf.write_bytes(b'%PDF-1.4\nChanged\n')
        with self.assertRaises(module.Stop):
            module.validate_plan(self.plan, self.plan['plan_sha256'])

    def test_modified_destination_is_blocked(self):
        self.plan['items'][0]['assignment_id'] = '3'
        with self.assertRaises(module.Stop):
            module.validate_plan(self.plan, self.plan['plan_sha256'])

    def test_requires_enabled_process_and_exact_approval(self):
        approval = self.root / 'approval.json'
        module.write_private(approval, {'approved': True, 'approved_at': 'fixture', 'user_response': 'fixture', 'plan_sha256': 'other'})
        for enabled, path in [('false', str(approval)), ('true', None), ('true', str(approval))]:
            with self.assertRaises(module.Stop):
                module.authorization(self.plan, self.plan['plan_sha256'], path, enabled)

    def test_changed_or_existing_assignment_does_not_write(self):
        for change in [{'can_submit': False}, {'name': 'Different title'}, {'due_at': '2027-01-01'}, {'submission_types': ['online_url']}]:
            canvas = FakeCanvas(self.item)
            canvas.assignment.update(change)
            with self.assertRaises(module.Stop):
                self.run_plan(canvas)
            self.assertEqual(canvas.writes, [])
        canvas = FakeCanvas(self.item)
        canvas.receipt['submitted_at'] = '2026-11-01'
        with self.assertRaises(module.Stop):
            self.run_plan(canvas)
        self.assertEqual(canvas.writes, [])

    def test_confirmed_receipt_is_private_and_rerun_does_not_resubmit(self):
        canvas = FakeCanvas(self.item)
        self.assertEqual(self.run_plan(canvas), 1)
        self.assertEqual(self.journal['items']['2']['state'], 'confirmed')
        self.assertEqual(os.stat(self.journal_path).st_mode & 0o777, 0o600)
        self.assertEqual(self.run_plan(canvas), 1)
        self.assertEqual([entry[0] for entry in canvas.writes], ['upload', 'submission'])

    def test_unknown_post_checks_receipt_without_repeating(self):
        canvas = FakeCanvas(self.item, unknown=True)
        with self.assertRaises(module.Stop):
            self.run_plan(canvas)
        self.assertEqual(self.journal['items']['2']['state'], 'submitting')
        self.assertEqual(self.run_plan(canvas), 1)
        self.assertEqual([entry[0] for entry in canvas.writes], ['upload', 'submission'])

    def test_unknown_post_without_matching_receipt_stays_blocked(self):
        canvas = FakeCanvas(self.item, unknown=True)
        with self.assertRaises(module.Stop):
            self.run_plan(canvas)
        canvas.receipt = {'assignment_id': 2, 'workflow_state': 'unsubmitted'}
        with self.assertRaises(module.Stop):
            self.run_plan(canvas)
        self.assertEqual(len(canvas.writes), 2)

    def test_partial_upload_is_not_repeated(self):
        canvas = FakeCanvas(self.item)
        canvas.upload = Mock(side_effect=module.Stop('Unknown upload result'))
        with self.assertRaises(module.Stop):
            self.run_plan(canvas)
        with self.assertRaises(module.Stop):
            self.run_plan(canvas)
        self.assertEqual(canvas.upload.call_count, 1)

    def test_multipart_preserves_parameters_keeps_file_last_and_omits_bearer(self):
        canvas = module.Canvas('https://pucpr.instructure.com', 'fixture-token')
        canvas.api = Mock(return_value={'upload_url': 'https://inst-fs-iad-prod.inscloudgate.net/files',
                                       'upload_params': {'key': 'opaque-key', 'policy': 'opaque-policy'}})
        data = self.pdf.read_bytes()
        canvas.request = Mock(return_value=(201, {}, {'id': 100, 'size': len(data)}))
        self.assertEqual(canvas.upload(self.item, self.item['files'][0], data), 100)
        args, kwargs = canvas.request.call_args
        self.assertFalse(kwargs['authenticated'])
        self.assertNotIn('Authorization', args[3])
        self.assertLess(args[2].index(b'name="policy"'), args[2].index(b'name="file"'))
        self.assertIn(b'opaque-policy', args[2])
        self.assertEqual(canvas.api.call_args.args[2]['on_duplicate'], 'rename')

    def test_bearer_never_follows_foreign_redirect(self):
        canvas = module.Canvas('https://pucpr.instructure.com', 'fixture-token')
        canvas.opener = Mock()
        with self.assertRaises(module.Stop):
            canvas.request('GET', 'https://foreign.example/api/v1/files/1')
        canvas.opener.open.assert_not_called()


if __name__ == '__main__':
    unittest.main()
