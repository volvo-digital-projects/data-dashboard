import copy
import runpy
import unittest
from pathlib import Path

refresh_module = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/refresh-youtube-metrics.py'))
merge = refresh_module['merge_channel']
validate_refresh_scope = refresh_module['validate_refresh_scope']

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

if __name__ == '__main__': unittest.main()
