from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import base64
from datetime import datetime


app = Flask(__name__)
CORS(app)

# Configuration
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///data.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# API Key for security
API_KEY = "123abc"

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

# Helper function to check API key
def validate_key(key):
    return key == API_KEY

# Routes

@app.route('/uploads/<path:path>')
def send_report(path):
    # Using request args for path will expose you to directory traversal attacks
    return send_from_directory('uploads', path)

@app.route("/upload_picture", methods=["POST"])
def upload_picture():
    key = request.args.get("key")
    if not validate_key(key):
        return jsonify({"error": "Invalid API key"}), 403

    data = request.json
    image_base64 = data.get("image")

    if not image_base64:
        return jsonify({"error": "Missing image or timestamp"}), 400

    try:
        # Decode and save the image
        decoded_image = base64.b64decode(image_base64)
        timestamp_obj = datetime.now()
        file_path = f"uploads/{timestamp_obj.strftime('%Y%m%d%H%M%S')}.jpg"
        with open(file_path, "wb") as f:
            f.write(decoded_image)
        # Save to the database
        picture = Picture(timestamp=timestamp_obj, image_path=file_path)
        db.session.add(picture)
        db.session.commit()

        return jsonify({"message": "Picture uploaded successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/upload_sensor_data", methods=["POST"])
def upload_sensor_data():
    key = request.args.get("key")
    #print(request.data)
    if not validate_key(key):
        return jsonify({"error": "Invalid API key"}), 403

    data = request.json
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



@app.route("/pictures", methods=["GET"])
def get_pictures():
    key = request.args.get("key")
    if not validate_key(key):
        return jsonify({"error": "Invalid API key"}), 403

    limit = request.args.get("limit", default=10, type=int)
    page = request.args.get("page", default=1, type=int)
    timestamp_after = request.args.get("timestamp_after").rstrip("Z") + "+00:00"
    timestamp_before = request.args.get("timestamp_before").rstrip("Z") + "+00:00"
    sort = request.args.get("sort", default="asc")  # "asc" or "desc"

    # Base query
    query = Picture.query

    # Filter by timestamp range
    if timestamp_after:
        timestamp_after = datetime.fromisoformat(timestamp_after)
        query = query.filter(Picture.timestamp >= timestamp_after)
    if timestamp_before:
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


@app.route("/sensor_data", methods=["GET"])
def get_sensor_data():
    key = request.args.get("key")
    if not validate_key(key):
        return jsonify({"error": "Invalid API key"}), 403

    limit = request.args.get("limit", default=10, type=int)
    page = request.args.get("page", default=1, type=int)
    timestamp_after = request.args.get("timestamp_after").rstrip("Z") + "+00:00"
    timestamp_before = request.args.get("timestamp_before").rstrip("Z") + "+00:00"
    sort = request.args.get("sort", default="asc")  # "asc" or "desc"

    # Base query
    query = SensorData.query

    # Filter by timestamp range
    if timestamp_after:
        timestamp_after = datetime.fromisoformat(timestamp_after)
        query = query.filter(SensorData.timestamp >= timestamp_after)
    if timestamp_before:
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



@app.route("/sensor_data/<int:id>", methods=["DELETE"])
def delete_sensor_data(id):
    key = request.args.get("key")
    if not validate_key(key):
        return jsonify({"error": "Invalid API key"}), 403

    sensor_data = SensorData.query.get(id)
    if not sensor_data:
        return jsonify({"error": "Sensor data not found"}), 404

    db.session.delete(sensor_data)
    db.session.commit()
    return jsonify({"message": "Sensor data deleted"}), 200


@app.route("/pictures/<int:id>", methods=["DELETE"])
def delete_picture(id):
    key = request.args.get("key")
    if not validate_key(key):
        return jsonify({"error": "Invalid API key"}), 403

    picture = Picture.query.get(id)
    if not picture:
        return jsonify({"error": "Picture not found"}), 404

    db.session.delete(picture)
    db.session.commit()
    return jsonify({"message": "Picture deleted"}), 200

# Add a flag to track initialization
initialized = False

@app.before_request
def initialize_once():
    global initialized
    if not initialized:
        print("Performing one-time initialization")
        # Add your initialization logic here
        db.create_all()
        initialized = True

    

if __name__ == "__main__":
    app.run(host="192.168.178.98",debug=True)
