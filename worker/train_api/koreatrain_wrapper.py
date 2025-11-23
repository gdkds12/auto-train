# worker/train_api/koreatrain_wrapper.py
from koreatrain import KoreaTrain
from koreatrain.korail import Korail, KorailPassenger
from koreatrain.srt import SRT, SRTPassenger

class KoreaTrainWrapper:
    def __init__(self, username, password, train_mode):
        self.client = KoreaTrain(train_mode.upper(), username, password)

    def login(self):
        return self.client.login()

    def search(self, dep, arr, date, time, time_to='235959'):
        return self.client.search(dep, arr, date, time)

    def reserve(self, train):
        return self.client.reserve(train)

    @property
    def is_logged_in(self):
        return self.client.is_logged_in
