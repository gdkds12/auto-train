# worker/train_api/korail.py
from korail2 import Korail
from .base import BaseTrainAPIWrapper, MockTrain, MockTicket

class KorailWrapper(BaseTrainAPIWrapper):
    def __init__(self, username, password):
        super().__init__(username, password)
        self.korail = Korail(username, password)

    def login(self):
        try:
            if self.korail.login():
                self.is_logged_in = True
                print("Korail: Login successful.")
                return True
        except Exception as e:
            print(f"Korail: Login failed - {e}")
        
        self.is_logged_in = False
        return False

    def search(self, dep_station, arr_station, date, time_from, time_to):
        if not self.is_logged_in:
            print("Korail: Not logged in. Cannot search.")
            return []
        
        try:
            trains = self.korail.search_train(dep_station, arr_station, date, time_from, include_no_seats=True)
            print(f"Korail: Found {len(trains)} trains.")
            return trains
        except Exception as e:
            print(f"Korail: Search failed - {e}")
            import traceback
            traceback.print_exc()
            return []

    def reserve(self, train):
        if not self.is_logged_in:
            print("Korail: Not logged in. Cannot reserve.")
            return None
        
        try:
            ticket = self.korail.reserve(train)
            if ticket:
                print(f"Korail: Successfully reserved {ticket}")
                return ticket
        except Exception as e:
            print(f"Korail: Reservation failed - {e}")

        return None