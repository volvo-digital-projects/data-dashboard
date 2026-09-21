import copy
import datetime
import runpy
import unittest
from pathlib import Path

refresh_module = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/refresh-youtube-metrics.py'))
merge = refresh_module['merge_channel']
validate_refresh_scope = refresh_module['validate_refresh_scope']
refresh_due = refresh_module['refresh_due']
collect_with_retry = refresh_module['collect_with_retry']

class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.old = dict(id='channel', checkedAt='old', sharedVideos=[dict(id='a', names=['known'], basis='reviewed')], commentSamples=12)
        self.fresh = dict(channelId='channel', errors=[], longComplete=True, shortComplete=True, videoCount=2, subscribers=10, totalViews=100,
                          videos=[dict(id='a', title='a', kind='long', views=10), dict(id='b', title='b', kind='short', views=20)])
    def test_counts_and_reviewed_attribution(self):
        output = merge(self.old, self.fresh, True)
        self.assertEqual(output['averageViews'], 15)
        self.assertEqual(output['sharedVideos'][0]['names'], ['known'])
        self.assertEqual(output['sharedVideos'][1]['names'], [])
        self.assertEqual(output['commentSamples'], 12)
        self.assertEqual(self.old['checkedAt'], 'old')
    def test_fail_closed(self):
        for field, value in [('channelId','wrong'), ('errors',['blocked']), ('longComplete',False), ('videoCount',3), ('subscribers',None)]:
            fresh=copy.deepcopy(self.fresh)
            fresh[field]=value
            with self.assertRaises(ValueError): merge(self.old, fresh)
    def test_requires_all_twelve_creator_entries(self):
        payload = dict(
            creators=[dict(channelId='shared' if index < 2 else f'channel-{index}') for index in range(12)],
            channels=[dict(id='shared')] + [dict(id=f'channel-{index}') for index in range(2, 12)],
        )
        self.assertEqual(validate_refresh_scope(payload), (12, 11))
        payload['creators'].pop()
        with self.assertRaises(ValueError): validate_refresh_scope(payload)
    def test_refreshes_hourly_without_duplicate_watchdog_runs(self):
        now = datetime.datetime(2026, 9, 21, 9, 0, tzinfo=datetime.timezone.utc)
        payload = dict(lastSuccessfulRefreshAt=(now - datetime.timedelta(minutes=54)).isoformat())
        self.assertFalse(refresh_due(payload, now))
        payload['lastSuccessfulRefreshAt'] = (now - datetime.timedelta(minutes=55)).isoformat()
        self.assertTrue(refresh_due(payload, now))
        self.assertTrue(refresh_due(payload, now, force=True))
    def test_retries_transient_channel_identity_failures(self):
        complete = dict(
            channelId='channel', errors=[], longComplete=True, shortComplete=True,
            videoCount=1, videos=[dict(id='video')],
        )
        responses = iter([
            dict(channelId=None, errors=[]),
            dict(complete, longComplete=False),
            complete,
        ])
        calls = []
        result = collect_with_retry(
            dict(id='channel', url='https://www.youtube.com/@channel'),
            lambda _url: next(responses),
            pause=lambda delay: calls.append(delay),
        )
        self.assertEqual(result['channelId'], 'channel')
        self.assertEqual(calls, [1, 2])

if __name__ == '__main__': unittest.main()
