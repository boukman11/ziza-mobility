from pydantic import BaseModel
from typing import Optional, Dict

class LatLng(BaseModel):
    lat: float
    lng: float

class TripEstimateRequest(BaseModel):
    pickup: LatLng
    dropoff: LatLng

class TripCreateRequest(BaseModel):
    pickup: LatLng
    dropoff: LatLng

class DriverLocationUpdate(BaseModel):
    lat: float
    lng: float

class CompleteTripRequest(BaseModel):
    final_price: Optional[float]=None

class AssistanceCreateRequest(BaseModel):
    location: LatLng
    note: Optional[str]=None

class SeedRequest(BaseModel):
    trips: int = 5
    assistances: int = 3


class PreferencesUpdate(BaseModel):
    prefs: Dict
