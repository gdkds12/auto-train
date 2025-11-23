# worker/train_api/srt.py
from SRT import SRT
from .base import BaseTrainAPIWrapper, MockTrain, MockTicket

class SRTWrapper(BaseTrainAPIWrapper):
    def __init__(self, username, password):
        super().__init__(username, password)
        # SRT library can take member number (username) and password
        self.srt = SRT(username, password)

    def login(self):
        try:
            if self.srt.login():
                self.is_logged_in = True
                print("SRT: Login successful.")
                return True
        except Exception as e:
            print(f"SRT: Login failed - {e}")
        
        self.is_logged_in = False
        return False

    def search(self, dep_station, arr_station, date, time_from, time_to):
        if not self.is_logged_in:
            print("SRT: Not logged in. Cannot search.")
            return []
        
        try:
            # SRT library search_train takes date (YYYYMMDD) and time (HHMMSS)
            trains = self.srt.search_train(dep_station, arr_station, date, time_from)
            print(f"SRT: Found {len(trains)} trains.")
            return trains
        except Exception as e:
            print(f"SRT: Search failed - {e}")
            return []

    def reserve(self, train):
        if not self.is_logged_in:
            print("SRT: Not logged in. Cannot reserve.")
            return None
        
        try:
            ticket = self.srt.reserve(train)
            if ticket:
                print(f"SRT: Successfully reserved {ticket}")
                return ticket
        except Exception as e:
            print(f"SRT: Reservation failed - {e}")

        return None