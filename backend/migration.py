from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os
import shutil
from datetime import datetime
from sqlalchemy import text

# Create a temporary application
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///data.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# Define the old model structure (for reading)
class OldPicture(db.Model):
    __tablename__ = 'picture'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False)
    image_path = db.Column(db.String(200), nullable=False)

class OldSensorData(db.Model):
    __tablename__ = 'sensor_data'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    soil_humidity = db.Column(db.Float, nullable=False)

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    germination_date = db.Column(db.DateTime, nullable=True)
    api_key = db.Column(db.String(120), nullable=False)

def migrate_database():
    print("Starting database migration...")
    
    # First, back up the existing database
    if os.path.exists("data.db"):
        print("Creating backup of existing database...")
        shutil.copy2("data.db", "data.db.backup")
    
    # Get the admin user (or default to user ID 1 if no admin exists)
    with app.app_context():
        admin_user = User.query.filter_by(username="admin").first()
        default_user_id = admin_user.id if admin_user else 1
        print(f"Using default user ID {default_user_id} for existing data")
        
        # Create the new temporary tables
        with db.engine.connect() as conn:
            conn.execute(text('''
            CREATE TABLE IF NOT EXISTS picture_new (
                id INTEGER PRIMARY KEY,
                timestamp DATETIME NOT NULL,
                image_path VARCHAR(200) NOT NULL,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES user (id)
            )
            '''))
            
            conn.execute(text('''
            CREATE TABLE IF NOT EXISTS sensor_data_new (
                id INTEGER PRIMARY KEY,
                timestamp DATETIME NOT NULL,
                temperature FLOAT NOT NULL,
                humidity FLOAT NOT NULL,
                soil_humidity FLOAT NOT NULL,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES user (id)
            )
            '''))
            conn.commit()
        
        # Migrate picture data
        print("Migrating picture data...")
        old_pictures = OldPicture.query.all()
        for pic in old_pictures:
            # Organize files: create user-specific directory and move files
            current_path = pic.image_path
            if os.path.exists(current_path):
                # Create user directory if it doesn't exist
                user_dir = f"uploads/user_{default_user_id}"
                if not os.path.exists(user_dir):
                    os.makedirs(user_dir)
                    
                # New path for the file
                filename = os.path.basename(current_path)
                new_path = f"{user_dir}/{filename}"
                
                # Move the file
                try:
                    shutil.copy2(current_path, new_path)
                    print(f"Copied {current_path} to {new_path}")
                except Exception as e:
                    print(f"Error copying file: {e}")
                    new_path = current_path  # If move fails, keep the old path
            else:
                new_path = current_path  # File doesn't exist, keep reference
                
            # Insert into new table with user_id
            with db.engine.connect() as conn:
                conn.execute(text(
                    "INSERT INTO picture_new (id, timestamp, image_path, user_id) VALUES (:id, :timestamp, :image_path, :user_id)"
                ), {"id": pic.id, "timestamp": pic.timestamp, "image_path": new_path, "user_id": default_user_id})
                conn.commit()
        
        # Migrate sensor data
        print("Migrating sensor data...")
        old_sensor_data = OldSensorData.query.all()
        for data in old_sensor_data:
            with db.engine.connect() as conn:
                conn.execute(text(
                    "INSERT INTO sensor_data_new (id, timestamp, temperature, humidity, soil_humidity, user_id) VALUES (:id, :timestamp, :temp, :humid, :soil, :user_id)"
                ), {"id": data.id, "timestamp": data.timestamp, "temp": data.temperature, "humid": data.humidity, "soil": data.soil_humidity, "user_id": default_user_id})
                conn.commit()
        
        # Replace old tables with new ones
        print("Replacing old tables with new ones...")
        with db.engine.connect() as conn:
            conn.execute(text("DROP TABLE picture"))
            conn.execute(text("ALTER TABLE picture_new RENAME TO picture"))
            
            conn.execute(text("DROP TABLE sensor_data"))
            conn.execute(text("ALTER TABLE sensor_data_new RENAME TO sensor_data"))
            conn.commit()
        
        print("Migration complete!")

if __name__ == "__main__":
    migrate_database()