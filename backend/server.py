from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import base64, io, json, os
from datetime import datetime, timedelta, timezone
from PIL import Image


app = Flask(__name__)
CORS(app)

# Configuration
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///data.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# Models
class Picture(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False)
    image_path = db.Column(db.String(200), nullable=False)

class SensorData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    soil_humidity = db.Column(db.Float, nullable=False)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    germination_date = db.Column(db.DateTime, nullable=True)
    api_key = db.Column(db.String(120), nullable=False)

# Helper function to check API key
def get_user_from_key(api_key):
    """
    Validates the API key and returns the associated user if valid.
    Returns None if the key is invalid.
    """
    if not api_key:
        return None
        
    user = User.query.filter_by(api_key=api_key).first()
    return user

@app.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.json
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
            
        # Find the user in the database
        user = User.query.filter_by(username=username).first()
        
        # Check if user exists and password matches
        if not user or user.password != password:
            return jsonify({"error": "Invalid username or password"}), 401
            
        # Return user info and API key on successful login
        return jsonify({
            "message": "Login successful",
            "user": {
                "id": user.id,
                "username": user.username,
                "api_key": user.api_key,
            }
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/uploads/<path:path>')
def send_report(path):
    # Path validation remains important to prevent directory traversal attacks
    return send_from_directory('uploads', path)

@app.route("/api/upload_picture", methods=["POST"])
def upload_picture():
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403

    data = request.json
    image_base64 = data.get("image")

    if not image_base64:
        return jsonify({"error": "Missing image"}), 400

    try:
        # Decode the image
        decoded_image = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(decoded_image))

        # Rotate the image 90 degrees to the right
        rotated_image = image

        # Save the image as current.jpg
        current_image_path = "uploads/current.jpg"
        rotated_image.save(current_image_path)

        # Check if 10 minutes have passed since the last saved picture
        last_picture = Picture.query.order_by(Picture.timestamp.desc()).first()
        timestamp_obj = datetime.now()

        if not last_picture or (timestamp_obj - last_picture.timestamp).total_seconds() > 1740:  # ~29 minutes
            # Save the image with a timestamped filename
            day_or_night = "d"
            try:
                grayscale_image = rotated_image.convert("L")
                avg_brightness = sum(grayscale_image.getdata()) / len(grayscale_image.getdata())
                if avg_brightness < 50:
                    day_or_night = "n"
            except Exception as e:
                print(f"Error analyzing brightness: {e}")

            file_suffix = day_or_night
            file_path = f"uploads/{timestamp_obj.strftime('%Y%m%d%H%M%S')}_{file_suffix}.jpg"
            rotated_image.save(file_path)

            # Save the record to the database
            picture = Picture(timestamp=timestamp_obj, image_path=file_path)
            db.session.add(picture)
            db.session.commit()

        return jsonify({"message": "Picture uploaded successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Example of updating an admin endpoint
@app.route("/api/admin/users", methods=["GET"])
def get_users():
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403
        
    # Only admin can access this endpoint
    if user.username != "admin":
        return jsonify({"error": "Unauthorized access"}), 403

    users = User.query.all()
    user_list = [
        {
            "id": u.id,
            "username": u.username,
            "password": "••••••••",  # Hide actual password
            "api_key": u.api_key,
            "germination_date": u.germination_date.isoformat() if u.germination_date else None
        }
        for u in users
    ]
    return jsonify({"users": user_list}), 200


@app.route("/api/upload_sensor_data", methods=["POST"])
def upload_sensor_data():
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403

    data = request.json
    print(data)
    temperature = data.get("temperature")
    humidity = data.get("humidity")
    soil_humidity = data.get("soil_humidity")

    if temperature is None or humidity is None:
        return jsonify({"error": "Missing temperature, humidity, or timestamp"}), 400

    try:
        timestamp_obj = datetime.now()
        sensor_data = SensorData(
            timestamp=timestamp_obj, temperature=temperature, humidity=humidity, soil_humidity=soil_humidity
        )
        db.session.add(sensor_data)
        db.session.commit()

        return jsonify({"message": "Sensor data uploaded successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/pictures", methods=["GET"])
def get_pictures():
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403

    limit = request.args.get("limit", default=10, type=int)
    page = request.args.get("page", default=1, type=int)
    timestamp_after = request.args.get("timestamp_after")
    timestamp_before = request.args.get("timestamp_before")
    sort = request.args.get("sort", default="asc")  # "asc" or "desc"

    # Base query
    query = Picture.query

    # Filter by timestamp range
    if timestamp_after:
        timestamp_after = timestamp_after.rstrip("Z") + "+00:00"
        timestamp_after = datetime.fromisoformat(timestamp_after)
        query = query.filter(Picture.timestamp >= timestamp_after)
    if timestamp_before:
        timestamp_before = timestamp_before.rstrip("Z") + "+00:00"
        timestamp_before = datetime.fromisoformat(timestamp_before)
        query = query.filter(Picture.timestamp <= timestamp_before)

    # Sort by timestamp
    if sort == "desc":
        query = query.order_by(Picture.timestamp.desc())
    else:
        query = query.order_by(Picture.timestamp.asc())

    # Pagination
    pictures = query.paginate(page=page, per_page=limit)
    data = [
        {"id": pic.id, "timestamp": pic.timestamp.isoformat(), "image_path": pic.image_path}
        for pic in pictures.items
    ]
    return jsonify({"pictures": data, "total": pictures.total}), 200


@app.route("/api/sensor_data", methods=["GET"])
def get_sensor_data():
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403

    limit = request.args.get("limit", default=10, type=int)
    page = request.args.get("page", default=1, type=int)
    timestamp_after = request.args.get("timestamp_after")
    timestamp_before = request.args.get("timestamp_before")
    sort = request.args.get("sort", default="asc")  # "asc" or "desc"

    # Base query
    query = SensorData.query

    # Filter by timestamp range
    if timestamp_after:
        timestamp_after = timestamp_after.rstrip("Z") + "+00:00"
        timestamp_after = datetime.fromisoformat(timestamp_after)
        query = query.filter(SensorData.timestamp >= timestamp_after)
    if timestamp_before:
        timestamp_before = timestamp_before.rstrip("Z") + "+00:00"
        timestamp_before = datetime.fromisoformat(timestamp_before)
        query = query.filter(SensorData.timestamp <= timestamp_before)

    # Sort by timestamp
    if sort == "desc":
        query = query.order_by(SensorData.timestamp.desc())
    else:
        query = query.order_by(SensorData.timestamp.asc())

    # Pagination
    sensor_data = query.paginate(page=page, per_page=limit)
    data = [
        {
            "id": s.id,
            "timestamp": s.timestamp.isoformat(),
            "temperature": s.temperature,
            "humidity": s.humidity,
            "soil_humidity": s.soil_humidity,
        }
        for s in sensor_data.items
    ]
    return jsonify({"sensor_data": data, "total": sensor_data.total}), 200


@app.route("/api/sensor_data/<int:id>", methods=["DELETE"])
def delete_sensor_data(id):
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403

    sensor_data = SensorData.query.get(id)
    if not sensor_data:
        return jsonify({"error": "Sensor data not found"}), 404

    db.session.delete(sensor_data)
    db.session.commit()
    return jsonify({"message": "Sensor data deleted"}), 200


@app.route("/api/pictures/<int:id>", methods=["DELETE"])
def delete_picture(id):
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403

    picture = Picture.query.get(id)
    if not picture:
        return jsonify({"error": "Picture not found"}), 404

    db.session.delete(picture)
    db.session.commit()
    return jsonify({"message": "Picture deleted"}), 200


@app.route("/api/user/preferences", methods=["GET"])
def get_preferences():
    key = request.args.get("key")
    username = request.args.get("username")
    
    user = get_user_from_key(key)
    if not user:
        return jsonify({"error": "Invalid API key"}), 403
    
    # Only admin can access other users' preferences
    if user.username != "admin" and user.username != username:
        return jsonify({"error": "Unauthorized access"}), 403
        
    target_user = User.query.filter_by(username=username).first()
    if not target_user:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify({
        "germination_date": target_user.germination_date.isoformat() if target_user.germination_date else None
    }), 200


@app.route("/api/user/preferences", methods=["POST"])
def update_preferences():
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403
        
    data = request.json
    username = data.get("username")
    germination_date = data.get("germination_date")
    
    # Only admin can update other users' preferences
    if user.username != "admin" and user.username != username:
        return jsonify({"error": "Unauthorized access"}), 403
    
    target_user = User.query.filter_by(username=username).first()
    if not target_user:
        return jsonify({"error": "User not found"}), 404
        
    if germination_date:
        target_user.germination_date = datetime.fromisoformat(germination_date.rstrip("Z") + "+00:00")
        
    db.session.commit()
    return jsonify({"message": "Preferences updated successfully"}), 200


@app.route("/api/timelapse", methods=["GET"])
def get_timelapse_pictures():
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403

    start_date = request.args.get("start_date")

    if not start_date:
        return jsonify({"error": "Start date is required"}), 400

    # Convert start_date to UTC
    start_date = datetime.fromisoformat(start_date.rstrip("Z") + "+00:00")
    # Get current time in UTC
    current_date = start_date

    pictures = []
    while True:
        # Get the next picture where the filename ends with "d"
        pic = Picture.query.filter(
            Picture.timestamp >= current_date,
            Picture.image_path.endswith("d.jpg")
        ).order_by(Picture.timestamp.asc()).first()

        if not pic:
            # Stop the loop if no more pictures are available
            break

        # Add the picture to the results
        aware_timestamp = pic.timestamp.replace(tzinfo=timezone.utc)
        pictures.append({
            "id": pic.id,
            "timestamp": aware_timestamp.isoformat(),
            "image_path": pic.image_path,
            "day": (aware_timestamp - start_date).days + 1
        })

        # Move to the next hour after the current picture's timestamp
        current_date = pic.timestamp + timedelta(hours=1)

    return jsonify({"pictures": pictures}), 200


# Also update the admin management endpoints:

@app.route("/api/admin/users", methods=["POST"])
def create_user():
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403
        
    # Only admin can access this endpoint
    if user.username != "admin":
        return jsonify({"error": "Unauthorized access"}), 403

    data = request.json
    username = data.get("username")
    password = data.get("password")
    api_key = data.get("api_key")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    # Check if username already exists
    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400

    try:
        new_user = User(
            username=username,
            password=password,
            api_key=api_key
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "message": "User created successfully",
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "api_key": new_user.api_key
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403
        
    # Only admin can access this endpoint
    if user.username != "admin":
        return jsonify({"error": "Unauthorized access"}), 403

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    data = request.json
    username = data.get("username")
    password = data.get("password")
    api_key = data.get("api_key")

    if username and username != target_user.username:
        # Check if the new username already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({"error": "Username already exists"}), 400
        target_user.username = username

    if password:
        target_user.password = password

    if api_key:
        target_user.api_key = api_key

    try:
        db.session.commit()
        return jsonify({
            "message": "User updated successfully",
            "user": {
                "id": target_user.id,
                "username": target_user.username,
                "api_key": target_user.api_key
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    key = request.args.get("key")
    user = get_user_from_key(key)
    
    if not user:
        return jsonify({"error": "Invalid API key"}), 403
        
    # Only admin can access this endpoint
    if user.username != "admin":
        return jsonify({"error": "Unauthorized access"}), 403

    # Prevent deleting the admin user
    if user_id == user.id:
        return jsonify({"error": "Cannot delete admin user"}), 400

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    try:
        db.session.delete(target_user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

def initialize_users():
    """
    Read users from users.json and create them if they don't exist.
    users.json format:
    {
        "users": [
            {
                "username": "admin",
                "password": "password",
                "api_key": "123abc"
            }
        ]
    }
    """
    try:
        # Check if users.json exists
        if not os.path.exists('users.json'):
            print("users.json not found, skipping user initialization")
            return

        with open('users.json', 'r') as f:
            data = json.load(f)

        # Validate JSON structure
        if not isinstance(data, dict) or 'users' not in data:
            print("Invalid users.json format")
            return

        # Create users if they don't exist
        for user_data in data['users']:
            if not all(k in user_data for k in ('username', 'password', 'api_key')):
                print(f"Skipping invalid user data: {user_data}")
                continue

            existing_user = User.query.filter_by(username=user_data['username']).first()
            if not existing_user:
                new_user = User(
                    username=user_data['username'],
                    password=user_data['password'],
                    api_key=user_data['api_key']
                )
                db.session.add(new_user)
                print(f"Created user: {user_data['username']}")

        db.session.commit()
        print("User initialization completed")

    except json.JSONDecodeError:
        print("Error decoding users.json")
    except Exception as e:
        print(f"Error initializing users: {str(e)}")


# Add a flag to track initialization
initialized = False

@app.before_request
def initialize_once():
    global initialized
    if not initialized:
        print("Performing one-time initialization")
        # Add your initialization logic here
        db.create_all()
        initialize_users()
        initialized = True

    

if __name__ == "__main__":
    app.run(host="127.0.0.1",debug=True)
