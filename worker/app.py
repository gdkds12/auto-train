# worker/app.py
import os
import sys
import time
import logging
import threading
import re
from typing import List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
from sqlalchemy.orm import joinedload

from train_api.korail import KorailWrapper
from train_api.srt import SRTWrapper
from database import get_active_tasks, update_task_status, add_log, SessionLocal, Account, Task # Import SessionLocal, Account, Task
from notifier import send_push


# Configure logging
logging.basicConfig(stream=sys.stdout, level=logging.INFO)


# --- Pydantic Models for API Request/Response ---
class SearchRequest(BaseModel):
    accountId: int
    trainMode: str
    depStationName: str
    arrStationName: str
    date: str
    timeFrom: str

class TrainResult(BaseModel):
    trainNo: str
    trainType: str
    depTime: str
    arrTime: str
    depStation: str
    arrStation: str
    isAvailable: bool
    specialSeatAvailable: bool
    generalSeatAvailable: bool
    fare: float
    runDate: str
    trainId: str # Unique ID for the train from the library

class ReserveRequest(BaseModel):
    accountId: int
    trainMode: str
    depStation: str
    arrStation: str
    date: str
    timeFrom: str
    selectedTrainNo: str
    selectedTrainType: str
    selectedDepTime: str
    selectedArrTime: str
    selectedTrainClass: Optional[str] = None
    selectedTrainId: str

class LogModel(BaseModel):
    level: str
    message: str
    createdAt: str

class TaskStatusModel(BaseModel):
    id: int
    status: str
    isActive: bool
    logs: List[LogModel]
    depStation: str
    arrStation: str
    selectedTrainType: str
    selectedDepTime: str



# --- FastAPI App Setup ---
# Use asynccontextmanager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure DB is ready, then start the background worker thread
    logging.info("FastAPI app starting up. Waiting for database...")
    from database import wait_for_db
    wait_for_db() # Wait for DB to be ready

    logging.info("Initializing background worker thread...")
    worker_thread = threading.Thread(target=main_loop, daemon=True)
    worker_thread.start()
    yield
    # Shutdown: (Optional) You can add cleanup code here if needed
    logging.info("FastAPI app shutting down.")

app = FastAPI(lifespan=lifespan)

# For demonstration purposes, we'll keep a simple in-memory store for active drivers
active_drivers = {}

def get_driver(account: Account, train_mode: str):
    """
    Retrieves or creates a logged-in driver instance for a given account.
    Handles session management.
    """
    driver_key = f"{train_mode}-{account.username}"
    
    if driver_key not in active_drivers or not active_drivers[driver_key].is_logged_in:
        logging.info(f"Worker API: Driver not found or not logged in for {train_mode}, {account.username}. Attempting new login.")
        if train_mode == 'KTX':
            driver = KorailWrapper(account.username, account.password)
        elif train_mode == 'SRT':
            driver = SRTWrapper(account.username, account.password)
        else:
            raise HTTPException(status_code=400, detail="Invalid train mode")
        
        if driver.login():
            active_drivers[driver_key] = driver
            return driver
        else:
            raise HTTPException(status_code=401, detail="Login failed with provided credentials.")
    
    logging.info(f"Worker API: Using existing logged-in driver for {train_mode}, {account.username}.")
    return active_drivers[driver_key]


