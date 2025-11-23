from abc import ABC, abstractmethod

class BaseTrainAPIWrapper(ABC):
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.is_logged_in = False

    @abstractmethod
    def login(self):
        """
        Logs into the train booking system.
        Returns True on success, False on failure.
        """
        pass

    @abstractmethod
    def search(self, dep_station, arr_station, date, time_from, time_to):
        """
        Searches for available trains based on criteria.
        Returns a list of train objects.
        """
        pass

    @abstractmethod
    def reserve(self, train):
        """
        Attempts to reserve a seat on the given train.
        Returns a ticket object on success, None on failure.
        """
        pass

class MockTrain:
    """A mock train object for testing purposes."""
    def __init__(self, dep, arr, time, has_seat=True, type="KTX"):
        self.dep = dep
        self.arr = arr
        self.time = time
        self._has_seat = has_seat
        self.type = type

    def has_seat(self):
        return self._has_seat

    def __str__(self):
        return f"{self.type} Train from {self.dep} to {self.arr} at {self.time}"

class MockTicket:
    """A mock ticket object for testing purposes."""
    def __init__(self, train, passenger_count=1):
        self.train = train
        self.passenger_count = passenger_count
        self.booking_id = "MOCK12345"

    def __str__(self):
        return (f"Ticket for {self.passenger_count} passenger(s) on "
                f"{self.train} (Booking ID: {self.booking_id})")

