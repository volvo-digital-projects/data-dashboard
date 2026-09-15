import copy
import runpy
import unittest
from pathlib import Path

merge = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/refresh-youtube-metrics.py'))['merge_channel']

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

if __name__ == '__main__': unittest.main()