# --- API Endpoints ---
@app.post("/search", response_model=List[TrainResult])
async def search_trains(request: SearchRequest):
    logging.info(f"--- Worker: Received search request: {request.dict()} ---")
    db = SessionLocal()
    try:
        account = db.query(Account).filter(Account.id == request.accountId).first()
        if not account:
            logging.error(f"Worker: Account not found for ID {request.accountId}")
            raise HTTPException(status_code=404, detail="Account not found.")

        logging.info(f"Worker: Found account {account.username} for mode {request.trainMode}")
        driver = get_driver(account, request.trainMode)
        
        logging.info(f"Worker: Calling driver.search with: dep='{request.depStationName}', arr='{request.arrStationName}', date='{request.date}', time_from='{request.timeFrom}'")
        trains = driver.search(
            request.depStationName,
            request.arrStationName,
            request.date,
            request.timeFrom,
            '235959'
        )
        logging.info(f"--- Worker: Raw response from train library ({type(driver)}): ---")
        logging.info(trains)
        logging.info("--- End of raw response ---")

        formatted_results = []
        if trains:
            train_list = trains[0] if trains and isinstance(trains[0], list) else trains
            for s in train_list:
                logging.info(f"--- Worker: Processing string: '{s}' ---")
                try:
                    # Enhanced regex to handle various train info formats
                    pattern = re.compile(r"\[(.*?)\]\s+.*?,\s+(.*?)~(?P<arr_station>.*?)\((\d{2}:\d{2})~(\d{2}:\d{2})\)\s+.*?\s*([\d,]+)원")
                    match = pattern.search(str(s))

                    if match:
                        train_type, dep_station, arr_station_raw, dep_time, arr_time, fare_str = match.groups()
                        
                        # Clean up arr_station name
                        arr_station = arr_station_raw.strip()

                        fare = float(fare_str.replace(',', ''))
                        
                        dep_time_formatted = dep_time.replace(':', '')
                        arr_time_formatted = arr_time.replace(':', '')
                        
                        # Generate a more reliable train number
                        train_no = f"{train_type.split('-')[0]}-{dep_time}"

                        result = TrainResult(
                            trainNo=train_no,
                            trainType=train_type,
                            depTime=dep_time_formatted,
                            arrTime=arr_time_formatted,
                            depStation=dep_station.strip(),
                            arrStation=arr_station,
                            isAvailable='매진' not in str(s),
                            specialSeatAvailable='특실' in str(s) and '매진' not in str(s),
                            generalSeatAvailable=('일반실' in str(s) or ('특실' not in str(s) and '일반실' not in str(s))) and '매진' not in str(s),
                            fare=fare,
                            runDate=request.date,
                            trainId=f"{train_no}_{request.date}_{dep_time_formatted}"
                        )
                        formatted_results.append(result)
                    else:
                        logging.warning(f"--- Worker: Failed to parse string with regex: '{s}' ---")

                except Exception as e:
                    logging.warning(f"--- Worker: Exception while parsing string: '{s}' with error: {e} ---")
        
        logging.info(f"--- Worker: Formatted results ({len(formatted_results)} items): ---")
        logging.info(formatted_results)
        logging.info("--- End of formatted results ---")

        return formatted_results
    except Exception as e:
        logging.error(f"An error occurred in search_trains: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        db.close()


@app.post("/reserve")
async def create_reservation_task(request: ReserveRequest, background_tasks: BackgroundTasks):
    db = SessionLocal()
    try:
        account = db.query(Account).filter(Account.id == request.accountId).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found.")
        
        new_task = Task(
            accountId=request.accountId,
            depStation=request.depStation,
            arrStation=request.arrStation,
            date=request.date,
            timeFrom=request.timeFrom,
            passengers=1,
            interval=1, # Polling every 1 second for cancellation tickets
            isActive=True,
            status="PENDING",
            selectedTrainNo=request.selectedTrainNo,
            selectedTrainType=request.selectedTrainType,
            selectedDepTime=request.selectedDepTime,
            selectedArrTime=request.selectedArrTime,
            selectedTrainClass=request.selectedTrainClass,
            selectedTrainId=request.selectedTrainId,
        )
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        
        return {"message": "Reservation task created successfully", "taskId": new_task.id}
    finally:
        db.close()


@app.get("/tasks/{task_id}", response_model=TaskStatusModel)
async def get_task_status(task_id: int):
    db = SessionLocal()
    try:
        logging.info(f"--- Worker: Received request for task status: {task_id} ---")
        task = db.query(Task).options(joinedload(Task.logs)).filter(Task.id == task_id).first()
        if not task:
            logging.warning(f"--- Worker: Task {task_id} not found ---")
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Sort logs by creation time (Prisma default is usually ascending)
        sorted_logs = sorted(task.logs, key=lambda log: log.createdAt)

        response_data = TaskStatusModel(
            id=task.id,
            status=task.status,
            isActive=task.isActive,
            depStation=task.depStation,
            arrStation=task.arrStation,
            selectedTrainType=task.selectedTrainType or "",
            selectedDepTime=task.selectedDepTime or "",
            logs=[LogModel(level=log.level, message=log.message, createdAt=str(log.createdAt)) for log in sorted_logs]
        )
        logging.info(f"--- Worker: Successfully retrieved status for task {task_id} ---")
        return response_data
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"--- Worker: Error in get_task_status for task {task_id}: {e} ---")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error while fetching task status")
    finally:
        db.close()

