# worker/database.py
import os
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, joinedload
from sqlalchemy.sql import func

# Load environment variables from .env file
load_dotenv()

# Database connection details from environment variables
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "user")
DB_PASS = os.getenv("DB_PASS", "password")
DB_NAME = os.getenv("DB_NAME", "traindb")
DB_PORT = os.getenv("DB_PORT", "5432")

SQLALCHEMY_DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# SQLAlchemy setup
Engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_recycle=3600, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=Engine)
Base = declarative_base()

# New function to wait for the database
def wait_for_db(max_tries=20, delay_seconds=3):
    import time # Import time here as it's only used in this function
    import logging # Import logging here as it's only used in this function
    logging.info("Attempting to connect to the database...")
    for i in range(max_tries):
        try:
            # Try to establish a connection
            Engine.connect()
            logging.info("Database connection established!")
            return
        except Exception as e:
            logging.warning(f"Database connection failed (attempt {i+1}/{max_tries}): {e}")
            if i < max_tries - 1:
                logging.info(f"Retrying in {delay_seconds} seconds...")
                time.sleep(delay_seconds)
            else:
                logging.error("Max database connection retries reached. Exiting.")
                raise # Re-raise the last exception if all retries fail

# The call to wait_for_db() will be moved to app.py's lifespan event

# SQLAlchemy Models mirroring Prisma schema
class Account(Base):
    __tablename__ = "Account" # Prisma model name is "Account"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False) # "KTX" | "SRT"
    username = Column(String, nullable=False)
    password = Column(String, nullable=False)
    tasks = relationship("Task", back_populates="account")

class Task(Base):
    __tablename__ = "Task" # Prisma model name is "Task"
    id = Column(Integer, primary_key=True, index=True)
    accountId = Column(Integer, ForeignKey("Account.id"), nullable=False)
    depStation = Column(String, nullable=False)
    arrStation = Column(String, nullable=False)
    date = Column(String, nullable=False)
    timeFrom = Column(String, nullable=False)
    timeTo = Column(String, nullable=True) # Made nullable to match schema
    passengers = Column(Integer, default=1)
    
    # Selected train info
    selectedTrainNo = Column(String, nullable=True)
    selectedTrainType = Column(String, nullable=True)
    selectedDepTime = Column(String, nullable=True)
    selectedArrTime = Column(String, nullable=True)
    selectedTrainClass = Column(String, nullable=True)
    selectedTrainId = Column(String, nullable=True)

    # Macro settings
    interval = Column(Integer, default=3)
    isActive = Column(Boolean, default=True)
    status = Column(String, nullable=False, default="PENDING") # "PENDING", "RUNNING", "SUCCESS", "FAILED", "STOPPED"
    
    # Result
    bookedDetail = Column(String, nullable=True)
    
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, onupdate=func.now(), default=func.now())
    account = relationship("Account", back_populates="tasks")
    logs = relationship("Log", back_populates="task")

class Log(Base):
    __tablename__ = "Log" # Prisma model name is "Log"
    id = Column(Integer, primary_key=True, index=True)
    taskId = Column(Integer, ForeignKey("Task.id"), nullable=False)
    level = Column(String, nullable=False) # "INFO", "ERROR", "SUCCESS"
    message = Column(String, nullable=False)
    createdAt = Column(DateTime, server_default=func.now())
    task = relationship("Task", back_populates="logs")

# Helper function to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Functions to interact with the database (refactored)
def get_active_tasks():
    db = SessionLocal()
    try:
        # Fetch tasks that are active and currently in PENDING status, eagerly loading the associated account
        tasks = db.query(Task).options(joinedload(Task.account)).filter(Task.isActive == True, Task.status == "PENDING").all()
        return tasks
    finally:
        db.close()

def update_task_status(task_id, status, booked_detail=None):
    with SessionLocal() as db: # Use SessionLocal directly as context manager
        try:
            task = db.query(Task).filter(Task.id == task_id).first()
            if task:
                task.status = status
                task.bookedDetail = booked_detail
                if status == "SUCCESS" or status == "FAILED": # Mark as inactive if completed or failed permanently
                    task.isActive = False
                task.updatedAt = datetime.now() # Manually update for clarity
                db.commit()
                db.refresh(task)
                print(f"DB: Updated task {task_id} status to {status}. Booked detail: {booked_detail}")
                return True
            print(f"DB: Task {task_id} not found for status update.")
            return False
        except Exception as e:
            print(f"DB Error in update_task_status (Task {task_id}): {e}")
            import logging
            logging.error(f"DB Error in update_task_status (Task {task_id}): {e}", exc_info=True)
            return False

def add_log(task_id, level, message):
    with SessionLocal() as db: # Use SessionLocal directly as context manager
        try:
            log = Log(taskId=task_id, level=level, message=message)
            db.add(log)
            db.commit()
            db.refresh(log)
            print(f"DB Log (Task {task_id}, {level}): {message}")
            return True
        except Exception as e:
            print(f"DB Log Error (Task {task_id}): {e}")
            import logging
            logging.error(f"DB Log Error (Task {task_id}): {e}", exc_info=True) # Log full traceback
            return False

# For initial setup, we need to ensure tables are created if not using Prisma for Python directly
# With Prisma managing migrations, we don't need Base.metadata.create_all(Engine) here,
# but it's good to keep in mind for pure SQLAlchemy projects.
Base.metadata.create_all(Engine)