@app.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: int):
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if task.isActive:
            task.isActive = False
            task.status = "STOPPED"
            db.commit()
            add_log(task.id, "INFO", "Task cancelled by user.")
            return {"message": f"Task {task_id} cancelled successfully."}
        else:
            return {"message": f"Task {task_id} is not active and cannot be cancelled."}
    finally:
        db.close()


def main_loop():
    logging.info("Worker: Starting background polling loop...")
    while True:
        try:
            with SessionLocal() as db: # Use SessionLocal directly as context manager
                tasks_to_process = db.query(Task).filter(Task.isActive == True, Task.status == "PENDING").all()
                
                for task in tasks_to_process:
                    task.status = "RUNNING"
                    db.add(task)
                    db.commit()
                    db.refresh(task)
                    
                    process_task_in_session(task.id) # This function will manage its own session
        except Exception as e:
            logging.error(f"Worker: Error in main loop - {e}", exc_info=True) # Log full traceback
        
        time.sleep(1) # Polling interval for background tasks



def process_task_in_session(task_id: int):
    with SessionLocal() as db:
        task = db.query(Task).options(joinedload(Task.account)).filter(Task.id == task_id).first()
        if not task:
            logging.error(f"Worker: Task {task_id} not found in process_task_in_session.")
            return

        try:
            logging.info(f"\n--- Processing Task ID: {task.id} ({task.account.type}) ---")
            
            driver = get_driver(task.account, task.account.type)
            
            if task.selectedTrainId and task.selectedTrainNo:
                add_log(task.id, "INFO", f"Attempting to reserve specific train: {task.selectedTrainType} {task.selectedTrainNo} from {task.depStation} at {task.selectedDepTime}")
                
                trains = driver.search(task.depStation, task.arrStation, task.date, task.timeFrom, '235959')
                
                selected_train_obj = None
                if trains:
                    train_list = trains[0] if trains and isinstance(trains[0], list) else trains
                    for train in train_list:
                        if (train.train_type_name == task.selectedTrainType and
                            train.dep_time == task.selectedDepTime):
                            selected_train_obj = train
                            break
                
                if selected_train_obj and selected_train_obj.has_seat():
                    ticket = driver.reserve(selected_train_obj)
                    if ticket:
                        update_task_status(task.id, "SUCCESS", booked_detail=str(ticket))
                        send_push(f"[{task.account.type}] 예약 성공!", f"{task.depStation}->{task.arrStation} {selected_train_obj.dep_time}")
                        return
                    else:
                        add_log(task.id, "INFO", f"Reservation failed for specific train {task.selectedTrainNo}. Will retry.")
                else:
                    add_log(task.id, "INFO", f"Selected train {task.selectedTrainNo} not found or no seats available. Will retry search.")
            else:
                add_log(task.id, "ERROR", "No specific train selected for reservation in task. Marking as failed.")
                update_task_status(task.id, "FAILED", booked_detail="No specific train to reserve.")
                return
            
            logging.info(f"--- Task ID: {task.id} remains RUNNING for next cycle (retrying) ---")

        except HTTPException as e:
            add_log(task.id, "ERROR", f"Login failed for task {task.id}: {e.detail}")
            update_task_status(task.id, "FAILED")
            return
        except Exception as e:
            add_log(task.id, "ERROR", f"An unexpected error occurred during reservation attempt: {str(e)}")
            update_task_status(task.id, "FAILED", booked_detail=f"Error: {str(e)}")
            logging.error(f"--- Worker: Exception in process_task_in_session for task {task.id}: {e} ---", exc_info=True)
            return